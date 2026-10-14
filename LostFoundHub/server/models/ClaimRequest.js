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
    },
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    ownershipDetails: {
      type: String,
      required: [true, "Please explain why the item is yours"],
      trim: true,
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

// Helps find a user's claims for a specific item quickly.
claimRequestSchema.index({ itemId: 1, claimantId: 1 });

module.exports = mongoose.model("ClaimRequest", claimRequestSchema);
