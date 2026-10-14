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
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    dateLostOrFound: {
      type: Date,
      required: [true, "Date is required"],
    },
    locationLostOrFound: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    // Path to an uploaded image (e.g. "/uploads/1699999-photo.jpg"), optional.
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    additionalDetails: {
      type: String,
      default: "",
      trim: true,
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

module.exports = mongoose.model("ItemRequest", itemRequestSchema);
