const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/modules/users/user.model');
const { parseDeviceTopic, buildDeviceBaseTopic } = require('../src/modules/mqtt/mqtt.topics');
const { handleMqttMessage } = require('../src/modules/mqtt/mqtt.messageHandler');
test('Mongoose 9 validates canonical user and rejects admin without company', async () => {
  const input = {name:'Test',email:'test@example.com',mobile:'9000000000',password:'test'};
  await new User({...input,role:'super_admin'}).validate();
  await assert.rejects(new User({...input,role:'customer_admin'}).validate(), /Company is required/);
  assert.equal(require('../src/models/User'), User);
});
test('Topic builder rejects wildcard hardware IDs and parser rejects empty segments', () => {
  assert.throws(() => buildDeviceBaseTopic({hardwareId:'A/+'}));
  assert.equal(parseDeviceTopic('archid/v4//devices/relay/TEST01/state').isValid,false);
  assert.equal(parseDeviceTopic('archid/v4/devices/relay/TEST01/state').isValid,true);
});
test('Malformed and retained MQTT messages never mark a device online', async () => {
  const topic='archid/v4/devices/relay/TEST01/state';
  assert.equal((await handleMqttMessage({topic,message:Buffer.from('{'),packet:{}})).reason,'INVALID_JSON');
  assert.equal((await handleMqttMessage({topic,message:Buffer.from('{}'),packet:{retain:true}})).reason,'RETAINED_SNAPSHOT');
});
