// routes/uploads.js
// A tiny endpoint that receives one image and returns its public URL.
// The client uploads the image first, then submits the request with imageUrl.
const express = require("express");
const fs = require("fs");
const { upload, detectImageType } = require("../middleware/upload");
const { protect } = require("../middleware/auth");

const router = express.Router();

// POST /api/uploads  (logged in)  form field name: "image"
router.post("/", protect, upload.single("image"), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  try {
    // Verify the bytes really are an image of the declared type.
    const detected = await detectImageType(req.file.path);
    if (!detected || detected !== req.file.mimetype) {
      // Remove the rejected file so it cannot linger in storage.
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        message: "The uploaded file is not a valid JPG, PNG, GIF or WebP image",
      });
    }

    // This path can be shown by the browser as http://localhost:5000 + imageUrl
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({
      imageUrl,
      size: req.file.size,
      mimetype: detected,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
