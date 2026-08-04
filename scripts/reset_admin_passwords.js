const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function resetAdminPasswords() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas');

    const usersCol = mongoose.connection.db.collection('users');

    const hashedPassword = await bcrypt.hash('AdminPassword@2026', 10);

    const adminEmails = [
      'it.buildwealthrealtors@gmail.com',
      'sumitsha1056@gmail.com',
      'it@buildwealthrealtors.com',
    ];

    const res = await usersCol.updateMany(
      { email: { $in: adminEmails } },
      {
        $set: {
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          authProvider: 'LOCAL',
        },
      }
    );

    console.log(`✅ Reset password for ${res.modifiedCount || res.matchedCount} Admin accounts!`);
    console.log('🔑 You can now log in directly with:');
    console.log('   Email: it.buildwealthrealtors@gmail.com OR sumitsha1056@gmail.com');
    console.log('   Password: AdminPassword@2026');
  } catch (err) {
    console.error('❌ Error resetting passwords:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
}

resetAdminPasswords();
