// models/ItemRequest.js
// A Lost or Found report submitted by a user. It stays "pending" until an
// admin reviews it. Kept separate from Item so rejected requests are preserved.
const mongoose = require("mongoose");

const itemRequestSchema = new mongoose.Schema(
  {
    userId: {
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
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [120, "Item name is too long (max 120 characters)"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: [60, "Category is too long (max 60 characters)"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [3000, "Description is too long (max 3000 characters)"],
    },
    dateLostOrFound: {
      type: Date,
      required: [true, "Date is required"],
    },
    locationLostOrFound: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [200, "Location is too long (max 200 characters)"],
    },
    // Path to an uploaded image (e.g. "/uploads/1699999-photo.jpg"), optional.
    imageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Image URL is too long"],
    },
    additionalDetails: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Additional details are too long (max 2000 characters)"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Rejection reason is too long (max 1000 characters)"],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    // Filled in when the request is approved and an official Item is created.
    approvedItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    },
  },
  { timestamps: true }
);

// Query patterns used by "my requests" and the admin request list/reports.
itemRequestSchema.index({ userId: 1, createdAt: -1 });
itemRequestSchema.index({ status: 1, createdAt: -1 });
itemRequestSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model("ItemRequest", itemRequestSchema);
