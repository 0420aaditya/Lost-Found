// models/Item.js
// An official record created ONLY when an admin approves a request.
// These are the records that appear publicly (when not soft-deleted).
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    // Links back to the request it came from. "unique" prevents approving the
    // same request twice and accidentally creating two items.
    sourceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ItemRequest",
      required: true,
      unique: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["lost", "found"],
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    dateLostOrFound: {
      type: Date,
      required: true,
    },
    locationLostOrFound: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    // Simple, clear status values:
    //   lost items  : open -> resolved
    //   found items : open -> claimed -> collected (or resolved)
    status: {
      type: String,
      enum: ["open", "claimed", "collected", "resolved"],
      default: "open",
    },
    // Only meaningful for FOUND items: was the physical item handed to the hub?
    hubReceived: {
      type: Boolean,
      default: false,
    },
    hubReceivedAt: {
      type: Date,
    },
    // The admin who recorded the physical handover to the hub.
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Soft deletion: we keep the record but hide it from the public.
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletedAt: {
      type: Date,
    },
    deletionReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Speeds up the public listing/search queries.
itemSchema.index({ isDeleted: 1, type: 1, status: 1 });

module.exports = mongoose.model("Item", itemSchema);
