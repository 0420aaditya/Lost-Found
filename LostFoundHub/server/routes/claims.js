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

const CLAIM_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "needsInfo",
  "completed",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Remove the private admin notes before sending a claim back to its owner.
function claimForOwner(claim) {
  const obj = claim.toObject ? claim.toObject() : { ...claim };
  delete obj.adminNotes;
  return obj;
}

// Returns a human-friendly reason when an item cannot be claimed, else null.
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
    const body = req.body || {};
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    const contactPhone = text(body.contactPhone);
    const contactEmail = text(body.contactEmail);
    const ownershipDetails = text(body.ownershipDetails);

    if (!itemId || !contactPhone || !ownershipDetails) {
      return res.status(400).json({
        message: "Item, contact phone and ownership details are required",
      });
    }
    if (!isValidId(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }
    if (contactPhone.length < 3 || contactPhone.length > 30) {
      return res
        .status(400)
        .json({ message: "Contact phone must be 3 to 30 characters" });
    }
    if (contactPhone.replace(/\D/g, "").length < 3) {
      return res
        .status(400)
        .json({ message: "Contact phone must contain at least 3 digits" });
    }
    if (contactEmail && !EMAIL_RE.test(contactEmail)) {
      return res.status(400).json({ message: "Contact email is not valid" });
    }
    if (contactEmail.length > 254) {
      return res.status(400).json({ message: "Contact email is too long" });
    }
    if (ownershipDetails.length < 10) {
      return res.status(400).json({
        message: "Please explain ownership in at least 10 characters",
      });
    }
    if (ownershipDetails.length > 3000) {
      return res
        .status(400)
        .json({ message: "Ownership details are too long (max 3000 characters)" });
    }

    const item = await Item.findById(itemId);
    const reason = itemClaimableReason(item);
    if (reason) {
      return res
        .status(reason === "Item not found" ? 404 : 409)
        .json({ message: reason });
    }

    // A user cannot claim an item they themselves reported as found.
    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res
        .status(409)
        .json({ message: "You cannot claim an item you reported" });
    }

    // Friendly pre-check; the partial unique index is the race-safe guarantee.
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

    let claim;
    try {
      claim = await ClaimRequest.create({
        itemId: item._id,
        claimantId: req.user._id,
        contactPhone,
        contactEmail,
        ownershipDetails,
        status: "pending",
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "You already have an active claim for this item",
        });
      }
      throw error;
    }

    // Re-check after creation: the item may have been claimed/deleted while the
    // claim was being written. If so, remove the just-created claim and report
    // a clear conflict instead of leaving an unusable pending claim.
    const fresh = await Item.findById(item._id);
    if (itemClaimableReason(fresh)) {
      await ClaimRequest.deleteOne({ _id: claim._id }).catch(() => {});
      return res
        .status(409)
        .json({ message: "This item is no longer available for claims" });
    }

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
      .sort({ createdAt: -1, _id: -1 });

    res.json({ claims: claims.map(claimForOwner) });
  } catch (error) {
    res.status(500).json({ message: "Could not load your claims" });
  }
});

// GET /api/claims?status=&itemId=  (admin only)  full private details
router.get("/", protect, requireAdmin, async (req, res) => {
  try {
    const status = text(req.query.status);
    const itemId = text(req.query.itemId);
    const filter = {};

    if (status) {
      if (!CLAIM_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      filter.status = status;
    }
    if (itemId) {
      if (!isValidId(itemId)) {
        return res.status(400).json({ message: "Invalid item id filter" });
      }
      filter.itemId = itemId;
    }

    const claims = await ClaimRequest.find(filter)
      .populate("claimantId", "name email")
      .populate("reviewedBy", "name")
      .populate("itemId", "type itemName category status hubReceived isDeleted")
      .sort({ createdAt: -1, _id: -1 });

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

    const claimantId =
      claim.claimantId && claim.claimantId._id
        ? claim.claimantId._id
        : claim.claimantId;
    const isOwner =
      claimantId &&
      claimantId.toString() === req.user._id.toString();
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

    const body = req.body || {};
    const decision = text(body.decision);
    const adminNotes = text(body.adminNotes);

    if (!["approved", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ message: "Decision must be approved or rejected" });
    }
    if (!adminNotes) {
      return res
        .status(400)
        .json({ message: "Admin notes are required to record the decision" });
    }
    if (adminNotes.length > 2000) {
      return res
        .status(400)
        .json({ message: "Admin notes are too long (max 2000 characters)" });
    }

    const current = await ClaimRequest.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Claim not found" });
    }
    if (current.status !== "pending") {
      return res
        .status(409)
        .json({ message: "This claim has already been reviewed" });
    }

    const reviewFields = {
      adminNotes,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    };

    if (decision === "rejected") {
      const claim = await ClaimRequest.findOneAndUpdate(
        { _id: current._id, status: "pending" },
        { $set: { ...reviewFields, status: "rejected" } },
        { new: true }
      );
      if (!claim) {
        return res
          .status(409)
          .json({ message: "This claim has already been reviewed" });
      }
      return res.json({ claim });
    }

    // ---- approve ----
    // 1. Atomically move THIS claim from pending to approved.
    const approved = await ClaimRequest.findOneAndUpdate(
      { _id: current._id, status: "pending" },
      { $set: { ...reviewFields, status: "approved" } },
      { new: true }
    );
    if (!approved) {
      return res
        .status(409)
        .json({ message: "This claim has already been reviewed" });
    }

    // 2. Atomically reserve the item. Only one concurrent approval can match
    //    { status: "open" }, so at most one claim wins.
    const item = await Item.findOneAndUpdate(
      {
        _id: approved.itemId,
        type: "found",
        isDeleted: false,
        hubReceived: true,
        status: "open",
      },
      { $set: { status: "claimed" } },
      { new: true }
    );

    if (!item) {
      const currentItem = await Item.findById(approved.itemId);
      const reason =
        itemClaimableReason(currentItem) ||
        "This item is not available for claims";

      // Move the claim out of "approved" so it is not left in a winning state.
      await ClaimRequest.updateOne(
        { _id: approved._id, status: "approved" },
        {
          $set: {
            status: "rejected",
            adminNotes: `Auto-rejected: ${reason}`,
            reviewedAt: new Date(),
          },
        }
      );

      return res.status(409).json({
        message: `Cannot approve: ${reason}. This claim was rejected.`,
      });
    }

    // 3. Any other pending claims for this item are now moot.
    await ClaimRequest.updateMany(
      { itemId: item._id, _id: { $ne: approved._id }, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          adminNotes: "Auto-rejected: another claim was approved for this item.",
        },
      }
    );

    res.json({ claim: approved, item });
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

    // Atomic claim transition: a double-click cannot complete the handover twice.
    const claim = await ClaimRequest.findOneAndUpdate(
      { _id: req.params.id, status: "approved" },
      { $set: { status: "completed", handoverAt: new Date() } },
      { new: true }
    );

    if (!claim) {
      const existing = await ClaimRequest.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Claim not found" });
      }
      return res.status(409).json({
        message: "Only an approved claim can be marked as handed over",
      });
    }

    // The item must still exist, not be deleted, and still be reserved.
    const item = await Item.findOneAndUpdate(
      { _id: claim.itemId, isDeleted: false, status: "claimed" },
      { $set: { status: "collected" } },
      { new: true }
    );

    if (!item) {
      // Roll the claim back so the state stays consistent.
      await ClaimRequest.updateOne(
        { _id: claim._id, status: "completed" },
        { $set: { status: "approved" }, $unset: { handoverAt: 1 } }
      );
      return res.status(409).json({
        message: "The item is no longer available for handover",
      });
    }

    res.json({ claim, item });
  } catch (error) {
    res.status(500).json({ message: "Could not complete handover" });
  }
});

module.exports = router;
