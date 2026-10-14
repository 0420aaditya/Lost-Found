// routes/admin.js
// Admin-only dashboard counters and simple reports.
const express = require("express");
const ItemRequest = require("../models/ItemRequest");
const Item = require("../models/Item");
const ClaimRequest = require("../models/ClaimRequest");
const User = require("../models/User");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Everything in this file requires an admin.
router.use(protect, requireAdmin);

// GET /api/admin/dashboard  -> a small set of headline counts.
router.get("/dashboard", async (req, res) => {
  try {
    const [
      pendingRequests,
      approvedListings,
      lostReports,
      foundReports,
      pendingClaims,
      itemsAtHub,
      completedHandovers,
      totalUsers,
    ] = await Promise.all([
      ItemRequest.countDocuments({ status: "pending" }),
      Item.countDocuments({ isDeleted: false }),
      Item.countDocuments({ type: "lost", isDeleted: false }),
      Item.countDocuments({ type: "found", isDeleted: false }),
      ClaimRequest.countDocuments({ status: "pending" }),
      Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      ClaimRequest.countDocuments({ status: "completed" }),
      User.countDocuments({}),
    ]);

    res.json({
      counts: {
        pendingRequests,
        approvedListings,
        lostReports,
        foundReports,
        pendingClaims,
        itemsAtHub,
        completedHandovers,
        totalUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load dashboard" });
  }
});

// GET /api/admin/reports/requests
router.get("/reports/requests", async (req, res) => {
  try {
    const rows = await ItemRequest.aggregate([
      { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } },
      { $sort: { "_id.type": 1, "_id.status": 1 } },
    ]);
    res.json({
      report: rows.map((r) => ({ type: r._id.type, status: r._id.status, count: r.count })),
    });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

// GET /api/admin/reports/claims
router.get("/reports/claims", async (req, res) => {
  try {
    const rows = await ClaimRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ report: rows.map((r) => ({ status: r._id, count: r.count })) });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

// GET /api/admin/reports/inventory
router.get("/reports/inventory", async (req, res) => {
  try {
    const [awaitingReceipt, stored, collected] = await Promise.all([
      Item.countDocuments({ type: "found", isDeleted: false, hubReceived: false }),
      Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      Item.countDocuments({ type: "found", isDeleted: false, status: "collected" }),
    ]);
    res.json({ report: { awaitingReceipt, stored, collected } });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

// GET /api/admin/reports/users
router.get("/reports/users", async (req, res) => {
  try {
    const [total, admins, normal, active] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ isActive: true }),
    ]);
    res.json({ report: { total, admins, normal, active } });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

module.exports = router;
