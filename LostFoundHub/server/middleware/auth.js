// middleware/auth.js
// Two small guards used by the routes:
//   protect     -> requires a valid login token, attaches req.user
//   requireAdmin-> requires req.user.role === "admin" (used after protect)
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  try {
    // Expect a header like: Authorization: Bearer <token>
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = header.split(" ")[1];

    // Verify the token signature and expiry.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load the real user from the database (never trust the token's contents).
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is inactive" });
    }

    req.user = user; // now available in every protected route
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin access only" });
}

module.exports = { protect, requireAdmin };
