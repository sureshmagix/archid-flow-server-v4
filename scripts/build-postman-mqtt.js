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
fs.writeFileSync('postman/phase-10-direct-mqtt.postman_collection.json',JSON.stringify(c,null,2)+'\n');
console.log('Generated '+c.item.length+' Phase 10 requests');
