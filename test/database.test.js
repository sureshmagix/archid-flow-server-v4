const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/modules/users/user.model');
const { Device } = require('../src/modules/devices/device.model');
test('Database enforces one company admin and rejects concurrent device saves', async () => {
  const mongo = await MongoMemoryServer.create({instance:{args:['--nounixsocket']}});
  try {
    await mongoose.connect(mongo.getUri('archid_regression'));
    await User.init();
    const company = new mongoose.Types.ObjectId();
    const data = {name:'Test',password:'test',role:'customer_admin',company};
    const results = await Promise.allSettled([
      User.create({...data,email:'a@example.com',mobile:'9000000001'}),
      User.create({...data,email:'b@example.com',mobile:'9000000002'})
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.code,11000);
    const d = await Device.create({name:'Relay',hardwareId:'TEST001',deviceType:new mongoose.Types.ObjectId(),protocol:'mqtt',provisioningStatus:'unclaimed'});
    const first = await Device.findById(d._id), second = await Device.findById(d._id);
    first.notes='first'; second.notes='second';
    await first.save();
    await assert.rejects(second.save(),{name:'VersionError'});
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
