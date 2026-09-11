const mqtt = require('mqtt');
const crypto = require('node:crypto');
const config = require('../../config/env');
const ApiError = require('../../common/utils/ApiError');
const CONTROL = '$CONTROL/dynamic-security/v1';

class DynsecClient {
  constructor(options = config.mqttAccess) { this.options = options; }
  async execute(command) {
    const options = this.options;
    if (!options.adminUsername || !options.adminPassword) throw new ApiError(503, 'MQTT access administration is not configured');
    const correlationData = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      let done = false;
      const client = mqtt.connect(options.adminUrl, {
        username: options.adminUsername, password: options.adminPassword,
        clientId: 'archid-dynsec-' + crypto.randomBytes(12).toString('hex'),
        clean: true, reconnectPeriod: 0, connectTimeout: options.timeoutMs,
        queueQoSZero: false, protocolVersion: 4, rejectUnauthorized: true
      });
      const finish = (error, value) => {
        if (done) return;
        done = true; clearTimeout(timer); client.end(true);
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => finish(new ApiError(503, 'MQTT broker administration timed out')), options.timeoutMs);
      client.on('error', () => finish(new ApiError(503, 'MQTT broker administration unavailable')));
      client.on('close', () => { if (!done) finish(new ApiError(503, 'MQTT broker administration disconnected')); });
      client.on('connect', () => client.subscribe(CONTROL + '/response', { qos: 1 }, (err, granted) => {
        if (err || !granted?.length || granted.some(g => g.qos === 128)) return finish(new ApiError(503, 'MQTT administration subscription denied'));
        client.publish(CONTROL, JSON.stringify({ commands: [{ ...command, correlationData }] }), { qos: 1, retain: false }, err => {
          if (err) finish(new ApiError(503, 'MQTT administration publish failed'));
        });
      }));
      client.on('message', (topic, message) => {
        if (topic !== CONTROL + '/response') return;
        let response;
        try { response = JSON.parse(message).responses?.find(r => r.correlationData === correlationData); } catch { return; }
        if (!response) return;
        if (response.error) {
          const error = new ApiError(503, 'MQTT broker rejected access configuration');
          // Internal adapter code only; never return broker response/credentials to callers.
          error.brokerError = response.error;
          return finish(error);
        }
        finish(null, response.data || {});
      });
    });
  }
  async removeClient(username) {
    try { await this.execute({ command: 'deleteClient', username }); }
    catch (err) { if (!/not found|does not exist/i.test(err.brokerError || '')) throw err; }
  }
  async removeRole(rolename) {
    try { await this.execute({ command: 'deleteRole', rolename }); }
    catch (err) { if (!/not found|does not exist/i.test(err.brokerError || '')) throw err; }
  }
  async provision(session, acls) {
    await this.execute({ command: 'createRole', rolename: session.roleName, acls });
    // A client without a password cannot authenticate during provisioning.
    await this.execute({ command: 'createClient', username: session.username,
      clientid: session.clientId, roles: [{ rolename: session.roleName, priority: 100 }] });
  }
  async enable(session, password) { await this.execute({ command: 'setClientPassword', username: session.username, password }); }
  async revoke(session) {
    // Remove credentials before role cleanup, so a role-cleanup failure cannot preserve access.
    await this.removeClient(session.username);
    await this.removeRole(session.roleName);
  }
}
module.exports = { DynsecClient };
