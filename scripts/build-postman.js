// Source of the repeatable baseline. Generated files are committed for Postman import.
const fs = require("node:fs");
const items = [];
const capture = (key, expression) => `pm.collectionVariables.set(${JSON.stringify(key)}, ${expression});`;
function add(name, method, path, token, body, status = 200, tests = []) {
  const request = { method, header: [], url: '{{baseUrl}}' + path,
    auth: token ? { type: 'bearer', bearer: [{ key: 'token', value: `{{${token}}}`, type: 'string' }] } : { type: 'noauth' } };
  if (body) { request.header.push({ key: 'Content-Type', value: 'application/json' }); request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } }; }
  items.push({ name, request, event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
    `pm.test('HTTP ${status}', () => pm.response.to.have.status(${status}));`,
    'const json = pm.response.json();',
    `pm.test('Response envelope', () => pm.expect(json.success).to.eql(${status < 400}));`,
    ...tests
  ] } }] });
}
const user = (who, role = 'customer_control_user', company = '{{companyId}}') => ({ name: `Test ${who}`, email: `${who}.{{runId}}@example.com`, mobile: `{{${who}Mobile}}`, password: '{{testPassword}}', role, company });
add('01 Health', 'GET', '/health', null);
add('02 Login super admin', 'POST', '/api/v1/auth/login', null, { identifier: '{{superAdminIdentifier}}', password: '{{superAdminPassword}}' }, 200, [capture('adminToken', 'json.data.token')]);
items[0].event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: [
  'const id = Date.now().toString();', "pm.collectionVariables.set('runId', id);",
  "['customer','viewer','foreign'].forEach((name, i) => pm.collectionVariables.set(name + 'Mobile', '9' + id.slice(-8) + i));",
  "pm.collectionVariables.set('testPassword', pm.variables.replaceIn('T!{{$guid}}'));"
] } });
add('03 Create company', 'POST', '/api/v1/companies', 'adminToken', { name: 'Postman {{runId}}', code: 'PM_{{runId}}' }, 201, [capture('companyId', 'json.data.company._id')]);
add('04 Customer signup', 'POST', '/api/v1/auth/signup', null, { ...user('customer'), role: undefined, confirmPassword: '{{testPassword}}' }, 201, [capture('customerId', 'json.data.user._id')]);
add('05 Reject second company admin', 'POST', '/api/v1/auth/signup', null, { ...user('foreign'), role: undefined, confirmPassword: '{{testPassword}}' }, 400);
add('06 Login customer', 'POST', '/api/v1/auth/login', null, { identifier: 'customer.{{runId}}@example.com', password: '{{testPassword}}' }, 200, [capture('customerToken', 'json.data.token')]);
add('07 Current user', 'GET', '/api/v1/auth/me', 'customerToken');
add('08 Profile', 'GET', '/api/v1/profile', 'customerToken');
add('09 Update profile', 'PATCH', '/api/v1/profile', 'customerToken', { firstName: 'Postman', lastName: 'Tester' });
add('10 Reject profile privilege change', 'PATCH', '/api/v1/profile', 'customerToken', { profile: { role: 'super_admin' } }, 400);
add('11 Create view user', 'POST', '/api/v1/users', 'adminToken', user('viewer', 'customer_view_user'), 201, [capture('viewerId', 'json.data.user._id')]);
add('12 Login view user', 'POST', '/api/v1/auth/login', null, { identifier: 'viewer.{{runId}}@example.com', password: '{{testPassword}}' }, 200, [capture('viewerToken', 'json.data.token')]);
add('13 List users', 'GET', '/api/v1/users?page=1&limit=10', 'adminToken');
add('14 Get user', 'GET', '/api/v1/users/{{viewerId}}', 'adminToken');
add('15 Verify user', 'PATCH', '/api/v1/users/{{viewerId}}/verify', 'adminToken', { isVerified: true });
add('16 Block user', 'PATCH', '/api/v1/users/{{viewerId}}/status', 'adminToken', { accountStatus: 'blocked' }, 200, ["pm.test('Inactive stored', () => pm.expect(json.data.user.isActive).to.eql(false));"]);
add('17 Reject blocked token', 'GET', '/api/v1/auth/me', 'viewerToken', null, 403);
add('18 Reactivate user', 'PATCH', '/api/v1/users/{{viewerId}}/status', 'adminToken', { isActive: true });
add('19 Reject customer user management', 'GET', '/api/v1/users', 'customerToken', null, 403);
add('20 Create site', 'POST', '/api/v1/sites', 'customerToken', { name: 'Test Site', code: 'SITE_{{runId}}' }, 201, [capture('siteId', 'json.data.site._id')]);
add('21 List sites', 'GET', '/api/v1/sites', 'customerToken');
add('22 Get site', 'GET', '/api/v1/sites/{{siteId}}', 'customerToken');
add('23 Update site', 'PATCH', '/api/v1/sites/{{siteId}}', 'customerToken', { name: 'Updated Test Site' });
add('24 Create device type', 'POST', '/api/v1/device-types', 'adminToken', { name: 'Test Relay {{runId}}', category: 'relay', protocols: ['mqtt'], commandSchema: [{ command: 'set', label: 'Set relay', payloadSchema: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] } }] }, 201, [capture('deviceTypeId', 'json.data.deviceType._id')]);
add('25 List device types', 'GET', '/api/v1/device-types', 'customerToken');
add('26 Factory register', 'POST', '/api/v1/provisioning/factory-register', 'adminToken', { deviceType: '{{deviceTypeId}}', hardwareId: 'PM_{{runId}}', name: 'Test Relay' }, 201, [capture('deviceId', 'json.data.device._id'), capture('claimCode', 'json.data.claimCode')]);
add('27 Start QC', 'POST', '/api/v1/provisioning/devices/{{deviceId}}/qc/start', 'adminToken', {});
add('28 Record QC', 'POST', '/api/v1/provisioning/devices/{{deviceId}}/qc/result', 'adminToken', { qcStatus: 'passed', mqttConnected: true, heartbeatReceived: true, commandAckReceived: true, functionalTestPassed: true });
add('29 Reset provisioning', 'PATCH', '/api/v1/provisioning/devices/{{deviceId}}/reset-customer-provisioning', 'adminToken', {});
add('30 Claim preview', 'GET', '/api/v1/provisioning/claim-preview?hardwareId=PM_{{runId}}', 'customerToken');
add('31 Claim device', 'POST', '/api/v1/provisioning/claim', 'customerToken', { hardwareId: 'PM_{{runId}}', claimCode: '{{claimCode}}', displayName: 'My Relay', site: '{{siteId}}' });
add('32 Reject duplicate claim', 'POST', '/api/v1/provisioning/claim', 'customerToken', { hardwareId: 'PM_{{runId}}', claimCode: '{{claimCode}}', displayName: 'My Relay', site: '{{siteId}}' }, 409);
add('33 Activate device', 'PATCH', '/api/v1/provisioning/devices/{{deviceId}}/activate', 'customerToken', {});
add('34 List devices', 'GET', '/api/v1/devices', 'customerToken');
add('35 Get device', 'GET', '/api/v1/devices/{{deviceId}}', 'customerToken');
add('36 Reject unshared device', 'GET', '/api/v1/devices/{{deviceId}}', 'viewerToken', null, 403);
add('37 Share view access', 'POST', '/api/v1/device-sharing', 'customerToken', { device: '{{deviceId}}', sharedWith: '{{viewerId}}', permission: 'view' }, 201, [capture('shareId', 'json.data.share._id')]);
add('38 Shared device readable', 'GET', '/api/v1/devices/{{deviceId}}', 'viewerToken');
add('39 Reject view control', 'PATCH', '/api/v1/devices/{{deviceId}}/live-state', 'viewerToken', { liveState: { on: true } }, 403);
add('40 List shares', 'GET', '/api/v1/device-sharing?device={{deviceId}}', 'customerToken');
add('41 Get share', 'GET', '/api/v1/device-sharing/{{shareId}}', 'customerToken');
add('42 Update share', 'PATCH', '/api/v1/device-sharing/{{shareId}}', 'customerToken', { notes: 'Reviewed by Postman' });
add('43 Revoke share', 'DELETE', '/api/v1/device-sharing/{{shareId}}', 'customerToken', {});
add('44 Reject revoked access', 'GET', '/api/v1/devices/{{deviceId}}', 'viewerToken', null, 403);
add('45 MQTT runtime status', 'GET', '/api/v1/mqtt/status', 'adminToken');
add('46 Reject missing token', 'GET', '/api/v1/devices', null, null, 401);
add('47 Reject malformed ID', 'GET', '/api/v1/devices/not-an-id', 'customerToken', null, 400);
add('48 Create second company', 'POST', '/api/v1/companies', 'adminToken', { name: 'Other {{runId}}', code: 'OTHER_{{runId}}' }, 201, [capture('otherCompanyId', 'json.data.company._id')]);
add('49 Create other admin', 'POST', '/api/v1/users', 'adminToken', user('foreign', 'customer_admin', '{{otherCompanyId}}'), 201);
add('50 Login other admin', 'POST', '/api/v1/auth/login', null, { identifier: 'foreign.{{runId}}@example.com', password: '{{testPassword}}' }, 200, [capture('foreignToken', 'json.data.token')]);
for (const [suffix, body] of [['', { name: 'Forbidden' }], ['/status', { operationalStatus: 'inactive' }], ['/connection', { connectionStatus: 'online' }], ['/live-state', { liveState: { on: true } }]]) add('Reject cross-company update ' + suffix, 'PATCH', '/api/v1/devices/{{deviceId}}' + suffix, 'foreignToken', body, 403);
const collection = { info: { name: 'Archid Flow V4 — Phase 09 baseline', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run in order against a disposable test database. Creates test records; does not clean an existing database. QC values are simulated REST inputs, not a hardware test.' }, item: items, variable: [] };
fs.writeFileSync('postman/phase-09-baseline.postman_collection.json', JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync('postman/local.postman_environment.json', JSON.stringify({ name: 'Archid Flow V4 Local Test', values: [ ['baseUrl','http://127.0.0.1:4000'], ['superAdminIdentifier',''], ['superAdminPassword',''] ].map(([key,value]) => ({ key,value,enabled:true,type: key.includes('Password') ? 'secret':'default' })), _postman_variable_scope: 'environment' }, null, 2) + '\n');
console.log(`Generated ${items.length} baseline requests`);
