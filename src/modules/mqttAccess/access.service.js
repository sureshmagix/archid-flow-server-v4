const crypto = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../../config/env');
const ApiError = require('../../common/utils/ApiError');
const User = require('../users/user.model');
const Company = require('../companies/company.model');
const { Device } = require('../devices/device.model');
const { DeviceShare } = require('../deviceSharing/deviceShare.model');
const { MqttAccess, GuardState } = require('./access.model');
const { authorize, roleAcls } = require('./access.policy');
const { DynsecClient } = require('./dynsec.client');

class AccessService {
  constructor(broker = new DynsecClient()) { this.broker = broker; }
  async policy(userId, deviceId) {
    const user = await User.findById(userId);
    const device = await Device.findById(deviceId).populate('deviceType');
    if (!device) throw new ApiError(404, 'Device not found');
    const company = device.company ? await Company.findById(device.company) : null;
    const share = await DeviceShare.findOne({ device: deviceId, sharedWith: userId, status: 'active',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    return authorize({ user, device, company, share });
  }
  async assertReady() {
    if (!config.mqttAccess.enabled) throw new ApiError(503, 'Direct MQTT access is disabled');
    let url;
    try { url = new URL(config.mqtt.publicUrl); } catch { throw new ApiError(503, 'Invalid public MQTT URL'); }
    if (url.protocol !== 'wss:') throw new ApiError(503, 'Public MQTT access requires WSS');
    const guard = await GuardState.findById('direct-mqtt');
    if (!guard?.ready || Date.now() - guard.checkedAt.getTime() > config.mqttAccess.guardMaxAgeMs) {
      throw new ApiError(503, 'MQTT access guard is not ready');
    }
  }
  async issue(userId, deviceId, authExpiresAt) {
    await this.assertReady();
    const grant = await this.policy(userId, deviceId);
    const ttl = config.mqtt.accessTtlSeconds;
    if (!Number.isInteger(ttl) || ttl < 30 || ttl > 3600) throw new ApiError(503, 'MQTT access TTL must be 30–3600 seconds');
    const expiresAt = new Date(Math.min(Date.now() + ttl * 1000, authExpiresAt,
      grant.shareExpiresAt ? new Date(grant.shareExpiresAt).getTime() : Infinity));
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() - Date.now() < 1000) throw new ApiError(401, 'Login or sharing access expires too soon');
    const count = await MqttAccess.countDocuments({ user: userId, status: { $in: ['active', 'pending'] } });
    if (count >= 10) throw new ApiError(429, 'Close an existing MQTT access session before opening another');
    const key = crypto.randomBytes(18).toString('hex');
    const password = crypto.randomBytes(32).toString('base64url');
    const session = await MqttAccess.create({ user: userId, device: deviceId,
      username: 'archid-app-' + key, clientId: 'archid-app-' + key, roleName: 'archid-app-' + key,
      permission: grant.permission, topicBase: grant.topics.base, expiresAt });
    try {
      await this.broker.provision(session, roleAcls(grant));
      // Recheck authorization after broker operations (role/share may have changed).
      const current = await this.policy(userId, deviceId);
      if (current.permission !== grant.permission || current.topics.base !== grant.topics.base ||
          (current.shareExpiresAt && new Date(current.shareExpiresAt) < expiresAt)) throw new ApiError(409, 'Device permission changed; request access again');
      await this.assertReady();
      const active = await MqttAccess.findOneAndUpdate({ _id: session._id, status: 'pending', expiresAt: { $gt: new Date() } },
        { $set: { status: 'active' } }, { returnDocument: 'after' });
      if (!active) throw new ApiError(409, 'Access session was revoked while provisioning');
      await this.broker.enable(session, password);
      return { sessionId: session.id, deviceId: String(deviceId), expiresAt,
        permission: grant.permission, brokerUrl: config.mqtt.publicUrl,
        username: session.username, password, clientId: session.clientId,
        topics: grant.topics, subscribe: grant.subscribe, publish: grant.publish,
        mqtt: { protocolVersion: 4, clean: true, keepalive: 25, reconnectPeriod: 0, queueQoSZero: false },
        commandOptions: { qos: 1, retain: false },
        revocation: { mode: 'guard', checkIntervalMs: config.mqttAccess.guardIntervalMs } };
    } catch (err) {
      // Persist cleanup intent before contacting the broker. Guard retries failures.
      await MqttAccess.updateOne({ _id: session._id }, { $set: { status: 'revoking', reason: 'Provisioning failed' } });
      try { await this.cleanup(session); } catch { /* durable revoking state remains */ }
      throw err;
    }
  }
  async cleanup(session) {
    await this.broker.revoke(session);
    await MqttAccess.updateOne({ _id: session._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
  }
  async revoke(userId, deviceId, sessionId) {
    if (!mongoose.isObjectIdOrHexString(sessionId)) throw new ApiError(400, 'Invalid MQTT session ID');
    // Session credentials belong to the caller; even another device admin cannot renew them.
    const session = await MqttAccess.findOne({ _id: sessionId, user: userId, device: deviceId });
    if (!session) throw new ApiError(404, 'MQTT access session not found');
    if (session.status === 'revoked') return;
    await MqttAccess.updateOne({ _id: session._id }, { $set: { status: 'revoking', reason: 'User revoked access' } });
    await this.cleanup(session);
  }
  async renew(userId, deviceId, sessionId, authExpiresAt) {
    await this.assertReady();
    await this.policy(userId, deviceId);
    await this.revoke(userId, deviceId, sessionId);
    // Rotation deliberately disconnects the old client before returning new credentials.
    return this.issue(userId, deviceId, authExpiresAt);
  }
}
module.exports = { AccessService };
