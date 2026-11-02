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

// GET /api/admin/dashboard  -> headline counts.
// Definitions (kept consistent with the reports below):
//   pendingRequests    requests still awaiting review
//   activeListings     non-deleted items that are still open or reserved
//   lostReports        ALL submitted lost reports (ItemRequest)
//   foundReports       ALL submitted found reports (ItemRequest)
//   pendingClaims      claims still awaiting a decision
//   itemsAtHub         found items physically at the hub and not collected
//   awaitingReceipt    found items with no recorded physical receipt yet
//   completedHandovers claims completed after handover
//   totalUsers/adminUsers/normalUsers/activeUsers  user totals
router.get("/dashboard", async (req, res) => {
  try {
    const [
      pendingRequests,
      activeListings,
      lostReports,
      foundReports,
      pendingClaims,
      itemsAtHub,
      awaitingReceipt,
      completedHandovers,
      totalUsers,
      adminUsers,
      normalUsers,
      activeUsers,
    ] = await Promise.all([
      ItemRequest.countDocuments({ status: "pending" }),
      Item.countDocuments({
        isDeleted: false,
        status: { $in: ["open", "claimed"] },
      }),
      ItemRequest.countDocuments({ type: "lost" }),
      ItemRequest.countDocuments({ type: "found" }),
      ClaimRequest.countDocuments({ status: "pending" }),
      Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: false,
      }),
      ClaimRequest.countDocuments({ status: "completed" }),
      User.countDocuments({}),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ isActive: true }),
    ]);

    res.json({
      counts: {
        pendingRequests,
        activeListings,
        lostReports,
        foundReports,
        pendingClaims,
        itemsAtHub,
        awaitingReceipt,
        completedHandovers,
        totalUsers,
        adminUsers,
        normalUsers,
        activeUsers,
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
      report: rows.map((r) => ({
        type: r._id.type,
        status: r._id.status,
        count: r.count,
      })),
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
    const base = { type: "found", isDeleted: false };
    const [awaitingReceipt, stored, collected] = await Promise.all([
      Item.countDocuments({ ...base, hubReceived: false }),
      Item.countDocuments({
        ...base,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      Item.countDocuments({ ...base, status: "collected" }),
    ]);
    res.json({ report: { awaitingReceipt, stored, collected } });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

// GET /api/admin/reports/users
router.get("/reports/users", async (req, res) => {
  try {
    const [total, admins, normal, active, inactive] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
    ]);
    res.json({ report: { total, admins, normal, active, inactive } });
  } catch (error) {
    res.status(500).json({ message: "Could not load report" });
  }
});

module.exports = router;
