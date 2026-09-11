require('./build-postman');
const fs=require('node:fs');
const c=JSON.parse(fs.readFileSync('postman/phase-09-baseline.postman_collection.json'));
c.info.name='Archid Flow V4 — Phase 10 direct MQTT access';
c.info.description+=' Requires a configured test Dynamic Security broker and running guard. This collection checks access lifecycle APIs; npm run test:mqtt additionally checks broker packet permissions.';
function add(name,method,suffix,token,status=201,tests=[]){
 c.item.push({name,request:{method,url:'{{baseUrl}}/api/v1/devices/{{deviceId}}/mqtt-access'+suffix,
  header:[{key:'Content-Type',value:'application/json'}],auth:{type:'bearer',bearer:[{key:'token',value:'{{'+token+'}}',type:'string'}]},
  ...(method==='POST'?{body:{mode:'raw',raw:'{}'}}:{})},event:[{listen:'test',script:{type:'text/javascript',exec:[
  `pm.test('HTTP ${status}',()=>pm.response.to.have.status(${status}));`,
  'const json=pm.response.json();',`pm.test('Envelope',()=>pm.expect(json.success).to.eql(${status<400}));`,...tests
 ]}}]});
}
const save=["pm.collectionVariables.set('mqttSessionId',json.data.access.sessionId);",
 "pm.collectionVariables.set('mqttUsername',json.data.access.username);",
 "pm.collectionVariables.set('mqttPassword',json.data.access.password);",
 "pm.collectionVariables.set('mqttClientId',json.data.access.clientId);",
 "pm.collectionVariables.set('mqttBrokerUrl',json.data.access.brokerUrl);",
 "pm.collectionVariables.set('mqttCommandTopic',json.data.access.topics.command);",
 "pm.collectionVariables.set('mqttStateTopic',json.data.access.topics.state);",
 "pm.collectionVariables.set('mqttTelemetryTopic',json.data.access.topics.telemetry);",
 "pm.collectionVariables.set('mqttAckTopic',json.data.access.topics.ack);",
 "pm.collectionVariables.set('mqttHeartbeatTopic',json.data.access.topics.heartbeat);",
 "pm.test('No-store credentials',()=>pm.expect(pm.response.headers.get('Cache-Control')).to.eql('no-store'));",
 "pm.test('Scoped command access',()=>pm.expect(json.data.access.publish).to.eql([json.data.access.topics.command]));"];
add('55 Grant customer direct access','POST','','customerToken',201,save);
add('56 Reject another company','POST','','foreignToken',403);
add('57 Reject revoked viewer share','POST','','viewerToken',403);
add('58 Reject another user managing session','DELETE','/{{mqttSessionId}}','foreignToken',404);
add('59 Rotate MQTT session','POST','/{{mqttSessionId}}/renew','customerToken',201,save);
add('60 Revoke MQTT session','DELETE','/{{mqttSessionId}}','customerToken',200);
add('61 Revoke again is idempotent','DELETE','/{{mqttSessionId}}','customerToken',200,[
 "['mqttPassword','mqttUsername','mqttClientId'].forEach(key=>pm.collectionVariables.unset(key));"
]);

function http(name,method,path,token,body,status=200,tests=[]){
 const request={method,url:'{{baseUrl}}'+path,header:[],auth:token?{type:'bearer',bearer:[{key:'token',value:'{{'+token+'}}',type:'string'}]}:{type:'noauth'}};
 if(body){request.header.push({key:'Content-Type',value:'application/json'});request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};}
 return {name,request,event:[{listen:'test',script:{type:'text/javascript',exec:[
  `pm.test('HTTP ${status}',()=>pm.response.to.have.status(${status}));`,
  'const json=pm.response.json();',`pm.test('Envelope',()=>pm.expect(json.success).to.eql(${status<400}));`,...tests
 ]}}]};
}
const byName=new Map(c.item.map(item=>[item.name,item]));
const take=(...names)=>names.map(name=>{
 const item=byName.get(name);if(!item)throw new Error('Missing generated request: '+name);return item;
});
const saveVar=(key,expression)=>`pm.collectionVariables.set(${JSON.stringify(key)},${expression});`;

// The setup creates the company required by customer signup. This reflects the
// current API dependency and keeps every later phase runnable in one pass.
const setup=take('01 Health','02 Login super admin','03 Create company');
const phase01=[http('01.1 API root','GET','/',null)];
const phase02=take('04 Customer signup','05 Reject second company admin','06 Login customer','07 Current user');
const phase03=take('08 Profile','09 Update profile','10 Reject profile privilege change','11 Create view user','12 Login view user','13 List users','14 Get user','15 Verify user','16 Block user','17 Reject blocked token','18 Reactivate user','19 Reject customer user management');
const phase04=[
 http('04.1 List companies','GET','/api/v1/companies','customerToken'),
 http('04.2 Get own company','GET','/api/v1/companies/{{companyId}}','customerToken'),
 http('04.3 Update company','PATCH','/api/v1/companies/{{companyId}}','adminToken',{notes:'Updated by Phase 04 Postman test'}),
 ...take('20 Create site','21 List sites','22 Get site','23 Update site','48 Create second company','49 Create other admin','50 Login other admin')
];
const phase05=[
 ...take('24 Create device type','25 List device types'),
 http('05.3 Get device type','GET','/api/v1/device-types/{{deviceTypeId}}','customerToken'),
 http('05.4 Update device type','PATCH','/api/v1/device-types/{{deviceTypeId}}','adminToken',{description:'Updated by Phase 05 Postman test'})
];
const phase06=[
 http('06.1 Create inventory device','POST','/api/v1/devices','customerToken',{
  name:'Inventory Relay',deviceCode:'INV_{{runId}}',hardwareId:'INV_{{runId}}',
  deviceType:'{{deviceTypeId}}',site:'{{siteId}}',owner:'{{customerId}}'
 },201,[saveVar('inventoryDeviceId','json.data.device._id')]),
 http('06.2 List devices','GET','/api/v1/devices','customerToken'),
 http('06.3 Get inventory device','GET','/api/v1/devices/{{inventoryDeviceId}}','customerToken'),
 http('06.4 Update inventory device','PATCH','/api/v1/devices/{{inventoryDeviceId}}','customerToken',{displayName:'Updated Inventory Relay'}),
 http('06.5 Update operational status','PATCH','/api/v1/devices/{{inventoryDeviceId}}/status','customerToken',{operationalStatus:'inactive'}),
 ...take('Reject cross-company update ','Reject cross-company update /status','Reject cross-company update /connection','Reject cross-company update /live-state').map(item=>{
  item.request.url=item.request.url.replace('{{deviceId}}','{{inventoryDeviceId}}');return item;
 })
];
const phase07=take('26 Factory register','27 Start QC','28 Record QC','29 Reset provisioning','30 Claim preview','31 Claim device','32 Reject duplicate claim','33 Activate device','34 List devices','35 Get device');
const phase08=take('36 Reject unshared device','37 Share view access','38 Shared device readable','39 Reject view control','40 List shares','41 Get share','42 Update share','43 Revoke share','44 Reject revoked access');
const phase09=take('45 MQTT runtime status');
const phase10=take('55 Grant customer direct access','56 Reject another company','57 Reject revoked viewer share','58 Reject another user managing session','59 Rotate MQTT session','60 Revoke MQTT session','61 Revoke again is idempotent');
const negative=take('46 Reject missing token','47 Reject malformed ID');

c.item=[
 {name:'00 Test setup',description:'Initializes run variables, authenticates the seeded super admin, and creates the company required by signup.',item:setup},
 {name:'Phase 01 — Bootstrap',item:phase01},
 {name:'Phase 02 — Authentication',item:phase02},
 {name:'Phase 03 — Users and Profile',item:phase03},
 {name:'Phase 04 — Companies and Sites',item:phase04},
 {name:'Phase 05 — Device Types',item:phase05},
 {name:'Phase 06 — Device Inventory',item:phase06},
 {name:'Phase 07 — Provisioning',item:phase07},
 {name:'Phase 08 — Sharing and Permissions',item:phase08},
 {name:'Phase 09 — MQTT Core',description:'Checks backend MQTT runtime status. Use the manual MQTT procedure for packet flow.',item:phase09},
 {name:'Phase 10 — Direct MQTT Access',description:'Tests grant, isolation, rotation, and revocation APIs. Requires Dynamic Security and a healthy access guard.',item:phase10},
 {name:'Common negative validation',item:negative}
];
const total=c.item.reduce((sum,folder)=>sum+folder.item.length,0);
fs.writeFileSync('postman/phase-10-direct-mqtt.postman_collection.json',JSON.stringify(c,null,2)+'\n');
console.log('Generated '+total+' Phase 01–10 requests in '+c.item.length+' folders');
