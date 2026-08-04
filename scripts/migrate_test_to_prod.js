const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrateData() {
  try {
    console.log('Connecting to MongoDB Atlas Cluster...');
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const client = conn.connection.client;
    const testDb = client.db('test');
    const prodDb = client.db('bwr_production');

    const collectionsToMigrate = [
      'users',
      'properties',
      'inquiries',
      'favorites',
      'teammembers',
      'jobs',
      'reels',
      'auditlogs',
    ];

    for (const colName of collectionsToMigrate) {
      const srcCol = testDb.collection(colName);
      const destCol = prodDb.collection(colName);

      const docs = await srcCol.find({}).toArray();
      if (docs.length > 0) {
        await destCol.deleteMany({}); // Wipe any empty/dummy data in prod
        await destCol.insertMany(docs); // Insert all 23 real properties and 5 real users
        console.log(`✅ Successfully migrated ${docs.length} documents into bwr_production.${colName}`);
      } else {
        console.log(`ℹ️ Collection ${colName} is empty in source DB.`);
      }
    }
    console.log('🎉 Migration finished! All real production data is now active in bwr_production.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }
}

migrateData();
