const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`
╔════════════════════════════════════════╗
║   ✅ MongoDB Connected Successfully!   ║
║   Host: ${conn.connection.host.padEnd(25)}║
║   DB: ${conn.connection.name.padEnd(27)}║
╚════════════════════════════════════════╝
    `);
  } catch (error) {
    console.error(`
╔════════════════════════════════════════╗
║   ❌ MongoDB Connection Failed!        ║
║   Error: ${error.message.substring(0, 25).padEnd(25)}║
╚════════════════════════════════════════╝
    `);
    process.exit(1);
  }
};

module.exports = connectDB;