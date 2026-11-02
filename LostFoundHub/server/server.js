// server.js
// The main Express server: sets up middleware, connects MongoDB, serves
// uploaded images, mounts all API routes, and starts listening.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { UPLOAD_DIR } = require("./middleware/upload");
const authRoutes = require("./routes/auth");
const requestRoutes = require("./routes/requests");
const uploadRoutes = require("./routes/uploads");
const itemRoutes = require("./routes/items");
const claimRoutes = require("./routes/claims");
const adminRoutes = require("./routes/admin");
const statsRoutes = require("./routes/stats");

// Load the models so Mongoose registers them (used by later phases too).
require("./models/User");
require("./models/ItemRequest");
require("./models/Item");
require("./models/ClaimRequest");

// ---- configuration checks ----
// Fail fast (with a helpful message) instead of crashing on the first request.
function assertEnv() {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        "Copy server/.env.example to server/.env and fill them in."
    );
    process.exit(1);
  }
  const secret = process.env.JWT_SECRET;
  if (secret.length < 32 || /replace-this/i.test(secret)) {
    console.warn(
      "WARNING: JWT_SECRET looks short or like the example value. " +
        "Use a long random string in production."
    );
  }
}

const app = express();

// Do not advertise the framework.
app.disable("x-powered-by");
// Set TRUST_PROXY=true when running behind a reverse proxy so rate limiting
// and req.ip see the real client address.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// ---- security headers ----
// These are safe defaults for a JSON API that also serves uploaded images.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// ---- CORS ----
// Allow the React dev server (or the deployed frontend) to call this API.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

// Parse JSON bodies with a sane upper bound (images use multipart uploads).
app.use(express.json({ limit: "1mb" }));

// ---- simple in-memory rate limiter for authentication ----
// Prevents password guessing. It is intentionally small and resets on restart;
// a production deployment can replace it with a shared store.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return function rateLimiter(req, res, next) {
    if (process.env.NODE_ENV === "test") return next();
    const now = Date.now();
    const key = req.ip || "unknown";
    const record = hits.get(key);
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    record.count += 1;
    if (record.count > max) {
      res.setHeader("Retry-After", Math.ceil((record.resetAt - now) / 1000));
      return res.status(429).json({ message });
    }
    next();
  };
}

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many login attempts. Please try again later.",
  })
);

// Serve uploaded images from the configured upload directory at /uploads/<file>.
// dotfiles are denied so files like .gitkeep are never exposed.
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    index: false,
    dotfiles: "deny",
    maxAge: "1d",
  })
);

// ---- routes ----
// A simple health check so we can confirm the server is alive.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Lost & Found Hub API is running" });
});

// ---- API routes ----
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);

// ---- not found handler ----
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ---- central error handler ----
// Any error passed to next(error) ends up here. We log unexpected errors but
// never leak stack traces or database internals to the client.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Request body too large.
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }

  // Malformed JSON body.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON" });
  }

  // Multer upload errors.
  if (err.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({
      message: tooBig
        ? "Image is too large (maximum 5 MB)"
        : "Image upload failed. Please choose a valid image.",
    });
  }

  // File-filter rejection from middleware/upload.js.
  if (/^Only image/i.test(err.message || "")) {
    return res.status(400).json({ message: err.message });
  }

  // Mongoose validation errors (max length, required, enum, ...).
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || "Invalid input" });
  }

  // Mongoose cast errors (bad ObjectId, bad date, ...).
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid input" });
  }

  // Duplicate key (unique index).
  if (err.code === 11000) {
    return res.status(409).json({ message: "This record already exists" });
  }

  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server" });
});

// ---- start ----
// Exported so tests can start the app on an ephemeral port without the CLI.
async function start(port = process.env.PORT || 5000) {
  assertEnv();
  await connectDB();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`Server running on http://localhost:${actualPort}`);
      resolve(server);
    });
    server.on("error", reject);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Could not start server:", error.message);
    process.exit(1);
  });
}

module.exports = { app, start };
