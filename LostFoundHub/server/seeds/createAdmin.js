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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function run() {
  const name = (process.env.ADMIN_NAME || "").trim();
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!name || !email || !password) {
    console.error("Please set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD first.");
    process.exit(1);
  }
  if (!EMAIL_RE.test(email)) {
    console.error("ADMIN_EMAIL must be a valid email address.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }
  if (password.length > 72) {
    console.error("ADMIN_PASSWORD must be 72 characters or fewer.");
    process.exit(1);
  }

  try {
    await connectDB();

    const existing = await User.findOne({ email });
    // Hash every time so the environment variable always controls the account.
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing) {
      // If the account already exists, make sure it is an active admin and
      // that the password matches the seeded value.
      existing.name = name;
      existing.role = "admin";
      existing.isActive = true;
      existing.passwordHash = passwordHash;
      await existing.save();
      console.log(`Promoted/updated existing user ${email} as admin.`);
    } else {
      await User.create({
        name,
        email,
        passwordHash,
        role: "admin",
        isActive: true,
      });
      console.log(`Created admin account ${email}.`);
    }

    await mongoose.disconnect();
    console.log("Done.");
  } catch (error) {
    console.error("Could not seed the admin account:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

run();
