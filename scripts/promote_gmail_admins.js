const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function promoteAdmins() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const usersCol = mongoose.connection.db.collection('users');

    const targetEmails = [
      'it.buildwealthrealtors@gmail.com',
      'sumitsha1056@gmail.com',
      'it@buildwealthrealtors.com',
    ];

    const result = await usersCol.updateMany(
      { email: { $in: targetEmails } },
      { $set: { role: 'ADMIN', isActive: true } }
    );

    console.log(`✅ Promoted ${result.modifiedCount || result.matchedCount} accounts to ADMIN role!`);

    const adminUsers = await usersCol.find({ role: 'ADMIN' }).toArray();
    console.log('=== CURRENT ACTIVE ADMIN USERS ===');
    console.log(adminUsers.map((u) => ({ email: u.email, role: u.role, name: u.name })));
  } catch (err) {
    console.error('❌ Error promoting admin users:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB Atlas.');
  }
}

promoteAdmins();
