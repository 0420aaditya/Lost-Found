// seeds/createAdmin.js
// Creates (or promotes) the first administrator.
// Public registration can never choose the admin role, so the first admin is
// created here from environment variables that you set yourself.
//
// Usage (PowerShell):
//   $env:ADMIN_NAME="Site Admin"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="Admin123456"; npm run seed:admin
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function run() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error("Please set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD first.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    // If the account already exists, simply make sure it is an admin.
    existing.role = "admin";
    existing.isActive = true;
    await existing.save();
    console.log(`Promoted existing user ${email} to admin.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`Created admin account ${email}.`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run();
