// routes/auth.js
// Register, log in, and "who am I".
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

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

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
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
    res.status(500).json({ message: "Could not register. Please try again." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // passwordHash is hidden by default, so ask for it explicitly here.
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash"
    );
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
