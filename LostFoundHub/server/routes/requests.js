// routes/requests.js
// Lost/Found entry requests and the admin approval workflow.
const express = require("express");
const mongoose = require("mongoose");
const ItemRequest = require("../models/ItemRequest");
const Item = require("../models/Item");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Small helper to make sure a string is a real Mongo id.
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// POST /api/requests  (logged in)
// A user submits a new Lost or Found request. It always starts as "pending".
router.post("/", protect, async (req, res) => {
  try {
    const {
      type,
      itemName,
      category,
      description,
      dateLostOrFound,
      locationLostOrFound,
      imageUrl,
      additionalDetails,
    } = req.body;

    if (
      !type ||
      !itemName ||
      !category ||
      !description ||
      !dateLostOrFound ||
      !locationLostOrFound
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields" });
    }
    if (!["lost", "found"].includes(type)) {
      return res.status(400).json({ message: "Type must be lost or found" });
    }

    const request = await ItemRequest.create({
      userId: req.user._id, // owner comes from the token, never the body
      type,
      itemName,
      category,
      description,
      dateLostOrFound,
      locationLostOrFound,
      imageUrl: imageUrl || "",
      additionalDetails: additionalDetails || "",
      status: "pending",
    });

    res.status(201).json({ request });
  } catch (error) {
    res.status(500).json({ message: "Could not create request" });
  }
});

// GET /api/requests/my  (logged in)
// The current user's own requests, newest first.
router.get("/my", protect, async (req, res) => {
  try {
    const requests = await ItemRequest.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Could not load your requests" });
  }
});

// GET /api/requests?type=lost&status=pending  (admin only)
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const { type, status } = req.query;
    const filter = {};
    if (type && ["lost", "found"].includes(type)) filter.type = type;
    if (status && ["pending", "approved", "rejected", "cancelled"].includes(status)) {
      filter.status = status;
    }

    const requests = await ItemRequest.find(filter)
      .populate("userId", "name email")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Could not load requests" });
  }
});

// GET /api/requests/:id  (owner or admin only)
router.get("/:id", protect, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await ItemRequest.findById(req.params.id)
      .populate("userId", "name email")
      .populate("reviewedBy", "name")
      .populate("approvedItemId");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const isOwner = request.userId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "You cannot view this request" });
    }

    res.json({ request });
  } catch (error) {
    res.status(500).json({ message: "Could not load request" });
  }
});

// PATCH /api/requests/:id/approve  (admin only)
// Approves a pending request and creates exactly ONE official Item.
router.patch("/:id/approve", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await ItemRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    // Duplicate-approval protection.
    if (request.status === "approved") {
      return res.status(400).json({
        message: "This request was already approved",
        itemId: request.approvedItemId,
      });
    }
    // Only pending requests can be approved (rejected ones cannot be revived).
    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending requests can be approved" });
    }

    // Create the official item. The unique index on sourceRequestId is a second
    // safety net against creating two items for the same request.
    let item;
    try {
      item = await Item.create({
        sourceRequestId: request._id,
        reportedBy: request.userId,
        type: request.type,
        itemName: request.itemName,
        category: request.category,
        description: request.description,
        dateLostOrFound: request.dateLostOrFound,
        locationLostOrFound: request.locationLostOrFound,
        imageUrl: request.imageUrl,
        status: "open",
        hubReceived: false,
      });
    } catch (error) {
      if (error.code === 11000) {
        const existing = await Item.findOne({ sourceRequestId: request._id });
        return res.status(400).json({
          message: "This request was already approved",
          itemId: existing ? existing._id : undefined,
        });
      }
      throw error;
    }

    // Record the approval on the request.
    request.status = "approved";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.approvedItemId = item._id;
    request.rejectionReason = "";
    await request.save();

    res.json({ request, item });
  } catch (error) {
    res.status(500).json({ message: "Could not approve request" });
  }
});

// PATCH /api/requests/:id/reject  (admin only)  body: { reason }
router.patch("/:id/reject", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "A rejection reason is required" });
    }

    const request = await ItemRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (request.status === "rejected") {
      return res.status(400).json({ message: "This request was already rejected" });
    }
    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Only pending requests can be rejected" });
    }

    request.status = "rejected";
    request.rejectionReason = reason.trim();
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    res.json({ request });
  } catch (error) {
    res.status(500).json({ message: "Could not reject request" });
  }
});

module.exports = router;
