// Read-only by default. --create adds declared User indexes, never drops indexes/data.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/modules/users/user.model');
(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
    await mongoose.connect(process.env.MONGODB_URI, {autoIndex:false});
    const duplicates = await User.aggregate([
      {$match:{role:'customer_admin',company:{$type:'objectId'}}},
      {$group:{_id:'$company',count:{$sum:1}}}, {$match:{count:{$gt:1}}}
    ]);
    console.log('Duplicate customer-admin company groups:', duplicates);
    if(duplicates.length) throw new Error('Resolve duplicate admins before creating the unique index. No data was modified.');
    if(process.argv.includes('--create')) await User.createIndexes();
    console.log(await User.collection.indexes());
  } finally { await mongoose.disconnect(); }
})().catch(e => {console.error(e.message);process.exitCode=1;});
