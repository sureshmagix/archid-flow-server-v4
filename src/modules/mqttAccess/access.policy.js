const ApiError = require('../../common/utils/ApiError');
const { buildDeviceTopics, buildDeviceTopic } = require('../mqtt/mqtt.topics');
const id = value => String(value?._id || value || '');
const weights = { view: 1, control: 2, admin: 3 };

// Pure policy, also used by the guard to recheck every active grant.
function authorize({ user, device, company, share, now = new Date() }) {
  if (!user || !user.isActive) throw new ApiError(403, 'User is inactive');
  if (!device || device.protocol !== 'mqtt' || device.provisioningStatus !== 'claimed' || device.operationalStatus !== 'active') {
    throw new ApiError(403, 'Device is not active and claimed for MQTT access');
  }
  if (!device.deviceType || device.deviceType.isActive === false) throw new ApiError(403, 'Device type is inactive');
  if (!company || company.status !== 'active') throw new ApiError(403, 'Company is inactive');
  let permission, shareExpiresAt = null;
  if (user.role === 'super_admin') permission = 'admin';
  else {
    if (!user.company || id(user.company) !== id(device.company)) throw new ApiError(403, 'Device belongs to another company');
    if (user.role === 'customer_admin' || id(device.owner) === id(user)) permission = 'admin';
    else if (share && id(share.device) === id(device) && id(share.sharedWith) === id(user) && share.status === 'active' &&
      (!share.expiresAt || new Date(share.expiresAt) > now) && weights[share.permission]) {
      permission = share.permission;
      shareExpiresAt = share.expiresAt;
    } else throw new ApiError(403, 'No active device permission');
    // A globally view-only account can never publish, even if it owns the device.
    if (user.role === 'customer_view_user') permission = 'view';
    else if (!['customer_admin', 'customer_control_user'].includes(user.role)) throw new ApiError(403, 'Invalid user role');
  }
  const input = { category: device.deviceType.category, hardwareId: device.hardwareId };
  const topics = buildDeviceTopics(input);
  topics.command = buildDeviceTopic({ ...input, messageType: 'command' });
  if ((device.mqttTopicBase && device.mqttTopicBase !== topics.base) || (device.mqtt?.baseTopic && device.mqtt.baseTopic !== topics.base)) {
    throw new ApiError(409, 'Device topic differs from canonical topic; migrate device firmware/topic before granting access');
  }
  return { permission, topics, subscribe: [topics.state, topics.telemetry, topics.ack, topics.heartbeat],
    publish: permission === 'view' ? [] : [topics.command], shareExpiresAt };
}
function roleAcls(grant) {
  // Explicit catch-all denies override default/inherited broker permissions.
  return [
    ...grant.subscribe.flatMap(topic => [
      { acltype: 'subscribeLiteral', topic, allow: true, priority: 100 },
      { acltype: 'publishClientReceive', topic, allow: true, priority: 100 }
    ]),
    ...grant.publish.map(topic => ({ acltype: 'publishClientSend', topic, allow: true, priority: 100 })),
    ...['publishClientSend', 'publishClientReceive', 'subscribePattern'].flatMap(acltype => [
      { acltype, topic: '#', allow: false, priority: 0 },
      { acltype, topic: '$CONTROL/#', allow: false, priority: 0 },
      { acltype, topic: '$SYS/#', allow: false, priority: 0 }
    ])
  ];
}
module.exports = { authorize, roleAcls };
