// server.js
// The main Express server: sets up middleware, connects MongoDB, serves
// uploaded images, mounts all API routes, and starts listening.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const requestRoutes = require("./routes/requests");
const uploadRoutes = require("./routes/uploads");
const itemRoutes = require("./routes/items");
const claimRoutes = require("./routes/claims");
const adminRoutes = require("./routes/admin");

// Load the models so Mongoose registers them (used by later phases too).
require("./models/User");
require("./models/ItemRequest");
require("./models/Item");
require("./models/ClaimRequest");

const app = express();

// ---- middleware ----
// Allow the React dev server to call this API.
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);
// Parse incoming JSON request bodies.
app.use(express.json());

// Serve uploaded images from ./uploads at the URL /uploads/<filename>.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

// ---- not found handler ----
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ---- central error handler ----
// Any error passed to next(error) ends up here. We log it but never leak
// internal details (like stack traces) to the client.
app.use((err, req, res, next) => {
  console.error(err);
  // Turn upload problems (bad type / too big) into a friendly 400.
  if (err.name === "MulterError" || err.message.startsWith("Only image")) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: "Something went wrong on the server" });
});

// ---- start ----
const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
