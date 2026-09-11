const {test}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {MongoMemoryServer}=require('mongodb-memory-server');
const config=require('../src/config/env');
const {AccessService}=require('../src/modules/mqttAccess/access.service');
const {AccessGuard}=require('../src/modules/mqttAccess/access.guard');
const {MqttAccess,GuardState}=require('../src/modules/mqttAccess/access.model');
const User=require('../src/modules/users/user.model');
const Company=require('../src/modules/companies/company.model');
const {DeviceType}=require('../src/modules/deviceTypes/deviceType.model');
const {Device}=require('../src/modules/devices/device.model');
class Broker {
  clients=new Map();roles=new Set();fail=false;
  async execute(){if(this.fail)throw new Error('broker down');return {acls:['publishClientSend','publishClientReceive','subscribe'].map(acltype=>({acltype,allow:false}))};}
  async provision(s,acls){this.roles.add(s.roleName);this.clients.set(s.username,{acls,password:null});}
  async enable(s,password){if(this.fail)throw new Error('broker down');this.clients.get(s.username).password=password;}
  async revoke(s){if(this.fail)throw new Error('broker down');this.clients.delete(s.username);this.roles.delete(s.roleName);}
}
test('Durable MQTT leases: readiness, renewal, expiry, role revocation and failed provision cleanup',async()=>{
 const mongo=await MongoMemoryServer.create({instance:{args:['--nounixsocket']}});
 try {
  await mongoose.connect(mongo.getUri('access_test'));
  config.mqttAccess.enabled=true;
  const company=await Company.create({name:'Test company',code:'TEST'});
  const user=await User.create({name:'Owner',email:'owner@example.com',mobile:'9000000000',password:'test',role:'customer_admin',company:company._id});
  const type=await DeviceType.create({name:'Relay',category:'relay'});
  const device=await Device.create({name:'Relay',hardwareId:'TEST001',deviceCode:'D1',deviceType:type._id,company:company._id,owner:user._id,protocol:'mqtt',provisioningStatus:'claimed',operationalStatus:'active'});
  const broker=new Broker(), service=new AccessService(broker), guard=new AccessGuard(broker);
  const authExp=Date.now()+600000;
  await assert.rejects(service.issue(user._id,device._id,authExp),/guard is not ready/);
  await guard.setReady(true);
  const first=await service.issue(user._id,device._id,authExp);
  assert.ok(first.password);assert.ok(new Date(first.expiresAt).getTime()<=authExp);
  assert.equal((await MqttAccess.findById(first.sessionId)).toObject().password,undefined);
  const second=await service.renew(user._id,device._id,first.sessionId,authExp);
  assert.notEqual(first.username,second.username);assert.equal(broker.clients.has(first.username),false);
  await MqttAccess.updateOne({_id:second.sessionId},{$set:{expiresAt:new Date(0)}});
  await guard.tick();assert.equal(broker.clients.has(second.username),false);
  assert.equal((await MqttAccess.findById(second.sessionId)).status,'revoked');
  const third=await service.issue(user._id,device._id,authExp);
  await User.updateOne({_id:user._id},{$set:{isActive:false}});
  await guard.tick();assert.equal(broker.clients.has(third.username),false);
  await User.updateOne({_id:user._id},{$set:{isActive:true}});
  broker.fail=true;
  await assert.rejects(service.issue(user._id,device._id,authExp),/broker down/);
  assert.equal(await MqttAccess.countDocuments({status:'revoking'}),1);
  broker.fail=false;await guard.tick();assert.equal(broker.clients.size,0);
  await GuardState.updateOne({_id:'direct-mqtt'},{$set:{checkedAt:new Date(0)}});
  await assert.rejects(service.issue(user._id,device._id,authExp),/guard is not ready/);
 } finally {await mongoose.disconnect();await mongo.stop();}
});
