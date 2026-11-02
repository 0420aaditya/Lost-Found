// routes/auth.js
// Register, log in, and "who am I".
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt only uses the first 72 bytes of a password; reject longer input so
// two different passwords cannot silently behave as the same one.
const MAX_PASSWORD_LENGTH = 72;

// Create a signed JWT that contains only the user's id.
function createToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// The shape we send to the client. It NEVER includes the password hash.
function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const body = req.body || {};
    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }
    if (name.length < 2 || name.length > 80) {
      return res
        .status(400)
        .json({ message: "Name must be 2 to 80 characters" });
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return res
        .status(400)
        .json({ message: "Please enter a valid email address" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ message: "Password must be 72 characters or fewer" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }

    // Hash the password. We never store the plain text.
    const passwordHash = await bcrypt.hash(password, 10);

    // IMPORTANT: the role is always "user" here. We never trust a role sent
    // by the client, otherwise anyone could register as an admin.
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "user",
      isActive: true,
    });

    const token = createToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (error) {
    // Duplicate email (unique index) just in case of a race.
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    if (error.name === "ValidationError") {
      const first = Object.values(error.errors)[0];
      return res.status(400).json({ message: first?.message || "Invalid input" });
    }
    res.status(500).json({ message: "Could not register. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const body = req.body || {};
    const email = text(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // passwordHash is hidden by default, so ask for it explicitly here.
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is inactive" });
    }

    const token = createToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Could not log in. Please try again." });
  }
});

// GET /api/auth/me  (used to restore the session after a page refresh)
router.get("/me", protect, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

module.exports = router;
