const mongoose = require('mongoose');
const path = require('path');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// dotenv v17+ uses populateProcessEnv
const { config } = require('dotenv');
config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  isActive: Boolean,
});

const User = mongoose.model('User', userSchema);

async function promoteToAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to DB');

    const email = 'it@buildwealthrealtors.com';

    // Check if user exists
    const existing = await User.findOne({ email });

    if (existing) {
      // User exists → promote to ADMIN
      const user = await User.findOneAndUpdate(
        { email },
        { role: 'ADMIN', isActive: true },
        { new: true }
      );
      console.log(`✅ Promoted ${user.name} (${user.email}) to ADMIN.`);
    } else {
      console.log(`⚠️  No user found with email: ${email}`);
      console.log('This is expected if the admin has never logged in via Google yet.');
      console.log('Once they sign in with Google for the first time, run this script again.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
}

promoteToAdmin();
