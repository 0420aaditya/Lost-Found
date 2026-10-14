// routes/uploads.js
// A tiny endpoint that receives one image and returns its public URL.
// The client uploads the image first, then submits the request with imageUrl.
const express = require("express");
const upload = require("../middleware/upload");
const { protect } = require("../middleware/auth");

const router = express.Router();

// POST /api/uploads  (logged in)  form field name: "image"
router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }
  // This path can be shown by the browser as http://localhost:5000 + imageUrl
  const imageUrl = `/uploads/${req.file.filename}`;
  res.status(201).json({ imageUrl });
});

module.exports = router;
