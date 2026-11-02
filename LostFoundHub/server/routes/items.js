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

const PUBLIC_FIELDS =
  "type itemName category description dateLostOrFound locationLostOrFound imageUrl status hubReceived createdAt";

const MAX_PAGE_SIZE = 50;
const SORT_OPTIONS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name: { itemName: 1, _id: 1 },
  date: { dateLostOrFound: -1, _id: -1 },
};
const ITEM_STATUSES = ["open", "claimed", "collected", "resolved"];

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Escape user input before it is used in a RegExp, so a search like "(" does
// not throw and so users cannot inject expensive regex patterns.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns a positive integer or null when the value is invalid.
function parsePositiveInt(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

// Shape a single item for public display. Reporter identity, source request,
// audit fields and deletion info are deliberately excluded.
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
// view soft-deleted items while the public cannot.
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
// Approved, non-deleted items with search, filters, stable sorting and
// pagination. The response keeps the "items" key for existing callers.
router.get("/", async (req, res) => {
  try {
    const search = text(req.query.search);
    const type = text(req.query.type);
    const category = text(req.query.category);
    const status = text(req.query.status);
    const location = text(req.query.location);
    const sortKey = text(req.query.sort) || "newest";
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 12);

    if (page === null) {
      return res.status(400).json({ message: "Page must be a positive integer" });
    }
    if (limit === null) {
      return res.status(400).json({ message: "Limit must be a positive integer" });
    }
    if (!SORT_OPTIONS[sortKey]) {
      return res.status(400).json({ message: "Invalid sort option" });
    }
    if (search.length > 100) {
      return res.status(400).json({ message: "Search is too long" });
    }
    if (category.length > 60) {
      return res.status(400).json({ message: "Category filter is too long" });
    }
    if (location.length > 200) {
      return res.status(400).json({ message: "Location filter is too long" });
    }

    const filter = { isDeleted: false };

    if (type) {
      if (!["lost", "found"].includes(type)) {
        return res.status(400).json({ message: "Invalid type filter" });
      }
      filter.type = type;
    }
    if (status) {
      if (!ITEM_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      filter.status = status;
    }
    if (category) {
      filter.category = { $regex: escapeRegex(category), $options: "i" };
    }
    if (location) {
      filter.locationLostOrFound = {
        $regex: escapeRegex(location),
        $options: "i",
      };
    }
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { itemName: pattern },
        { description: pattern },
        { locationLostOrFound: pattern },
      ];
    }

    const safeLimit = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * safeLimit;

    const [items, total] = await Promise.all([
      Item.find(filter)
        .select(PUBLIC_FIELDS)
        .sort(SORT_OPTIONS[sortKey])
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Item.countDocuments(filter),
    ]);

    res.json({
      items: items.map(publicItem),
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
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
    }).sort({ createdAt: -1, _id: -1 });
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
      .sort({ createdAt: -1, _id: -1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Could not load items" });
  }
});

// GET /api/items/inventory  (admin only)
// The hub's physical stock: FOUND items only (a lost listing is just a report,
// not hub inventory). Counts are global, independent of the active filters.
router.get("/inventory", protect, requireAdmin, async (req, res) => {
  try {
    const search = text(req.query.search);
    const category = text(req.query.category);
    const status = text(req.query.status);
    const hubReceived = text(req.query.hubReceived);

    if (search.length > 100) {
      return res.status(400).json({ message: "Search is too long" });
    }
    if (category.length > 60) {
      return res.status(400).json({ message: "Category filter is too long" });
    }
    if (status && !ITEM_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }
    if (hubReceived && !["true", "false"].includes(hubReceived)) {
      return res.status(400).json({ message: "Invalid hubReceived filter" });
    }

    const filter = { isDeleted: false, type: "found" };
    if (category) {
      filter.category = { $regex: escapeRegex(category), $options: "i" };
    }
    if (status) filter.status = status;
    if (hubReceived === "true") filter.hubReceived = true;
    if (hubReceived === "false") filter.hubReceived = false;
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [
        { itemName: pattern },
        { description: pattern },
        { locationLostOrFound: pattern },
      ];
    }

    const base = { isDeleted: false, type: "found" };

    const [items, total, inHub, awaitingReceipt, collected] = await Promise.all([
      Item.find(filter)
        .populate("reportedBy", "name email")
        .populate("receivedBy", "name")
        .sort({ createdAt: -1, _id: -1 }),
      Item.countDocuments(base),
      Item.countDocuments({
        ...base,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      Item.countDocuments({ ...base, hubReceived: false }),
      Item.countDocuments({ ...base, status: "collected" }),
    ]);

    res.json({
      items,
      counts: { total, inHub, awaitingReceipt, collected },
    });
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

    const body = req.body || {};
    const reason = text(body.reason);
    const confirm = body.confirm === true;

    if (!reason) {
      return res.status(400).json({ message: "A deletion reason is required" });
    }
    if (reason.length > 1000) {
      return res
        .status(400)
        .json({ message: "Deletion reason is too long (max 1000 characters)" });
    }

    const existing = await Item.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Item not found" });
    }
    if (existing.isDeleted) {
      return res.status(409).json({ message: "This item is already deleted" });
    }

    // Warn before deleting an item that still has pending claims.
    const pendingClaims = await ClaimRequest.countDocuments({
      itemId: existing._id,
      status: "pending",
    });
    if (pendingClaims > 0 && !confirm) {
      return res.status(409).json({
        message: `This item has ${pendingClaims} pending claim(s). Re-send with confirm: true to delete it and reject those claims.`,
        pendingClaims,
      });
    }

    // Atomic conditional update prevents two admins soft-deleting at once.
    const item = await Item.findOneAndUpdate(
      { _id: existing._id, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedBy: req.user._id,
          deletedAt: new Date(),
          deletionReason: reason,
        },
      },
      { new: true }
    );

    if (!item) {
      return res.status(409).json({ message: "This item is already deleted" });
    }

    // Close any pending claims, including one created in the tiny window
    // between the count above and the update.
    await ClaimRequest.updateMany(
      { itemId: item._id, status: "pending" },
      {
        status: "rejected",
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        adminNotes: "Auto-rejected because the item was removed from the hub.",
      }
    );

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

    // Atomic conditional update so a double-click cannot record receipt twice.
    const item = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        type: "found",
        isDeleted: false,
        hubReceived: false,
      },
      {
        $set: {
          hubReceived: true,
          hubReceivedAt: new Date(),
          receivedBy: req.user._id,
        },
      },
      { new: true }
    );

    if (!item) {
      const existing = await Item.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Item not found" });
      }
      if (existing.type !== "found") {
        return res
          .status(400)
          .json({ message: "Only found items can be received at the hub" });
      }
      if (existing.isDeleted) {
        return res
          .status(409)
          .json({ message: "Cannot receive an item that was deleted" });
      }
      if (existing.hubReceived) {
        return res.status(409).json({
          message: "This item was already marked as received at the hub",
        });
      }
      return res.status(409).json({ message: "Could not record hub receipt" });
    }

    res.json({ item });
  } catch (error) {
    res.status(500).json({ message: "Could not record hub receipt" });
  }
});

module.exports = router;
