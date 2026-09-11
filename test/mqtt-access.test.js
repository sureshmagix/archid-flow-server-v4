const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorize, roleAcls } = require('../src/modules/mqttAccess/access.policy');
function fixture() { return {
  user:{_id:'user',company:'company',role:'customer_control_user',isActive:true},
  device:{_id:'device',company:'company',owner:'owner',hardwareId:'TEST001',protocol:'mqtt',provisioningStatus:'claimed',operationalStatus:'active',deviceType:{category:'relay',isActive:true}},
  company:{_id:'company',status:'active'},
  share:{device:'device',sharedWith:'user',status:'active',permission:'control'}
}; }
test('Control grant permits only canonical command publish and exact device subscriptions',()=>{
  const grant=authorize(fixture());
  assert.deepEqual(grant.publish,['archid/v4/devices/relay/TEST001/command']);
  assert.equal(grant.subscribe.length,4);
  assert.ok(roleAcls(grant).some(a=>a.acltype==='publishClientSend'&&a.topic==='#'&&!a.allow));
});
test('Company admin cannot cross companies; inactive identities/devices fail closed',()=>{
  const data=fixture();data.user.role='customer_admin';data.user.company='other';
  assert.throws(()=>authorize(data),/another company/);
  for(const change of [d=>d.user.isActive=false,d=>d.company.status='inactive',d=>d.device.operationalStatus='inactive',d=>d.device.provisioningStatus='unclaimed']) {
    const data=fixture();change(data);assert.throws(()=>authorize(data));
  }
});
test('Global view role cannot publish even with ownership or control share',()=>{
  const data=fixture();data.user.role='customer_view_user';data.device.owner='user';
  assert.deepEqual(authorize(data).publish,[]);
});
test('Expired/revoked shares, wrong topic and hardware wildcard are rejected',()=>{
  for(const change of [d=>d.share.status='revoked',d=>d.share.expiresAt=new Date(0),d=>d.device.mqttTopicBase='other/device',d=>d.device.hardwareId='ANY/#']) {
    const data=fixture();change(data);assert.throws(()=>authorize(data));
  }
});
