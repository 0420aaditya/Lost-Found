// middleware/upload.js
// Configures multer to save uploaded images into the uploads folder.
// The folder can be changed with the UPLOAD_DIR environment variable; on a
// production host it should point at persistent/durable storage.
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Default: server/uploads. A relative UPLOAD_DIR is resolved from server/.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(__dirname, "..", process.env.UPLOAD_DIR)
  : path.join(__dirname, "..", "uploads");

// Make sure the directory exists before multer tries to write into it.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Only these real image types are accepted. The extension is taken from the
// detected MIME type, never from the user's filename, so path traversal and
// dangerous extensions are impossible.
const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const random = crypto.randomBytes(16).toString("hex");
    cb(null, random + EXTENSIONS[file.mimetype]);
  },
});

function fileFilter(req, file, cb) {
  if (EXTENSIONS[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, png, gif, webp) are allowed"));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB, one file
});

// Read the first bytes of a file and return its real MIME type.
// This defeats uploads that merely pretend to be an image by sending a
// different filename or Content-Type.
async function detectImageType(filePath) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, 12, 0);
    if (bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (bytesRead >= 8 && buffer.subarray(0, 8).equals(pngSignature)) {
      return "image/png";
    }
    if (bytesRead >= 6 && buffer.subarray(0, 4).toString("ascii") === "GIF8") {
      return "image/gif";
    }
    if (
      bytesRead >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }
    return null;
  } finally {
    await handle.close();
  }
}

module.exports = { upload, detectImageType, UPLOAD_DIR };
