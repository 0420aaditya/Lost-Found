// config/db.js
// Connects the Express app to MongoDB using Mongoose.
const mongoose = require("mongoose");

async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
    );
    return conn;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Let the caller decide whether to exit (server) or report (scripts/tests).
    throw error;
  }
}

module.exports = connectDB;
