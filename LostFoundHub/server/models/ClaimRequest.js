// models/ClaimRequest.js
// A user's request to recover a found item. Contact details and adminNotes are
// PRIVATE: they are only shown to the admin (and the claimant for their own claim).
const mongoose = require("mongoose");

const claimRequestSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    claimantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,
      maxlength: [30, "Contact phone is too long (max 30 characters)"],
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: [254, "Contact email is too long (max 254 characters)"],
    },
    ownershipDetails: {
      type: String,
      required: [true, "Please explain why the item is yours"],
      trim: true,
      maxlength: [3000, "Ownership details are too long (max 3000 characters)"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "needsInfo", "completed"],
      default: "pending",
    },
    // Private notes the admin writes after contacting/verifying the claimant.
    adminNotes: {
      type: String,
      default: "",
      maxlength: [2000, "Admin notes are too long (max 2000 characters)"],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    // Set when the owner has physically collected the item.
    handoverAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// At most ONE active (pending/approved/needsInfo) claim per user per item.
// The partial unique index is the database-level guarantee against
// check-then-create races. The API also checks first for a friendly message.
claimRequestSchema.index(
  { itemId: 1, claimantId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "approved", "needsInfo"] },
    },
  }
);

// Query patterns used by the admin claim list/reports.
claimRequestSchema.index({ status: 1, createdAt: -1 });
claimRequestSchema.index({ itemId: 1, status: 1 });

module.exports = mongoose.model("ClaimRequest", claimRequestSchema);
