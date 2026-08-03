const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
});

const User = mongoose.model('User', userSchema);

async function checkAgents() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");

    const agents = await User.find({ role: 'AGENT' });
    console.log(`Found ${agents.length} agents:`);
    agents.forEach(a => console.log(`- ${a.name} (${a.email}) [${a.role}]`));
    
    const allUsers = await User.find({});
    console.log(`\nTotal Users: ${allUsers.length}`);
    allUsers.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.role}]`));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkAgents();
