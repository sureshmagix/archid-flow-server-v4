const { MqttAccess, GuardState } = require('./access.model');
const { AccessService } = require('./access.service');
const { DynsecClient } = require('./dynsec.client');

class AccessGuard {
  constructor(broker = new DynsecClient()) { this.broker = broker; this.service = new AccessService(broker); }
  async setReady(ready) {
    await GuardState.updateOne({ _id: 'direct-mqtt' }, { $set: { ready, checkedAt: new Date() } }, { upsert: true });
  }
  async purgeBrokerClients() {
    // The prefix is reserved exclusively for temporary app sessions. Never touch device/backend identities.
    for (const [command, key, nameKey, remove] of [
      ['listClients','clients','username', name => this.broker.removeClient(name)],
      ['listRoles','roles','rolename', name => this.broker.removeRole(name)]
    ]) {
      const names = [];
      for (let offset=0;;offset+=100) {
        const data = await this.broker.execute({command,verbose:true,count:100,offset});
        const rows = data[key] || [];
        names.push(...rows.map(row => typeof row === 'string' ? row : row[nameKey]).filter(name => name?.startsWith('archid-app-')));
        if (rows.length < 100) break;
      }
      for (const name of names) await remove(name);
    }
  }
  async start() {
    await this.setReady(false);
    await this.purgeBrokerClients();
    await MqttAccess.updateMany({status:{$ne:'revoked'}},{$set:{status:'revoked',reason:'Guard restart',revokedAt:new Date()}});
    await this.tick();
  }
  async tick() {
    // A broker administration round trip is required before a healthy heartbeat is recorded.
    const defaults = await this.broker.execute({command:'getDefaultACLAccess'});
    for (const acltype of ['publishClientSend','publishClientReceive','subscribe']) {
      if (!defaults.acls?.some(acl => acl.acltype === acltype && acl.allow === false)) {
        throw new Error('Broker default ACL must deny ' + acltype);
      }
    }
    const cursor = MqttAccess.find({status:{$ne:'revoked'}}).cursor();
    try {
      for await (const session of cursor) {
        let reason = session.status === 'revoking' ? 'Revocation requested' : null;
        if (session.expiresAt <= new Date()) reason = 'Expired';
        if (session.status === 'pending' && Date.now()-session.createdAt.getTime()>30000) reason = 'Incomplete provisioning';
        if (!reason && session.status === 'active') {
          try {
            const policy = await this.service.policy(session.user,session.device);
            if (policy.permission !== session.permission || policy.topics.base !== session.topicBase ||
                (policy.shareExpiresAt && new Date(policy.shareExpiresAt)<session.expiresAt)) reason='Permission changed';
          } catch (err) {
            if ([403,404,409].includes(err.statusCode)) reason='Access removed';
            else throw err;
          }
        }
        if (reason) {
          await MqttAccess.updateOne({_id:session._id},{$set:{status:'revoking',reason}});
          await this.service.cleanup(session);
        }
      }
    } finally { await cursor.close(); }
    await this.setReady(true);
  }
}
module.exports = { AccessGuard };
