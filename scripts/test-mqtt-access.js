// Real broker integration: disposable TCP-only Mosquitto + Dynamic Security + MongoDB.
// WSS/TLS termination must additionally be tested on the deployment host.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const {MongoMemoryServer} = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
function connect(url,options){return new Promise((resolve,reject)=>{
 const c=mqtt.connect(url,{...options,reconnectPeriod:0,connectTimeout:2000,queueQoSZero:false,protocolVersion:5});
 const timer=setTimeout(()=>{c.end(true);reject(new Error('Connect timeout'));},3000);
 c.once('connect',()=>{clearTimeout(timer);resolve(c);});c.once('error',e=>{clearTimeout(timer);c.end(true);reject(e);});
});}
const subscribe=(c,topic)=>new Promise((resolve,reject)=>c.subscribe(topic,{qos:1},(e,g)=>e?reject(e):g.some(x=>x.qos>=128)?reject(new Error('Denied')):resolve(g)));
const publish=(c,topic,payload)=>new Promise((resolve,reject)=>c.publish(topic,JSON.stringify(payload),{qos:1,retain:false},e=>e?reject(e):resolve()));
const message=(c,topic)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{c.removeListener('message',on);reject(new Error('Message timeout: '+topic));},3000);function on(t,m){if(t===topic){clearTimeout(timer);c.removeListener('message',on);resolve(JSON.parse(m));}}c.on('message',on);});
async function main(){
 const binary=process.env.MOSQUITTO_BIN, plugin=process.env.MOSQUITTO_DYNSEC_PLUGIN;
 if(!binary||!plugin)throw new Error('Set MOSQUITTO_BIN and MOSQUITTO_DYNSEC_PLUGIN. This test requires real Mosquitto Dynamic Security.');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'archid-mqtt-test-'));let broker,mongo,server;const clients=[];
 try {
  const port=await freePort(),url=`mqtt://127.0.0.1:${port}`,password=crypto.randomBytes(24).toString('hex'),salt=crypto.randomBytes(12),iterations=101;
  const cfg={clients:[{username:'test-admin',password:crypto.pbkdf2Sync(password,salt,iterations,64,'sha512').toString('base64'),salt:salt.toString('base64'),iterations,roles:[{rolename:'admin'}]}],roles:[{rolename:'admin',acls:['publishClientSend','publishClientReceive','subscribePattern'].map(acltype=>({acltype,topic:'$CONTROL/dynamic-security/#',allow:true}))}],defaultACLAccess:{publishClientSend:false,publishClientReceive:false,subscribe:false,unsubscribe:true}};
  const cfgPath=path.join(temp,'dynsec.json');fs.writeFileSync(cfgPath,JSON.stringify(cfg),{mode:0o600});
  // No privilege switch in disposable runtime; all files/bind addresses are isolated.
  const runUser=os.userInfo().username;
  fs.writeFileSync(path.join(temp,'mosquitto.conf'),`user ${runUser}\nlistener ${port} 127.0.0.1\nallow_anonymous false\nplugin ${plugin}\nplugin_opt_config_file ${cfgPath}\n`);
  let brokerLog='';broker=spawn(binary,['-c',path.join(temp,'mosquitto.conf')]);broker.stderr.on('data',d=>brokerLog+=d);broker.stdout.on('data',d=>brokerLog+=d);
  await delay(250);if(broker.exitCode!==null)throw new Error('Broker failed: '+brokerLog);
  process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  const config=require('../src/config/env');Object.assign(config.mqttAccess,{enabled:true,adminUrl:url,adminUsername:'test-admin',adminPassword:password});
  const {DynsecClient}=require('../src/modules/mqttAccess/dynsec.client');const admin=new DynsecClient();
  mongo=await MongoMemoryServer.create({instance:{args:['--nounixsocket']}});await mongoose.connect(mongo.getUri('mqtt_integration'));
  const app=require('../src/app');const User=require('../src/modules/users/user.model');const Company=require('../src/modules/companies/company.model');
  const {DeviceType}=require('../src/modules/deviceTypes/deviceType.model');const {Device}=require('../src/modules/devices/device.model');const {DeviceShare}=require('../src/modules/deviceSharing/deviceShare.model');
  const {AccessGuard}=require('../src/modules/mqttAccess/access.guard');const {MqttAccess}=require('../src/modules/mqttAccess/access.model');
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  const company=await Company.create({name:'MQTT Test',code:'MQTT_TEST'});
  const owner=await User.create({name:'Owner',email:'owner@example.com',mobile:'9000000000',password:'test',role:'customer_admin',company:company._id});
  const viewer=await User.create({name:'Viewer',email:'viewer@example.com',mobile:'9000000001',password:'test',role:'customer_view_user',company:company._id});
  const type=await DeviceType.create({name:'Relay',category:'relay'});
  const device=await Device.create({name:'Relay',hardwareId:'TEST001',deviceCode:'D1',deviceType:type._id,company:company._id,owner:owner._id,protocol:'mqtt',provisioningStatus:'claimed',operationalStatus:'active'});
  const share=await DeviceShare.create({device:device._id,company:company._id,sharedWith:viewer._id,sharedBy:owner._id,permission:'view'});
  const guard=new AccessGuard(admin);await guard.start();
  server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const base=`http://127.0.0.1:${server.address().port}/api/v1/devices/${device.id}/mqtt-access`;
  const token=user=>jwt.sign({id:user.id},config.jwt.secret,{expiresIn:'10m'});
  async function api(user,method,suffix='',expected=201){const r=await fetch(base+suffix,{method,headers:{Authorization:'Bearer '+token(user),'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});const b=await r.json();assert.equal(r.status,expected,JSON.stringify(b));if(method==='POST'&&expected===201)assert.equal(r.headers.get('cache-control'),'no-store');return b.data?.access;}
  const access=await api(owner,'POST'),view=await api(viewer,'POST');assert.deepEqual(view.publish,[]);
  const c=await connect(url,access);clients.push(c);const v=await connect(url,view);clients.push(v);
  await subscribe(c,access.topics.ack);await subscribe(v,view.topics.state);
  await assert.rejects(subscribe(v,'#'));await assert.rejects(subscribe(v,'archid/v4/devices/relay/OTHER/state'));
  await assert.rejects(connect(url,{...view,clientId:'wrong-client'}));
  console.log('PASS exact subscriptions, wildcard/cross-device denial, client-id binding');
  // Device credential is independent of app leases and has only its device topics.
  await admin.execute({command:'createRole',rolename:'test-device',acls:[
    ...['state','ack','telemetry','heartbeat'].map(k=>({acltype:'publishClientSend',topic:access.topics[k],allow:true})),
    {acltype:'subscribeLiteral',topic:access.topics.command,allow:true},{acltype:'publishClientReceive',topic:access.topics.command,allow:true}]});
  await admin.execute({command:'createClient',username:'test-device',password,roles:[{rolename:'test-device'}]});
  const d=await connect(url,{username:'test-device',password,clientId:'test-device'});clients.push(d);await subscribe(d,access.topics.command);
  const received=message(d,access.topics.command);await publish(c,access.topics.command,{commandId:'cmd-1',command:'set',payload:{on:true}});assert.equal((await received).commandId,'cmd-1');
  const ack=message(c,access.topics.ack);await publish(d,access.topics.ack,{commandId:'cmd-1',success:true});assert.equal((await ack).success,true);
  const state=message(v,view.topics.state);await publish(d,view.topics.state,{on:true});assert.equal((await state).on,true);
  await assert.rejects(publish(v,view.topics.command,{command:'set'}));
  await assert.rejects(publish(c,view.topics.state,{on:false}));
  console.log('PASS direct app command → device → acknowledgement and viewer state; publish denials');
  await api(viewer,'DELETE','/'+access.sessionId,404);
  const rotated=await api(owner,'POST','/'+access.sessionId+'/renew');
  await delay(30);assert.equal(c.connected,false,'old live connection must close');
  await assert.rejects(connect(url,access));const r=await connect(url,rotated);clients.push(r);
  await MqttAccess.updateOne({_id:rotated.sessionId},{$set:{expiresAt:new Date(0)}});await guard.tick();await delay(30);assert.equal(r.connected,false,'expired live connection must close');await assert.rejects(connect(url,rotated));
  await DeviceShare.updateOne({_id:share._id},{$set:{status:'revoked'}});await guard.tick();await delay(30);assert.equal(v.connected,false,'revoked live connection must close');await assert.rejects(connect(url,view));
  await api(viewer,'POST','',403);
  console.log('PASS owner-only session management, rotation, expiry and share revocation');
  const active=await api(owner,'POST');const a=await connect(url,active);clients.push(a);
  await guard.start();await assert.rejects(connect(url,active));
  const left=await admin.execute({command:'listClients',verbose:false});assert.ok(left.clients.includes('test-device'));assert.ok(!left.clients.some(n=>n.startsWith('archid-app-')));
  console.log('PASS guard restart purges app sessions and preserves device credentials');
  // Run the committed Phase 10 Postman collection against this same isolated broker/API.
  const bcrypt=require('bcryptjs');const newman=require('newman');
  await User.create({name:'Postman Admin',email:'postman-admin@example.com',mobile:'9000000009',password:await bcrypt.hash(password,10),role:'super_admin'});
  await guard.tick();
  const summary=await new Promise((resolve,reject)=>newman.run({collection:require('../postman/phase-10-direct-mqtt.postman_collection.json'),environment:{values:[
    {key:'baseUrl',value:`http://127.0.0.1:${server.address().port}`},
    {key:'superAdminIdentifier',value:'postman-admin@example.com'},
    {key:'superAdminPassword',value:password}
  ]},reporters:[]},(err,result)=>err?reject(err):resolve(result)));
  for(const f of summary.run.failures)console.error(f.source.name,f.error.message);
  assert.equal(summary.run.failures.length,0,'Phase 10 Postman failures');
  console.log(`PASS Phase 10 Postman: ${summary.run.stats.requests.total} requests, ${summary.run.stats.assertions.total} assertions`);
  console.log('All real Mosquitto Dynamic Security integration checks passed.');
 } finally {
  for(const c of clients)c.end(true);
  if(server)await new Promise(r=>server.close(r));
  await mongoose.disconnect();if(mongo)await mongo.stop();
  if(broker&&broker.exitCode===null){broker.kill('SIGTERM');await new Promise(r=>broker.once('exit',r));}
  fs.rmSync(temp,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
