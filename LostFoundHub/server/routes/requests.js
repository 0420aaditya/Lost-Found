// routes/requests.js
// Lost/Found entry requests and the admin approval workflow.
const express = require("express");
const mongoose = require("mongoose");
const ItemRequest = require("../models/ItemRequest");
const Item = require("../models/Item");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Small helpers to keep validation explicit and safe.
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Uploaded images must be paths created by our own upload endpoint. Rejecting
// arbitrary URLs prevents remote tracking images and unsafe schemes.
const IMAGE_URL_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;
function normalizeImageUrl(raw) {
  const url = text(raw);
  if (!url) return "";
  return IMAGE_URL_RE.test(url) ? url : null;
}

// POST /api/requests  (logged in)
// A user submits a new Lost or Found request. It always starts as "pending".
router.post("/", protect, async (req, res) => {
  try {
    const body = req.body || {};
    const type = text(body.type);
    const itemName = text(body.itemName);
    const category = text(body.category);
    const description = text(body.description);
    const locationLostOrFound = text(body.locationLostOrFound);
    const additionalDetails = text(body.additionalDetails);
    const imageUrl = normalizeImageUrl(body.imageUrl);

    if (
      !type ||
      !itemName ||
      !category ||
      !description ||
      !body.dateLostOrFound ||
      !locationLostOrFound
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields" });
    }
    if (!["lost", "found"].includes(type)) {
      return res.status(400).json({ message: "Type must be lost or found" });
    }
    if (itemName.length < 2 || itemName.length > 120) {
      return res
        .status(400)
        .json({ message: "Item name must be 2 to 120 characters" });
    }
    if (category.length > 60) {
      return res
        .status(400)
        .json({ message: "Category is too long (max 60 characters)" });
    }
    if (description.length < 5) {
      return res
        .status(400)
        .json({ message: "Description must be at least 5 characters" });
    }
    if (description.length > 3000) {
      return res
        .status(400)
        .json({ message: "Description is too long (max 3000 characters)" });
    }
    if (locationLostOrFound.length < 2 || locationLostOrFound.length > 200) {
      return res
        .status(400)
        .json({ message: "Location must be 2 to 200 characters" });
    }
    if (additionalDetails.length > 2000) {
      return res
        .status(400)
        .json({ message: "Additional details are too long (max 2000 characters)" });
    }
    if (imageUrl === null) {
      return res
        .status(400)
        .json({ message: "Image must be uploaded through the app" });
    }

    const dateLostOrFound = new Date(body.dateLostOrFound);
    if (Number.isNaN(dateLostOrFound.getTime())) {
      return res.status(400).json({ message: "A valid date is required" });
    }

    const request = await ItemRequest.create({
      userId: req.user._id, // owner comes from the token, never the body
      type,
      itemName,
      category,
      description,
      dateLostOrFound,
      locationLostOrFound,
      imageUrl,
      additionalDetails,
      status: "pending",
    });

    res.status(201).json({ request });
  } catch (error) {
    if (error.name === "ValidationError") {
      const first = Object.values(error.errors)[0];
      return res.status(400).json({ message: first?.message || "Invalid input" });
    }
    res.status(500).json({ message: "Could not create request" });
  }
});

// GET /api/requests/my  (logged in)
// The current user's own requests, newest first.
router.get("/my", protect, async (req, res) => {
  try {
    const requests = await ItemRequest.find({ userId: req.user._id }).sort({
      createdAt: -1,
      _id: -1,
    });
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Could not load your requests" });
  }
});

// GET /api/requests?type=lost&status=pending  (admin only)
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const type = text(req.query.type);
    const status = text(req.query.status);
    const filter = {};

    if (type) {
      if (!["lost", "found"].includes(type)) {
        return res.status(400).json({ message: "Invalid type filter" });
      }
      filter.type = type;
    }
    if (status) {
      if (!["pending", "approved", "rejected", "cancelled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      filter.status = status;
    }

    const requests = await ItemRequest.find(filter)
      .populate("userId", "name email")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1, _id: -1 });

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
// The status change is an atomic conditional update so two concurrent approvals
// cannot both proceed, and a retry after a partial failure self-heals.
router.patch("/:id/approve", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid request id" });
    }

    const request = await ItemRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          rejectionReason: "",
        },
      },
      { new: true }
    );

    if (!request) {
      const existing = await ItemRequest.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (existing.status === "approved") {
        return res.status(409).json({
          message: "This request was already approved",
          itemId: existing.approvedItemId,
        });
      }
      return res
        .status(409)
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
        // The item already exists (a previous attempt succeeded). Finish the
        // request half of the flow so it is no longer stuck as "approved"
        // without an item.
        const existingItem = await Item.findOne({
          sourceRequestId: request._id,
        });
        if (existingItem) {
          request.approvedItemId = existingItem._id;
          await request.save();
          return res.json({ request, item: existingItem });
        }
      }

      // Roll back the status change so the admin can try again later.
      await ItemRequest.updateOne(
        {
          _id: request._id,
          status: "approved",
          approvedItemId: null,
        },
        {
          $set: { status: "pending" },
          $unset: { reviewedBy: 1, reviewedAt: 1 },
        }
      ).catch(() => {});

      throw error;
    }

    // Record the approval item id on the request.
    request.approvedItemId = item._id;
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

    const reason = text((req.body || {}).reason);
    if (!reason) {
      return res.status(400).json({ message: "A rejection reason is required" });
    }
    if (reason.length > 1000) {
      return res
        .status(400)
        .json({ message: "Rejection reason is too long (max 1000 characters)" });
    }

    const request = await ItemRequest.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!request) {
      const existing = await ItemRequest.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (existing.status === "rejected") {
        return res
          .status(409)
          .json({ message: "This request was already rejected" });
      }
      return res
        .status(409)
        .json({ message: "Only pending requests can be rejected" });
    }

    res.json({ request });
  } catch (error) {
    res.status(500).json({ message: "Could not reject request" });
  }
});

module.exports = router;
