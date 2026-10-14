// routes/items.js
// Official item records. Public browse/search/details + admin soft-deletion.
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Item = require("../models/Item");
const ClaimRequest = require("../models/ClaimRequest");
const User = require("../models/User");
const { protect, requireAdmin } = require("../middleware/auth");

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Fields that are safe to show in public responses.
// Notice: reportedBy (who found it), sourceRequestId and deletion info are NOT shown.
const PUBLIC_FIELDS =
  "type itemName category description dateLostOrFound locationLostOrFound imageUrl status hubReceived createdAt";

// Shape a single item for public display.
function publicItem(item) {
  return {
    _id: item._id,
    type: item.type,
    itemName: item.itemName,
    category: item.category,
    description: item.description,
    dateLostOrFound: item.dateLostOrFound,
    locationLostOrFound: item.locationLostOrFound,
    imageUrl: item.imageUrl,
    status: item.status,
    hubReceived: item.hubReceived,
    createdAt: item.createdAt,
  };
}

// Read the token if one was sent, but do not require it. Used so an admin can
// view soft-deleted items while the public cannot. Like protect(), we load the
// real user from the database and never trust the token's contents.
async function getViewer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return null;
    return user;
  } catch (error) {
    return null;
  }
}

// GET /api/items  (public)
// Only non-deleted items. Supports search by name/description and filters.
router.get("/", async (req, res) => {
  try {
    const { search, type, category, status, location } = req.query;

    // The base filter hides soft-deleted items from everyone in public.
    const filter = { isDeleted: false };

    if (type && ["lost", "found"].includes(type)) filter.type = type;
    if (category) filter.category = category;
    if (status && ["open", "claimed", "collected", "resolved"].includes(status)) {
      filter.status = status;
    }
    if (location) {
      filter.locationLostOrFound = { $regex: location, $options: "i" };
    }
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const items = await Item.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Could not load items" });
  }
});

// GET /api/items/my  (logged in)
// The current user's own item records (items created from their requests).
router.get("/my", protect, async (req, res) => {
  try {
    const items = await Item.find({
      reportedBy: req.user._id,
      isDeleted: false,
    }).sort({ createdAt: -1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Could not load your items" });
  }
});

// GET /api/items/all  (admin only)
// Every item, including soft-deleted ones, for the admin "Manage Items" page.
router.get("/all", protect, requireAdmin, async (req, res) => {
  try {
    const items = await Item.find()
      .populate("reportedBy", "name email")
      .populate("deletedBy", "name")
      .sort({ createdAt: -1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Could not load items" });
  }
});

// GET /api/items/inventory  (admin only)
// The hub's physical stock: FOUND items only (a lost listing is just a report,
// not hub inventory). Search/filter by name, category, status and hub receipt.
router.get("/inventory", protect, requireAdmin, async (req, res) => {
  try {
    const { search, category, status, hubReceived } = req.query;

    const filter = { isDeleted: false, type: "found" };
    if (category) filter.category = category;
    if (status && ["open", "claimed", "collected", "resolved"].includes(status)) {
      filter.status = status;
    }
    if (hubReceived === "true") filter.hubReceived = true;
    if (hubReceived === "false") filter.hubReceived = false;
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { locationLostOrFound: { $regex: search, $options: "i" } },
      ];
    }

    const items = await Item.find(filter)
      .populate("reportedBy", "name email")
      .populate("receivedBy", "name")
      .sort({ createdAt: -1 });

    // Small summary the admin inventory page can show.
    const counts = {
      total: items.length,
      inHub: items.filter((i) => i.hubReceived).length,
      awaitingReceipt: items.filter((i) => !i.hubReceived).length,
    };

    res.json({ items, counts });
  } catch (error) {
    res.status(500).json({ message: "Could not load inventory" });
  }
});

// GET /api/items/:id  (public; admins can also see soft-deleted items)
router.get("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const viewer = await getViewer(req);
    const isAdmin = viewer && viewer.role === "admin";

    // Soft-deleted items are hidden from the public (404) but visible to admins.
    if (item.isDeleted && !isAdmin) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (isAdmin) {
      return res.json({ item });
    }
    return res.json({ item: publicItem(item) });
  } catch (error) {
    res.status(500).json({ message: "Could not load item" });
  }
});

// PATCH /api/items/:id/soft-delete  (admin only)  body: { reason, confirm? }
// Keeps the record but hides it from the public.
router.patch("/:id/soft-delete", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const { reason, confirm } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: "A deletion reason is required" });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    if (item.isDeleted) {
      return res.status(400).json({ message: "This item is already deleted" });
    }

    // Warn before deleting an item that still has pending claims.
    const pendingClaims = await ClaimRequest.countDocuments({
      itemId: item._id,
      status: "pending",
    });
    if (pendingClaims > 0 && !confirm) {
      return res.status(409).json({
        message: `This item has ${pendingClaims} pending claim(s). Re-send with confirm: true to delete it and reject those claims.`,
        pendingClaims,
      });
    }

    item.isDeleted = true;
    item.deletedBy = req.user._id;
    item.deletedAt = new Date();
    item.deletionReason = reason.trim();
    await item.save();

    // If the admin confirmed, close any pending claims on this item.
    if (pendingClaims > 0) {
      await ClaimRequest.updateMany(
        { itemId: item._id, status: "pending" },
        {
          status: "rejected",
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          adminNotes: "Auto-rejected because the item was removed from the hub.",
        }
      );
    }

    res.json({ item });
  } catch (error) {
    res.status(500).json({ message: "Could not delete item" });
  }
});

// PATCH /api/items/:id/receive-at-hub  (admin only)
// Records that the physical item was handed in to the hub. Approval alone does
// NOT count as receipt; the admin must explicitly mark it here. Only FOUND
// items are hub inventory, so lost items cannot be received.
router.patch("/:id/receive-at-hub", protect, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    if (item.type !== "found") {
      return res
        .status(400)
        .json({ message: "Only found items can be received at the hub" });
    }
    if (item.isDeleted) {
      return res
        .status(400)
        .json({ message: "Cannot receive an item that was deleted" });
    }
    if (item.hubReceived) {
      return res
        .status(400)
        .json({ message: "This item was already marked as received at the hub" });
    }

    item.hubReceived = true;
    item.hubReceivedAt = new Date();
    item.receivedBy = req.user._id;
    await item.save();

    res.json({ item });
  } catch (error) {
    res.status(500).json({ message: "Could not record hub receipt" });
  }
});

module.exports = router;
