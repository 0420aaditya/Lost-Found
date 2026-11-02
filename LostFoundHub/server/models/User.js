// models/User.js
// A person using the system: either a normal "user" or an "admin".
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name is too long (max 80 characters)"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email is too long (max 254 characters)"],
    },
    // We store ONLY the bcrypt hash of the password, never the plain text.
    // "select: false" means this field is hidden from normal queries by default.
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // Lets an admin suspend an account later without deleting it.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Speeds up the admin user report counts.
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model("User", userSchema);
