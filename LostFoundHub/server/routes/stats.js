// routes/stats.js
// Public, non-sensitive aggregate numbers used by the home page.
// No user identities or private claim data are exposed here.
const express = require("express");
const Item = require("../models/Item");

const router = express.Router();

// GET /api/stats
router.get("/", async (req, res) => {
  try {
    const base = { isDeleted: false };
    const [totalItems, lostItems, foundItems, reunited, atHub] =
      await Promise.all([
        Item.countDocuments(base),
        Item.countDocuments({ ...base, type: "lost" }),
        Item.countDocuments({ ...base, type: "found" }),
        Item.countDocuments({ ...base, status: "collected" }),
        Item.countDocuments({
          ...base,
          type: "found",
          hubReceived: true,
          status: { $ne: "collected" },
        }),
      ]);

    res.json({
      stats: { totalItems, lostItems, foundItems, reunited, atHub },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load statistics" });
  }
});

module.exports = router;
