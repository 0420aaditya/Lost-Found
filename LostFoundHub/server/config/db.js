// config/db.js
// Connects the Express app to MongoDB using Mongoose.
const mongoose = require("mongoose");

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Stop the server if the database is not reachable.
    process.exit(1);
  }
}

module.exports = connectDB;
