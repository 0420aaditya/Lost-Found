// tests/integration.test.js
// End-to-end API tests using Node's built-in test runner (no extra packages).
//
// Run with:  npm test   (from server/)
//
// The tests use a DEDICATED database (lostfoundhub_test) and a dedicated
// uploads-test folder. They never touch the development/production data.
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// ---- test environment (must be set BEFORE requiring the server) ----
process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/lostfoundhub_test";
process.env.JWT_SECRET = "test-only-secret-that-is-long-enough-1234567890";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.UPLOAD_DIR = "uploads-test";

const { start } = require("../server");
const Item = require("../models/Item");
const ItemRequest = require("../models/ItemRequest");
const ClaimRequest = require("../models/ClaimRequest");
const User = require("../models/User");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads-test");
const SERVER_DIR = path.join(__dirname, "..");

// A real 1x1 PNG (used to prove signature validation works).
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
    "0000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);

let server;
let baseUrl;
const state = {
  adminToken: "",
  adminUserId: "",
  userA: null,
  userB: null,
  userC: null,
  userD: null,
  lostRequest: null,
  lostItem: null,
  foundRequest: null,
  foundItem: null,
  imageUrl: "",
};

async function api(method, endpoint, options = {}) {
  const { token, body, form, rawBody } = options;
  const headers = {};
  let payload;
  if (form) {
    payload = form;
  } else if (rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = rawBody;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(baseUrl + endpoint, {
    method,
    headers,
    body: payload,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

async function registerUser(email, name) {
  const res = await api("POST", "/api/auth/register", {
    body: { name, email, password: "Password123" },
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data;
}

async function login(email, password) {
  return api("POST", "/api/auth/login", { body: { email, password } });
}

let requestCounter = 0;
function requestPayload(overrides = {}) {
  requestCounter += 1;
  return {
    type: "found",
    itemName: `Test Item ${requestCounter}`,
    category: "electronics",
    description: "A distinctive test item used by the automated suite.",
    dateLostOrFound: "2026-01-15",
    locationLostOrFound: "Test Building Level 1",
    ...overrides,
  };
}

async function submitRequest(token, overrides = {}) {
  const res = await api("POST", "/api/requests", {
    token,
    body: requestPayload(overrides),
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.request;
}

async function approveRequest(adminToken, id, expected = 200) {
  const res = await api("PATCH", `/api/requests/${id}/approve`, {
    token: adminToken,
  });
  assert.equal(res.status, expected, JSON.stringify(res.data));
  return res;
}

async function receiveItem(adminToken, id, expected = 200) {
  const res = await api("PATCH", `/api/items/${id}/receive-at-hub`, {
    token: adminToken,
  });
  assert.equal(res.status, expected, JSON.stringify(res.data));
  return res;
}

async function makeFoundItem(userToken, adminToken, { receive = false } = {}) {
  const request = await submitRequest(userToken, { type: "found" });
  const approved = await approveRequest(adminToken, request._id);
  let item = approved.data.item;
  if (receive) {
    item = (await receiveItem(adminToken, item._id)).data.item;
  }
  return { request, item };
}

async function makeLostItem(userToken, adminToken) {
  const request = await submitRequest(userToken, { type: "lost" });
  const approved = await approveRequest(adminToken, request._id);
  return { request, item: approved.data.item };
}

function countUploadFiles() {
  if (!fs.existsSync(UPLOAD_DIR)) return 0;
  return fs.readdirSync(UPLOAD_DIR).length;
}

describe("Lost & Found Hub integration", () => {
  before(async () => {
    // Start from a clean dedicated test database.
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();

    // Exercise the documented trusted admin-seeding path.
    execFileSync(
      process.execPath,
      [path.join(SERVER_DIR, "seeds", "createAdmin.js")],
      {
        env: {
          ...process.env,
          ADMIN_NAME: "Site Admin",
          ADMIN_EMAIL: "admin@example.com",
          ADMIN_PASSWORD: "Admin123456",
        },
        stdio: "pipe",
      }
    );

    server = await start(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // Build indexes now (includes the partial unique claim index).
    await Promise.all([
      User.init(),
      ItemRequest.init(),
      Item.init(),
      ClaimRequest.init(),
    ]);

    const adminLogin = await login("admin@example.com", "Admin123456");
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
    assert.equal(adminLogin.data.user.role, "admin");
    state.adminToken = adminLogin.data.token;
    state.adminUserId = adminLogin.data.user.id;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  });

  it("registers normal users, ignores client-supplied role, and validates auth input", async () => {
    state.userA = await registerUser("a@test.local", "User A");
    // Even if the client sends role: "admin", it must be ignored.
    const bRes = await api("POST", "/api/auth/register", {
      body: {
        name: "User B",
        email: "b@test.local",
        password: "Password123",
        role: "admin",
      },
    });
    assert.equal(bRes.status, 201, JSON.stringify(bRes.data));
    assert.equal(bRes.data.user.role, "user");
    state.userB = bRes.data;

    state.userC = await registerUser("c@test.local", "User C");
    state.userD = await registerUser("d@test.local", "User D");

    assert.ok(state.userA.token);
    assert.equal(state.userA.user.passwordHash, undefined);

    const me = await api("GET", "/api/auth/me", { token: state.userA.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, "a@test.local");

    const duplicate = await api("POST", "/api/auth/register", {
      body: {
        name: "User A",
        email: "a@test.local",
        password: "Password123",
      },
    });
    assert.equal(duplicate.status, 409);

    const badEmail = await api("POST", "/api/auth/register", {
      body: { name: "Bad", email: "not-an-email", password: "Password123" },
    });
    assert.equal(badEmail.status, 400);

    const shortPassword = await api("POST", "/api/auth/register", {
      body: { name: "Bad", email: "short@test.local", password: "123" },
    });
    assert.equal(shortPassword.status, 400);

    const longPassword = await api("POST", "/api/auth/register", {
      body: {
        name: "Bad",
        email: "long@test.local",
        password: "x".repeat(73),
      },
    });
    assert.equal(longPassword.status, 400);
  });

  it("enforces authentication and admin authorization", async () => {
    const guest = await api("GET", "/api/requests/my");
    assert.equal(guest.status, 401);

    const badToken = await api("GET", "/api/auth/me", {
      token: "not-a-real-token",
    });
    assert.equal(badToken.status, 401);

    const normalUserAdmin = await api("GET", "/api/admin/dashboard", {
      token: state.userA.token,
    });
    assert.equal(normalUserAdmin.status, 403);

    for (const endpoint of [
      "/api/requests",
      "/api/claims",
      "/api/items/all",
      "/api/items/inventory",
    ]) {
      const res = await api("GET", endpoint, { token: state.userA.token });
      assert.equal(res.status, 403, `${endpoint} should require admin`);
    }
  });

  it("validates filters, ids, dates and image URLs safely", async () => {
    assert.equal((await api("GET", "/api/items?type=bogus")).status, 400);
    assert.equal((await api("GET", "/api/items?sort=bogus")).status, 400);
    assert.equal((await api("GET", "/api/items?page=0")).status, 400);
    assert.equal((await api("GET", "/api/items/not-an-id")).status, 400);

    const empty = await api("POST", "/api/requests", {
      token: state.userA.token,
      body: {},
    });
    assert.equal(empty.status, 400);

    const badDate = await api("POST", "/api/requests", {
      token: state.userA.token,
      body: requestPayload({ dateLostOrFound: "not-a-date" }),
    });
    assert.equal(badDate.status, 400);

    const badImage = await api("POST", "/api/requests", {
      token: state.userA.token,
      body: requestPayload({ imageUrl: "https://evil.example/x.png" }),
    });
    assert.equal(badImage.status, 400);

    const validId = new mongoose.Types.ObjectId().toString();
    const badClaimEmail = await api("POST", "/api/claims", {
      token: state.userA.token,
      body: {
        itemId: validId,
        contactPhone: "0123456789",
        contactEmail: "bad-email",
        ownershipDetails: "This item is definitely mine because of the sticker",
      },
    });
    assert.equal(badClaimEmail.status, 400);

    const shortOwnership = await api("POST", "/api/claims", {
      token: state.userA.token,
      body: {
        itemId: validId,
        contactPhone: "0123456789",
        ownershipDetails: "short",
      },
    });
    assert.equal(shortOwnership.status, 400);

    assert.equal(
      (await api("GET", "/api/requests/not-an-id", { token: state.adminToken }))
        .status,
      400
    );

    const malformed = await api("POST", "/api/auth/login", {
      rawBody: "{this is not json",
    });
    assert.equal(malformed.status, 400);
  });

  it("uploads only real images, rejects spoofed/oversized files, and serves the image", async () => {
    const baseCount = countUploadFiles();

    const form = new FormData();
    form.append(
      "image",
      new Blob([PNG_BYTES], { type: "image/png" }),
      "pixel.png"
    );
    const upload = await api("POST", "/api/uploads", {
      token: state.userA.token,
      form,
    });
    assert.equal(upload.status, 201, JSON.stringify(upload.data));
    assert.match(upload.data.imageUrl, /^\/uploads\/[a-f0-9]+\.png$/);
    assert.equal(upload.data.mimetype, "image/png");
    state.imageUrl = upload.data.imageUrl;
    assert.equal(countUploadFiles(), baseCount + 1);

    const imageRes = await fetch(baseUrl + state.imageUrl);
    assert.equal(imageRes.status, 200);
    assert.match(imageRes.headers.get("content-type") || "", /image\/png/);

    const badForm = new FormData();
    badForm.append(
      "image",
      new Blob([Buffer.from("not actually an image")], { type: "image/png" }),
      "fake.png"
    );
    const badUpload = await api("POST", "/api/uploads", {
      token: state.userA.token,
      form: badForm,
    });
    assert.equal(badUpload.status, 400);
    assert.equal(countUploadFiles(), baseCount + 1);

    const bigForm = new FormData();
    bigForm.append(
      "image",
      new Blob([Buffer.alloc(6 * 1024 * 1024)], { type: "image/png" }),
      "big.png"
    );
    const bigUpload = await api("POST", "/api/uploads", {
      token: state.userA.token,
      form: bigForm,
    });
    assert.equal(bigUpload.status, 413);

    const noFile = await api("POST", "/api/uploads", {
      token: state.userA.token,
      form: new FormData(),
    });
    assert.equal(noFile.status, 400);

    const guestForm = new FormData();
    guestForm.append(
      "image",
      new Blob([PNG_BYTES], { type: "image/png" }),
      "pixel.png"
    );
    assert.equal(
      (await api("POST", "/api/uploads", { form: guestForm })).status,
      401
    );
  });

  it("keeps requests pending and private until approval", async () => {
    state.lostRequest = await submitRequest(state.userA.token, {
      type: "lost",
      itemName: "Unique Lost Wallet",
    });
    state.foundRequest = await submitRequest(state.userA.token, {
      type: "found",
      itemName: "Unique Found Bottle",
      imageUrl: state.imageUrl,
    });

    assert.equal(state.lostRequest.status, "pending");
    assert.equal(state.foundRequest.status, "pending");

    const mine = await api("GET", "/api/requests/my", {
      token: state.userA.token,
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.requests.length, 2);

    const publicSearch = await api(
      "GET",
      "/api/items?search=Unique%20Lost%20Wallet"
    );
    assert.equal(publicSearch.status, 200);
    assert.equal(publicSearch.data.pagination.total, 0);

    const owner = await api("GET", `/api/requests/${state.lostRequest._id}`, {
      token: state.userA.token,
    });
    assert.equal(owner.status, 200);

    const other = await api("GET", `/api/requests/${state.lostRequest._id}`, {
      token: state.userB.token,
    });
    assert.equal(other.status, 403);

    const admin = await api("GET", `/api/requests/${state.lostRequest._id}`, {
      token: state.adminToken,
    });
    assert.equal(admin.status, 200);

    const pending = await api("GET", "/api/requests?status=pending", {
      token: state.adminToken,
    });
    assert.equal(pending.status, 200);
    assert.ok(pending.data.requests.length >= 2);

    assert.equal(
      (await api("GET", "/api/requests?status=bogus", { token: state.adminToken }))
        .status,
      400
    );
  });

  it("approves exactly once and never creates duplicate official items", async () => {
    const lostApproval = await approveRequest(
      state.adminToken,
      state.lostRequest._id
    );
    state.lostItem = lostApproval.data.item;
    assert.equal(state.lostItem.type, "lost");
    assert.equal(state.lostItem.status, "open");
    assert.equal(
      lostApproval.data.request.approvedItemId,
      state.lostItem._id
    );

    const repeat = await approveRequest(
      state.adminToken,
      state.lostRequest._id,
      409
    );
    assert.equal(repeat.data.itemId, state.lostItem._id);

    // Two concurrent approvals of the same fresh request.
    const raceRequest = await submitRequest(state.userB.token, {
      type: "lost",
      itemName: "Concurrent Approval Item",
    });
    const [raceA, raceB] = await Promise.all([
      api("PATCH", `/api/requests/${raceRequest._id}/approve`, {
        token: state.adminToken,
      }),
      api("PATCH", `/api/requests/${raceRequest._id}/approve`, {
        token: state.adminToken,
      }),
    ]);
    const statuses = [raceA.status, raceB.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(
      await Item.countDocuments({ sourceRequestId: raceRequest._id }),
      1
    );

    const foundApproval = await approveRequest(
      state.adminToken,
      state.foundRequest._id
    );
    state.foundItem = foundApproval.data.item;
    assert.equal(state.foundItem.type, "found");
    assert.equal(state.foundItem.imageUrl, state.imageUrl);
  });

  it("exposes only safe public item fields, with working filters and pagination", async () => {
    const all = await api("GET", "/api/items");
    assert.equal(all.status, 200);
    assert.ok(all.data.items.length >= 3);

    for (const item of all.data.items) {
      for (const privateField of [
        "reportedBy",
        "sourceRequestId",
        "isDeleted",
        "deletionReason",
        "deletedBy",
        "deletedAt",
        "receivedBy",
      ]) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(item, privateField),
          false,
          `public item leaked ${privateField}`
        );
      }
    }

    const page1 = await api("GET", "/api/items?limit=1&page=1");
    assert.equal(page1.status, 200);
    assert.equal(page1.data.items.length, 1);
    assert.equal(page1.data.pagination.page, 1);
    assert.equal(page1.data.pagination.limit, 1);
    assert.ok(page1.data.pagination.total >= 3);
    assert.equal(
      page1.data.pagination.totalPages,
      page1.data.pagination.total
    );

    const page2 = await api("GET", "/api/items?limit=1&page=2");
    assert.equal(page2.status, 200);
    assert.notEqual(page2.data.items[0]._id, page1.data.items[0]._id);

    const lostOnly = await api("GET", "/api/items?type=lost");
    assert.equal(lostOnly.status, 200);
    assert.ok(lostOnly.data.items.every((item) => item.type === "lost"));

    const search = await api("GET", "/api/items?search=Unique%20Found%20Bottle");
    assert.equal(search.status, 200);
    assert.equal(search.data.pagination.total, 1);
    assert.equal(search.data.items[0]._id, state.foundItem._id);

    const detail = await api("GET", `/api/items/${state.foundItem._id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.item.reportedBy, undefined);
    assert.equal(detail.data.item.sourceRequestId, undefined);
  });

  it("rejects requests with a reason and cannot revive them", async () => {
    const request = await submitRequest(state.userC.token, {
      type: "found",
      itemName: "Rejected Item",
    });

    const missingReason = await api(
      "PATCH",
      `/api/requests/${request._id}/reject`,
      { token: state.adminToken, body: {} }
    );
    assert.equal(missingReason.status, 400);

    const rejected = await api("PATCH", `/api/requests/${request._id}/reject`, {
      token: state.adminToken,
      body: { reason: "Photo does not match the description." },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.data.request.status, "rejected");

    const mine = await api("GET", "/api/requests/my", {
      token: state.userC.token,
    });
    const found = mine.data.requests.find((row) => row._id === request._id);
    assert.equal(found.rejectionReason, "Photo does not match the description.");

    assert.equal(
      (
        await api("PATCH", `/api/requests/${request._id}/approve`, {
          token: state.adminToken,
        })
      ).status,
      409
    );
    assert.equal(
      (
        await api("PATCH", `/api/requests/${request._id}/reject`, {
          token: state.adminToken,
          body: { reason: "again" },
        })
      ).status,
      409
    );
  });

  it("requires a separate physical hub receipt before a found item is claimable", async () => {
    const beforeReceipt = await api("POST", "/api/claims", {
      token: state.userB.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0123456789",
        ownershipDetails: "I own this bottle; it has my name sticker on it.",
      },
    });
    assert.equal(beforeReceipt.status, 409);

    const received = await receiveItem(state.adminToken, state.foundItem._id);
    state.foundItem = received.data.item;
    assert.equal(state.foundItem.hubReceived, true);
    assert.ok(state.foundItem.hubReceivedAt);
    assert.equal(state.foundItem.receivedBy.toString(), state.adminUserId);

    assert.equal(
      (await receiveItem(state.adminToken, state.foundItem._id, 409)).status,
      409
    );
    assert.equal(
      (await receiveItem(state.adminToken, state.lostItem._id, 400)).status,
      400
    );
    assert.equal(
      (await receiveItem(state.adminToken, "not-an-id", 400)).status,
      400
    );
  });

  it("enforces claim eligibility and claim privacy", async () => {
    const claimRes = await api("POST", "/api/claims", {
      token: state.userB.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0123456789",
        contactEmail: "b@test.local",
        ownershipDetails: "I own this bottle; it has my name sticker on it.",
      },
    });
    assert.equal(claimRes.status, 201, JSON.stringify(claimRes.data));
    assert.equal(claimRes.data.claim.adminNotes, undefined);
    state.claimB = claimRes.data.claim;

    const duplicate = await api("POST", "/api/claims", {
      token: state.userB.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0123456789",
        ownershipDetails: "Trying to claim twice with enough characters.",
      },
    });
    assert.equal(duplicate.status, 409);

    const ownItem = await api("POST", "/api/claims", {
      token: state.userA.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0123456789",
        ownershipDetails: "I reported this item, so I should not claim it.",
      },
    });
    assert.equal(ownItem.status, 409);

    const lostClaim = await api("POST", "/api/claims", {
      token: state.userC.token,
      body: {
        itemId: state.lostItem._id,
        contactPhone: "0123456789",
        ownershipDetails: "Trying to claim a lost listing should fail here.",
      },
    });
    assert.equal(lostClaim.status, 409);

    const missing = await api("POST", "/api/claims", {
      token: state.userC.token,
      body: {
        itemId: new mongoose.Types.ObjectId().toString(),
        contactPhone: "0123456789",
        ownershipDetails: "This item does not exist at all in the database.",
      },
    });
    assert.equal(missing.status, 404);

    const ownerView = await api("GET", `/api/claims/${state.claimB._id}`, {
      token: state.userB.token,
    });
    assert.equal(ownerView.status, 200);
    assert.equal(ownerView.data.claim.adminNotes, undefined);
    assert.equal(ownerView.data.claim.contactPhone, "0123456789");

    const otherView = await api("GET", `/api/claims/${state.claimB._id}`, {
      token: state.userC.token,
    });
    assert.equal(otherView.status, 403);

    const adminView = await api("GET", `/api/claims/${state.claimB._id}`, {
      token: state.adminToken,
    });
    assert.equal(adminView.status, 200);
    assert.ok(Object.prototype.hasOwnProperty.call(adminView.data.claim, "adminNotes"));

    const mine = await api("GET", "/api/claims/my", {
      token: state.userB.token,
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.claims.length, 1);
    assert.equal(mine.data.claims[0].adminNotes, undefined);

    const otherMine = await api("GET", "/api/claims/my", {
      token: state.userA.token,
    });
    assert.equal(otherMine.data.claims.length, 0);

    assert.equal(
      (await api("GET", "/api/claims?status=bogus", { token: state.adminToken }))
        .status,
      400
    );
  });

  it("awards an item to at most one claim, even under concurrent decisions", async () => {
    // Competing pending claim on the same item.
    const claimC = await api("POST", "/api/claims", {
      token: state.userC.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0987654321",
        ownershipDetails: "Actually this is my bottle, here is the sticker.",
      },
    });
    assert.equal(claimC.status, 201);
    state.claimC = claimC.data.claim;

    const approveB = await api(
      "PATCH",
      `/api/claims/${state.claimB._id}/decision`,
      {
        token: state.adminToken,
        body: {
          decision: "approved",
          adminNotes: "Verified the sticker and phone number.",
        },
      }
    );
    assert.equal(approveB.status, 200, JSON.stringify(approveB.data));
    assert.equal(approveB.data.item.status, "claimed");

    const competing = await ClaimRequest.findById(state.claimC._id);
    assert.equal(competing.status, "rejected");

    const lateClaim = await api("POST", "/api/claims", {
      token: state.userD.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0111111111",
        ownershipDetails: "Trying to claim an already reserved item here.",
      },
    });
    assert.equal(lateClaim.status, 409);

    // Two claims on a second item, approved concurrently.
    const second = await makeFoundItem(state.userA.token, state.adminToken, {
      receive: true,
    });
    const b2 = await api("POST", "/api/claims", {
      token: state.userB.token,
      body: {
        itemId: second.item._id,
        contactPhone: "0123456789",
        ownershipDetails: "I believe this second test item belongs to me.",
      },
    });
    assert.equal(b2.status, 201, JSON.stringify(b2.data));
    const c2 = await api("POST", "/api/claims", {
      token: state.userC.token,
      body: {
        itemId: second.item._id,
        contactPhone: "0987654321",
        ownershipDetails: "I also believe this second item belongs to me.",
      },
    });
    assert.equal(c2.status, 201, JSON.stringify(c2.data));

    const [decision1, decision2] = await Promise.all([
      api("PATCH", `/api/claims/${b2.data.claim._id}/decision`, {
        token: state.adminToken,
        body: { decision: "approved", adminNotes: "Concurrent approval one." },
      }),
      api("PATCH", `/api/claims/${c2.data.claim._id}/decision`, {
        token: state.adminToken,
        body: { decision: "approved", adminNotes: "Concurrent approval two." },
      }),
    ]);
    assert.deepEqual(
      [decision1.status, decision2.status].sort(),
      [200, 409]
    );

    const secondItem = await Item.findById(second.item._id);
    assert.equal(secondItem.status, "claimed");

    const approvals = await ClaimRequest.countDocuments({
      itemId: second.item._id,
      status: "approved",
    });
    const rejections = await ClaimRequest.countDocuments({
      itemId: second.item._id,
      status: "rejected",
    });
    assert.equal(approvals, 1);
    assert.equal(rejections, 1);
  });

  it("completes handover separately and blocks claims after collection", async () => {
    const handover = await api(
      "PATCH",
      `/api/claims/${state.claimB._id}/handover`,
      { token: state.adminToken }
    );
    assert.equal(handover.status, 200, JSON.stringify(handover.data));
    assert.equal(handover.data.claim.status, "completed");
    assert.equal(handover.data.item.status, "collected");

    assert.equal(
      (
        await api("PATCH", `/api/claims/${state.claimB._id}/handover`, {
          token: state.adminToken,
        })
      ).status,
      409
    );

    const collectedClaim = await api("POST", "/api/claims", {
      token: state.userD.token,
      body: {
        itemId: state.foundItem._id,
        contactPhone: "0111111111",
        ownershipDetails: "Trying to claim an item that was already collected.",
      },
    });
    assert.equal(collectedClaim.status, 409);

    const publicDetail = await api("GET", `/api/items/${state.foundItem._id}`);
    assert.equal(publicDetail.data.item.status, "collected");
  });

  it("soft-deletes with a reason, confirms pending claims, and preserves admin history", async () => {
    const third = await makeFoundItem(state.userB.token, state.adminToken, {
      receive: true,
    });
    const pending = await api("POST", "/api/claims", {
      token: state.userC.token,
      body: {
        itemId: third.item._id,
        contactPhone: "0987654321",
        ownershipDetails: "A pending claim that should be auto-rejected later.",
      },
    });
    assert.equal(pending.status, 201);

    const noReason = await api(
      "PATCH",
      `/api/items/${third.item._id}/soft-delete`,
      { token: state.adminToken, body: {} }
    );
    assert.equal(noReason.status, 400);

    const conflict = await api(
      "PATCH",
      `/api/items/${third.item._id}/soft-delete`,
      {
        token: state.adminToken,
        body: { reason: "Item was removed from the hub." },
      }
    );
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.pendingClaims, 1);

    const deleted = await api(
      "PATCH",
      `/api/items/${third.item._id}/soft-delete`,
      {
        token: state.adminToken,
        body: {
          reason: "Item was removed from the hub.",
          confirm: true,
        },
      }
    );
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.item.isDeleted, true);

    const rejectedClaim = await ClaimRequest.findById(pending.data.claim._id);
    assert.equal(rejectedClaim.status, "rejected");

    assert.equal(
      (await api("GET", `/api/items/${third.item._id}`)).status,
      404
    );

    const adminView = await api("GET", `/api/items/${third.item._id}`, {
      token: state.adminToken,
    });
    assert.equal(adminView.status, 200);
    assert.equal(adminView.data.item.isDeleted, true);

    const publicSearch = await api(
      "GET",
      `/api/items?search=${encodeURIComponent(third.item.itemName)}`
    );
    assert.equal(publicSearch.data.pagination.total, 0);

    const claimDeleted = await api("POST", "/api/claims", {
      token: state.userD.token,
      body: {
        itemId: third.item._id,
        contactPhone: "0111111111",
        ownershipDetails: "Trying to claim an item that was deleted already.",
      },
    });
    assert.equal(claimDeleted.status, 409);

    assert.equal(
      (
        await api("PATCH", `/api/items/${third.item._id}/soft-delete`, {
          token: state.adminToken,
          body: { reason: "again" },
        })
      ).status,
      409
    );
    assert.equal(
      (await receiveItem(state.adminToken, third.item._id, 409)).status,
      409
    );
  });

  it("blocks ID-based access to another user's requests and claims", async () => {
    const requestRes = await api("GET", `/api/requests/${state.foundRequest._id}`, {
      token: state.userB.token,
    });
    assert.equal(requestRes.status, 403);

    const claimRes = await api("GET", `/api/claims/${state.claimB._id}`, {
      token: state.userA.token,
    });
    assert.equal(claimRes.status, 403);
  });

  it("rejects inactive users and expired tokens", async () => {
    const eRes = await api("POST", "/api/auth/register", {
      body: {
        name: "Inactive User",
        email: "inactive@test.local",
        password: "Password123",
      },
    });
    assert.equal(eRes.status, 201);
    const eToken = eRes.data.token;

    await User.updateOne(
      { email: "inactive@test.local" },
      { $set: { isActive: false } }
    );

    const inactiveLogin = await login("inactive@test.local", "Password123");
    assert.equal(inactiveLogin.status, 403);

    const inactiveMe = await api("GET", "/api/auth/me", { token: eToken });
    assert.equal(inactiveMe.status, 403);

    const expired = jwt.sign(
      { id: state.userA.user.id },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );
    const expiredMe = await api("GET", "/api/auth/me", { token: expired });
    assert.equal(expiredMe.status, 401);
  });

  it("returns accurate dashboard and report totals", async () => {
    const dashboard = await api("GET", "/api/admin/dashboard", {
      token: state.adminToken,
    });
    assert.equal(dashboard.status, 200);
    const counts = dashboard.data.counts;

    const expected = {
      pendingRequests: await ItemRequest.countDocuments({ status: "pending" }),
      activeListings: await Item.countDocuments({
        isDeleted: false,
        status: { $in: ["open", "claimed"] },
      }),
      lostReports: await ItemRequest.countDocuments({ type: "lost" }),
      foundReports: await ItemRequest.countDocuments({ type: "found" }),
      pendingClaims: await ClaimRequest.countDocuments({ status: "pending" }),
      itemsAtHub: await Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: true,
        status: { $ne: "collected" },
      }),
      awaitingReceipt: await Item.countDocuments({
        type: "found",
        isDeleted: false,
        hubReceived: false,
      }),
      completedHandovers: await ClaimRequest.countDocuments({
        status: "completed",
      }),
      totalUsers: await User.countDocuments({}),
      adminUsers: await User.countDocuments({ role: "admin" }),
      normalUsers: await User.countDocuments({ role: "user" }),
      activeUsers: await User.countDocuments({ isActive: true }),
    };

    for (const [key, value] of Object.entries(expected)) {
      assert.equal(counts[key], value, `dashboard ${key} mismatch`);
    }

    const requestsReport = await api("GET", "/api/admin/reports/requests", {
      token: state.adminToken,
    });
    const requestSum = requestsReport.data.report.reduce(
      (sum, row) => sum + row.count,
      0
    );
    assert.equal(requestSum, await ItemRequest.countDocuments({}));

    const claimsReport = await api("GET", "/api/admin/reports/claims", {
      token: state.adminToken,
    });
    const claimSum = claimsReport.data.report.reduce(
      (sum, row) => sum + row.count,
      0
    );
    assert.equal(claimSum, await ClaimRequest.countDocuments({}));

    const inventoryReport = await api("GET", "/api/admin/reports/inventory", {
      token: state.adminToken,
    });
    assert.equal(
      inventoryReport.data.report.awaitingReceipt,
      expected.awaitingReceipt
    );
    assert.equal(inventoryReport.data.report.stored, expected.itemsAtHub);

    const usersReport = await api("GET", "/api/admin/reports/users", {
      token: state.adminToken,
    });
    assert.equal(usersReport.data.report.total, expected.totalUsers);
    assert.equal(usersReport.data.report.admins, expected.adminUsers);
    assert.equal(usersReport.data.report.normal, expected.normalUsers);
    assert.equal(usersReport.data.report.active, expected.activeUsers);
  });

  it("serves consistent public statistics", async () => {
    const res = await api("GET", "/api/stats");
    assert.equal(res.status, 200);
    const stats = res.data.stats;

    assert.equal(
      stats.totalItems,
      await Item.countDocuments({ isDeleted: false })
    );
    assert.equal(stats.totalItems, stats.lostItems + stats.foundItems);
    assert.equal(
      stats.reunited,
      await Item.countDocuments({ isDeleted: false, status: "collected" })
    );
    assert.equal(
      stats.atHub,
      await Item.countDocuments({
        isDeleted: false,
        type: "found",
        hubReceived: true,
        status: { $ne: "collected" },
      })
    );
  });

  it("returns safe 404s and handles malformed ObjectIds", async () => {
    const missingItem = await api("GET", `/api/items/${new mongoose.Types.ObjectId()}`);
    assert.equal(missingItem.status, 404);

    const missingClaim = await api(
      "GET",
      `/api/claims/${new mongoose.Types.ObjectId()}`,
      { token: state.userA.token }
    );
    assert.equal(missingClaim.status, 404);

    const missingRequest = await api(
      "GET",
      `/api/requests/${new mongoose.Types.ObjectId()}`,
      { token: state.userA.token }
    );
    assert.equal(missingRequest.status, 404);

    assert.equal(
      (await api("GET", "/api/items/inventory?hubReceived=bogus", {
        token: state.adminToken,
      })).status,
      400
    );
    assert.equal(
      (await api("GET", "/api/claims?itemId=bad-id", {
        token: state.adminToken,
      })).status,
      400
    );
  });
});
