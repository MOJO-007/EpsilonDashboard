const mongoose = require('mongoose');
require('dotenv').config();  // ensure env vars loaded

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}
console.log('🌐 Connecting to MongoDB Atlas...');

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,  // 15 sec to find a server
  socketTimeoutMS: 20000,           // 20 sec socket timeout
})
.then(() => {
  console.log('✅ MongoDB connection established');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1); // Exit app on failure
});

// Optional: Handle connection errors after initial connect
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err.message);
});

module.exports = mongoose;