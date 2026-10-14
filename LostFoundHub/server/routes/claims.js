// routes/claims.js
// Claim workflow: a user claims a found item that is physically at the hub.
// Claimant contact details and admin notes are PRIVATE (admin + the claimant
// for their own claim only), never exposed in public item APIs.
const express = require("express");
const mongoose = require("mongoose");
const ClaimRequest = require("../models/ClaimRequest");
const Item = require("../models/Item");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Remove the private admin notes before sending a claim back to its owner.
function claimForOwner(claim) {
  const obj = claim.toObject ? claim.toObject() : { ...claim };
  delete obj.adminNotes;
  return obj;
}

// Create the claim and validate that the item can actually be claimed.
// Shared by POST / and the admin decision flow's eligibility rules.
function itemClaimableReason(item) {
  if (!item) return "Item not found";
  if (item.type !== "found") return "Claims are only for found items";
  if (item.isDeleted) return "This item is no longer available";
  if (!item.hubReceived) return "This item is not at the hub yet";
  if (item.status !== "open") return "This item is not available for claims";
  return null;
}

// POST /api/claims  (logged in)
router.post("/", protect, async (req, res) => {
  try {
    const { itemId, contactPhone, contactEmail, ownershipDetails } = req.body;

    if (!itemId || !contactPhone || !ownershipDetails) {
      return res.status(400).json({
        message: "Item, contact phone and ownership details are required",
      });
    }
    if (!isValidId(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(itemId);
    const reason = itemClaimableReason(item);
    if (reason) {
      return res.status(reason === "Item not found" ? 404 : 400).json({ message: reason });
    }

    // A user cannot claim an item they themselves reported as found.
    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "You cannot claim an item you reported" });
    }

    // No duplicate active claim by the same user on the same item.
    const existing = await ClaimRequest.findOne({
      itemId: item._id,
      claimantId: req.user._id,
      status: { $in: ["pending", "approved", "needsInfo"] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "You already have an active claim for this item" });
    }

    const claim = await ClaimRequest.create({
      itemId: item._id,
      claimantId: req.user._id,
      contactPhone,
      contactEmail: contactEmail || "",
      ownershipDetails,
      status: "pending",
    });

    res.status(201).json({ claim: claimForOwner(claim) });
  } catch (error) {
    res.status(500).json({ message: "Could not create claim" });
  }
});

// GET /api/claims/my  (logged in)  only this user's claims, safe fields only
router.get("/my", protect, async (req, res) => {
  try {
    const claims = await ClaimRequest.find({ claimantId: req.user._id })
      .populate("itemId", "type itemName category imageUrl status hubReceived")
      .sort({ createdAt: -1 });

    res.json({ claims: claims.map(claimForOwner) });
  } catch (error) {
    res.status(500).json({ message: "Could not load your claims" });
  }
});

// GET /api/claims?status=&itemId=  (admin only)  full private details
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const { status, itemId } = req.query;
    const filter = {};
    if (
      status &&
      ["pending", "approved", "rejected", "needsInfo", "completed"].includes(status)
    ) {
      filter.status = status;
    }
    if (itemId && isValidId(itemId)) filter.itemId = itemId;

    const claims = await ClaimRequest.find(filter)
      .populate("claimantId", "name email")
      .populate("reviewedBy", "name")
      .populate("itemId", "type itemName category status hubReceived isDeleted")
      .sort({ createdAt: -1 });

    res.json({ claims });
  } catch (error) {
    res.status(500).json({ message: "Could not load claims" });
  }
});

// GET /api/claims/:id  (claimant or admin only; field-level privacy)
router.get("/:id", protect, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid claim id" });
    }

    const claim = await ClaimRequest.findById(req.params.id)
      .populate("claimantId", "name email")
      .populate("reviewedBy", "name")
      .populate("itemId", "type itemName category imageUrl status hubReceived");

    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    const isOwner = claim.claimantId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "You cannot view this claim" });
    }

    if (isAdmin) {
      return res.json({ claim });
    }
    return res.json({ claim: claimForOwner(claim) });
  } catch (error) {
    res.status(500).json({ message: "Could not load claim" });
  }
});

// PATCH /api/claims/:id/decision  (admin only)  body: { decision, adminNotes }
// decision is "approved" or "rejected". Admin notes are required so the external
// contact/verification is always recorded.
router.patch("/:id/decision", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid claim id" });
    }

    const { decision, adminNotes } = req.body;
    if (!["approved", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ message: "Decision must be approved or rejected" });
    }
    if (!adminNotes || !adminNotes.trim()) {
      return res
        .status(400)
        .json({ message: "Admin notes are required to record the decision" });
    }

    const claim = await ClaimRequest.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }
    if (claim.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This claim has already been reviewed" });
    }

    if (decision === "approved") {
      const item = await Item.findById(claim.itemId);
      const reason = itemClaimableReason(item);
      if (reason) {
        return res
          .status(400)
          .json({ message: `Cannot approve: this item is not available (${reason})` });
      }

      // Approval takes the item off the open list (but is NOT yet a handover).
      item.status = "claimed";
      await item.save();

      // Any other pending claims for this item are now moot.
      await ClaimRequest.updateMany(
        { itemId: item._id, _id: { $ne: claim._id }, status: "pending" },
        {
          status: "rejected",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          adminNotes: "Auto-rejected: another claim was approved for this item.",
        }
      );
    }

    claim.status = decision;
    claim.adminNotes = adminNotes.trim();
    claim.reviewedBy = req.user._id;
    claim.reviewedAt = new Date();
    await claim.save();

    res.json({ claim });
  } catch (error) {
    res.status(500).json({ message: "Could not record decision" });
  }
});

// PATCH /api/claims/:id/handover  (admin only)
// Confirms the physical collection. Only an approved claim can be completed,
// and the item then becomes "collected" so it can accept no new claims.
router.patch("/:id/handover", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid claim id" });
    }

    const claim = await ClaimRequest.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }
    if (claim.status !== "approved") {
      return res
        .status(400)
        .json({ message: "Only an approved claim can be marked as handed over" });
    }

    const item = await Item.findById(claim.itemId);
    if (!item || item.isDeleted) {
      return res
        .status(400)
        .json({ message: "The item is no longer available for handover" });
    }

    claim.status = "completed";
    claim.handoverAt = new Date();
    await claim.save();

    item.status = "collected";
    await item.save();

    res.json({ claim, item });
  } catch (error) {
    res.status(500).json({ message: "Could not complete handover" });
  }
});

module.exports = router;
