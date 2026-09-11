// Starts its own disposable MongoDB and API; never reads a production DB URI.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const newman = require('newman');
const crypto = require('node:crypto');
async function main() {
  let mongo, server;
  try {
    mongo = await MongoMemoryServer.create({ instance: { args: ["--nounixsocket"] } });
    process.env.MONGODB_URI = mongo.getUri('archid_test');
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.NODE_ENV = 'test';
    const app = require('../src/app');
    await mongoose.connect(process.env.MONGODB_URI);
    await Promise.all(Object.values(mongoose.models).map(m => m.init()));
    const password = crypto.randomBytes(18).toString('hex');
    await require('../src/modules/users/user.model').create({name:'Test Admin',email:'admin@example.com',mobile:'9000000000',password:await bcrypt.hash(password,10),role:'super_admin'});
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const result = await new Promise((resolve, reject) => newman.run({
      collection: require('../postman/phase-09-baseline.postman_collection.json'),
      environment: { values: [
        {key:'baseUrl',value:`http://127.0.0.1:${server.address().port}`},
        {key:'superAdminIdentifier',value:'admin@example.com'},
        {key:'superAdminPassword',value:password}
      ] }, reporters: [], bail: false
    }, (err, summary) => err ? reject(err) : resolve(summary)));
    console.log(JSON.stringify(result.run.stats, null, 2));
    for (const failure of result.run.failures) console.error(failure.source.name, failure.error.message);
    if (result.run.failures.length) process.exitCode = 1;
  } finally {
    if(server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    if(mongo) await mongo.stop();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
