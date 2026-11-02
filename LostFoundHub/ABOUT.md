# Lost & Found Hub — Project Guide (ABOUT)

> A complete, beginner-friendly **MERN** (MongoDB, Express, React, Node) web application for reporting, browsing, claiming, and handing over lost and found items on a campus. This document explains what the project is, how it is structured, how every feature works, and what is still missing or only partially implemented.

---

## 1. What this project is

**Lost & Found Hub** is a full-stack web application where:

- **Normal users** report items they lost or found, browse listings, and claim found items that have been handed in to a central hub.
- **Admins** review submitted reports, publish or reject them, record when physical items arrive at the hub, review claims, and confirm handovers.

The core idea is a **two-stage lifecycle**:

1. A user submits a **request** (a report). It is **private and pending**.
2. An admin **approves** it, which creates an official public **item**.

This separation means rejected/spam reports are preserved for audit but never appear publicly, and only vetted listings are visible.

The UI was built to match an existing static HTML design system (same colour palette, Nunito typography, header/nav, cards, forms, footer) so all pages look consistent.

---

## 2. Goals of the system

- Let people recover lost belongings and let finders return them.
- Keep public listings trustworthy (everything is admin-approved).
- Track the physical journey of found items (at hub → claimed → collected).
- Protect private data (reporter identity, claimant phone/email, admin notes).
- Provide simple dashboards for administrators.

---

## 3. Technology stack

| Layer | Technology | Version (from package.json) |
|-------|-----------|------------------------------|
| Database | MongoDB + Mongoose | mongoose `^9.11.2` |
| Backend | Node.js + Express | express `^5.3.0` |
| Auth | JWT + bcrypt | jsonwebtoken `^9.0.3`, bcryptjs `^3.0.3` |
| Uploads | Multer | `^2.4.0` |
| Config | dotenv | `^18.0.7` |
| CORS | cors | `^2.8.6` |
| Frontend | React + Vite | react `^19.3.0`, vite `^8.3.4` |
| Routing | react-router-dom | `^7.18.4` |
| HTTP client | axios | `^1.20.0` |
| Fonts/Icons | Nunito (Google Fonts), Font Awesome 6 | CDN links in `client/index.html` |

**Runtime checked:** Node v24.21.0, npm 11.19.0 on Windows.

---

## 4. High-level architecture

```
┌──────────────────────────────┐        HTTP / JSON + JWT         ┌──────────────────────────────┐
│         React client         │  ───────────────────────────────▶│        Express server        │
│  (Vite dev server :5173)      │                                  │        (Node :5000)          │
│                              │◀───────────────────────────────  │                              │
│  Pages, components, axios    │        JSON responses            │  Routes → controllers →      │
│  localStorage session        │                                  │  Mongoose models             │
└──────────────────────────────┘                                  └──────────────┬───────────────┘
                                                                                 │
                                                                        ┌────────▼────────┐
                                                                        │    MongoDB      │
                                                                        │  lostfoundhub   │
                                                                        └─────────────────┘
                                                                                 │
                                                                        ┌────────▼────────┐
                                                                        │ uploads/ folder │
                                                                        │ served at       │
                                                                        │ /uploads/<file> │
                                                                        └─────────────────┘
```

- The client calls the API at `VITE_API_URL` (default `http://localhost:5000/api`).
- The axios instance automatically attaches `Authorization: Bearer <token>` from `localStorage`.
- Uploaded images are stored on disk in `server/uploads/` and served statically by Express.

---

## 5. Repository / folder structure

```
Sunway_Lost&Found_MERN/                ← git repository root
├── .gitignore                          ← ignores node_modules, .env, dist, working docs
├── README.md                           ← setup + manual test checklist (tracked)
├── lost_and_found_mern_master_prompt.md← original spec (git-ignored)
├── session.md                          ← working notes (git-ignored)
└── LostFoundHub/                       ← THE PROJECT
    ├── .gitignore
    ├── README.md
    ├── ABOUT.md                        ← this file
    ├── client/                         ← React frontend
    │   ├── index.html                  ← Vite entry; loads Nunito + Font Awesome
    │   ├── vite.config.js              ← dev server on port 5173
    │   ├── package.json
    │   ├── .env / .env.example         ← VITE_API_URL
    │   ├── public/
    │   └── src/
    │       ├── main.jsx                ← mounts <App/> inside <BrowserRouter>
    │       ├── App.jsx                 ← routes + session state + navbar/footer
    │       ├── api.js                  ← shared axios instance + image URL helper
    │       ├── auth.js                 ← localStorage session helpers
    │       ├── index.css               ← full design system (all styling)
    │       ├── components/
    │       │   ├── Navbar.jsx          ← responsive header/nav with active links
    │       │   ├── Footer.jsx          ← dark site footer
    │       │   ├── AdminNav.jsx        ← admin sub-navigation tabs
    │       │   ├── ProtectedRoute.jsx  ← auth/admin route guard
    │       │   ├── ImageUploader.jsx   ← validated upload with preview/progress
    │       │   ├── Pagination.jsx      ← accessible page navigation
    │       │   └── ConfirmDialog.jsx   ← accessible modal for destructive actions
    │       └── pages/
    │           ├── Home.jsx            ← hero, live stats/recent items, stories
    │           ├── Browse.jsx          ← public listings + search/filters + pagination
    │           ├── ItemDetail.jsx      ← item detail + claim form
    │           ├── Login.jsx
    │           ├── Register.jsx
    │           ├── SubmitRequest.jsx   ← report lost/found form + tips
    │           ├── MyRequests.jsx
    │           ├── MyClaims.jsx
    │           └── admin/
    │               ├── AdminDashboard.jsx
    │               ├── AdminRequests.jsx
    │               ├── AdminItems.jsx
    │               ├── AdminClaims.jsx
    │               └── AdminInventory.jsx
    └── server/                         ← Express backend
        ├── server.js                   ← app setup, middleware, route mounting
        ├── package.json
        ├── .env / .env.example         ← PORT, MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, UPLOAD_DIR
        ├── config/db.js                ← Mongo connection (throws on failure)
        ├── middleware/
        │   ├── auth.js                 ← protect + requireAdmin guards
        │   └── upload.js               ← multer disk storage, 5MB, MIME + magic-byte checks
        ├── models/
        │   ├── User.js
        │   ├── ItemRequest.js
        │   ├── Item.js
        │   └── ClaimRequest.js
        ├── routes/
        │   ├── auth.js
        │   ├── requests.js
        │   ├── uploads.js
        │   ├── items.js
        │   ├── claims.js
        │   ├── admin.js
        │   └── stats.js                ← public site-wide statistics
        ├── tests/
        │   └── integration.test.js     ← node:test API suite (separate test DB)
        ├── seeds/createAdmin.js        ← creates/promotes the first admin
        └── uploads/                    ← uploaded images (served at /uploads)
            └── .gitkeep
```

---

## 6. Data model

There are **four collections**. Relationships:

```
User 1───* ItemRequest 1───1 Item 1───* ClaimRequest *───1 User
                 (approved → creates)          (claimant)
```

### 6.1 User
| Field | Type | Notes |
|-------|------|-------|
| `name` | String | required, trimmed |
| `email` | String | required, unique, lowercase |
| `passwordHash` | String | bcrypt hash; `select:false` (never returned by default) |
| `role` | String | enum `user` \| `admin`, default `user` |
| `isActive` | Boolean | default `true`; inactive users are blocked at login and by `protect` |
| `createdAt` / `updatedAt` | Date | timestamps |

### 6.2 ItemRequest (the raw report)
| Field | Type | Notes |
|-------|------|-------|
| `userId` | ObjectId → User | who submitted it (from token) |
| `type` | String | enum `lost` \| `found` |
| `itemName` | String | required |
| `category` | String | required |
| `description` | String | required |
| `dateLostOrFound` | Date | required |
| `locationLostOrFound` | String | required |
| `imageUrl` | String | optional, e.g. `/uploads/xxx.jpg` |
| `additionalDetails` | String | optional |
| `status` | String | enum `pending` \| `approved` \| `rejected` \| `cancelled` (default `pending`) |
| `rejectionReason` | String | filled on rejection |
| `reviewedBy` | ObjectId → User | admin who reviewed |
| `reviewedAt` | Date | |
| `approvedItemId` | ObjectId → Item | filled on approval |
| timestamps | | |

### 6.3 Item (the official public listing)
| Field | Type | Notes |
|-------|------|-------|
| `sourceRequestId` | ObjectId → ItemRequest | **unique** — prevents double approval |
| `reportedBy` | ObjectId → User | who reported it (hidden publicly) |
| `type` | String | enum `lost` \| `found` |
| `itemName`, `category`, `description`, `dateLostOrFound`, `locationLostOrFound` | | copied from the request |
| `imageUrl` | String | |
| `status` | String | enum `open` \| `claimed` \| `collected` \| `resolved` (default `open`) |
| `hubReceived` | Boolean | only meaningful for **found** items |
| `hubReceivedAt` | Date | when it reached the hub |
| `receivedBy` | ObjectId → User | admin who recorded receipt |
| `isDeleted` | Boolean | soft-delete flag |
| `deletedBy`, `deletedAt`, `deletionReason` | | soft-delete audit |
| timestamps | | |

Indexes: `{ isDeleted, createdAt }`, `{ isDeleted, type, category, status }`, and
`{ type, isDeleted, hubReceived, status }` for public listings and inventory.

### 6.4 ClaimRequest
| Field | Type | Notes |
|-------|------|-------|
| `itemId` | ObjectId → Item | |
| `claimantId` | ObjectId → User | |
| `contactPhone` | String | required, private |
| `contactEmail` | String | optional, private |
| `ownershipDetails` | String | required, why it's theirs |
| `status` | String | enum `pending` \| `approved` \| `rejected` \| `needsInfo` \| `completed` |
| `adminNotes` | String | private verification notes |
| `reviewedBy`, `reviewedAt` | | |
| `handoverAt` | Date | when physically collected |
| timestamps | | |

Indexes: a **partial unique** `{ itemId, claimantId }` restricted to active statuses
(`pending`, `approved`, `needsInfo`) so a user cannot hold two active claims on one
item, plus `{ status, createdAt }` and `{ itemId, status }` for admin review.

---

## 7. Roles and permissions

| Capability | Guest | User | Admin |
|-----------|:----:|:----:|:-----:|
| Browse approved items / view detail | ✅ | ✅ | ✅ |
| Register / log in | ✅ | ✅ | ✅ |
| Submit a lost/found request | ❌ | ✅ | ✅ |
| View own requests / claims | ❌ | ✅ | ✅ |
| Upload an image | ❌ | ✅ | ✅ |
| Claim a found item at the hub | ❌ | ✅ | 🚫 own item |
| Approve/reject requests | ❌ | ❌ | ✅ |
| Receive items at hub | ❌ | ❌ | ✅ |
| Soft-delete items | ❌ | ❌ | ✅ |
| Review claims / confirm handover | ❌ | ❌ | ✅ |
| Dashboard + reports / inventory | ❌ | ❌ | ✅ |
| See soft-deleted items | ❌ | ❌ | ✅ |

Guards: `protect` (valid JWT → loads real user, blocks inactive) and `requireAdmin` (`role === "admin"`).

---

## 8. End-to-end workflows

### 8.1 Reporting and approval
1. User logs in and submits a **request** (lost or found) → status `pending`.
2. Public listings **do not show it**.
3. Admin opens **Admin → Requests**, filters, and either:
   - **Approve** → creates exactly **one** public `Item` (`status: open`, `hubReceived: false`) and marks the request `approved`; or
   - **Reject** with a required reason → request `rejected`; the user sees the reason.
4. The unique index on `sourceRequestId` makes double-approval impossible.

### 8.2 Hub receipt (found items)
1. A found item is approved but is **not yet** in the hub.
2. When the physical item arrives, an admin clicks **Record receipt**.
3. This sets `hubReceived: true`, `hubReceivedAt`, `receivedBy`.
4. Approval and receipt are deliberately **separate** steps.

### 8.3 Claiming and handover
1. A logged-in user opens a **found** item that is **at the hub** and **open** → a claim form appears.
2. They submit phone + optional email + ownership explanation → claim `pending`.
3. Admin reviews the private contact details and:
   - **Approve** (admin notes required) → item becomes `claimed`; all other pending claims on that item are **auto-rejected**;
   - **Reject** (admin notes required).
4. Admin later clicks **Confirm handover** on the approved claim → claim `completed`, item `collected`.
5. A collected item can no longer be claimed.

### 8.4 Soft deletion
- Admin deletes a listing with a required reason.
- If pending claims exist, the API returns **409** with a warning; re-sending with `confirm: true` deletes the item and **auto-rejects** its pending claims.
- Deleted items disappear from public listings (detail returns 404) but remain visible to admins.

---

## 9. API reference

Base URL: `http://localhost:5000/api`

### Auth — `routes/auth.js`
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/auth/register` | public | Register (role is always `user`) |
| POST | `/auth/login` | public | Log in, returns `{ token, user }` |
| GET | `/auth/me` | logged in | Restore session from token |

### Requests — `routes/requests.js`
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/requests` | logged in | Create a pending lost/found request |
| GET | `/requests/my` | logged in | Own requests (newest first) |
| GET | `/requests?type=&status=` | admin | All requests, filter by type/status |
| GET | `/requests/:id` | owner/admin | One request with populated refs |
| PATCH | `/requests/:id/approve` | admin | Approve → create one Item |
| PATCH | `/requests/:id/reject` | admin | Reject with required `reason` |

### Uploads — `routes/uploads.js`
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/uploads` | logged in | Multipart `image`; returns `{ imageUrl, size, mimetype }` |

### Items — `routes/items.js`
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/items?search=&type=&category=&status=&location=&sort=&page=&limit=` | public | Approved, non-deleted listings (paginated) |
| GET | `/items/my` | logged in | Own official items |
| GET | `/items/all` | admin | All items incl. soft-deleted |
| GET | `/items/inventory?search=&category=&status=&hubReceived=` | admin | Found items + counts |
| GET | `/items/:id` | public (admin sees deleted) | One item (public fields only) |
| PATCH | `/items/:id/receive-at-hub` | admin | Record hub receipt (found only) |
| PATCH | `/items/:id/soft-delete` | admin | Hide listing (`reason`, optional `confirm`) |

### Claims — `routes/claims.js`
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/claims` | logged in | Claim a found item at the hub |
| GET | `/claims/my` | logged in | Own claims (admin notes stripped) |
| GET | `/claims?status=&itemId=` | admin | All claims with private details |
| GET | `/claims/:id` | claimant/admin | One claim (field-level privacy) |
| PATCH | `/claims/:id/decision` | admin | `{ decision: approved\|rejected, adminNotes }` |
| PATCH | `/claims/:id/handover` | admin | Complete an approved claim |

### Admin reports — `routes/admin.js` (all admin-only)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/dashboard` | Headline counters (requests, listings, claims, hub, users) |
| GET | `/admin/reports/requests` | Requests grouped by type + status |
| GET | `/admin/reports/claims` | Claims grouped by status |
| GET | `/admin/reports/inventory` | Awaiting receipt / stored / collected |
| GET | `/admin/reports/users` | Total / admins / normal / active |

### Public utility
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | `{ status: "ok", message }` |
| GET | `/api/stats` | `{ stats: { totalItems, lostItems, foundItems, reunited, atHub } }` |
| GET | `/uploads/<file>` | Static uploaded images |

**Pagination:** `GET /items` returns
`{ items, pagination: { page, limit, total, totalPages } }`; `limit` is capped at
50. Invalid IDs, filter values, dates, and image URLs return **400**, not 500.
The central error handler maps validation/cast errors to 400, duplicates to 409,
oversized bodies/files to 413, and unexpected errors to a generic 500.

---

## 10. Frontend routes and pages

| Route | Page | Who | What it shows |
|-------|------|-----|---------------|
| `/` | Home | anyone | Hero, How It Works, live stats, newest real items |
| `/items` | Browse | anyone | Search + filters + item grid + pagination (URL-persisted) |
| `/items/:id` | ItemDetail | anyone | Full item details; claim form only when claimable |
| `/login` | Login | guest | Login form |
| `/register` | Register | guest | Registration form |
| `/submit` | SubmitRequest | logged in | Report form (`?type=lost\|found` presets) + tips |
| `/my-requests` | MyRequests | logged in | Own reports + status + rejection reason |
| `/my-claims` | MyClaims | logged in | Own claims + status |
| `/admin` | AdminDashboard | admin | Counters + four reports |
| `/admin/requests` | AdminRequests | admin | Filter/approve/reject requests |
| `/admin/items` | AdminItems | admin | Record receipt / soft-delete |
| `/admin/claims` | AdminClaims | admin | Review claims / confirm handover |
| `/admin/inventory` | AdminInventory | admin | Found-item inventory + counts |
| `*` | Not found | anyone | "Page not found." |

`ProtectedRoute` redirects guests to `/login` and non-admins away from admin routes.

---

## 11. UI / design system

Defined entirely in `client/src/index.css`, ported from the original static site.

**Colours**
- Primary (teal): `#1e9fab`; dark: `#187f88`
- Secondary (orange): `#ff9f43`; dark: `#e58e3d`
- Accent (green): `#47b881`
- Light bg: `#f8f9fa`; dark text: `#343a40`; gray: `#6c757d`; light gray: `#e9ecef`
- Error `#e74c3c`, warning `#f39c12`, info `#3498db`
- Radius `8px`, shadow `0 4px 6px rgba(0,0,0,.1)`, transition `all .3s ease`

**Typography:** Nunito (300/400/600/700); h1 `2.5rem`, h2 `2rem`, h3 `1.5rem`, headings weight 700.

**Components:** sticky white header with logo + nav (active underline, mobile hamburger), `.page-header`, `.hero`, `.section-title` (orange underline), `.items-grid`/`.item-card` with `.item-image` + `.item-details`, status pills, `.search-filter`/`.search-bar`/`.filter-options`, `.form-container`, radio/file-upload, `.stat-grid`, `.admin-nav` pills, `.table-wrap`, `.tips-section`, `.story-card`, dark footer with social icons. Phase additions: image-uploader (preview/progress/remove), numbered pagination, and an accessible `ConfirmDialog` (Escape/backdrop close, focus management, busy state) used for reject/delete/claim decisions.

**Responsive breakpoints:** 1200 / 992 / 768 / 576 px (nav collapses at 768).

---

## 12. Key business rules and validation

- Registration always creates `role: "user"`; clients cannot self-assign admin.
- Password minimum length 6; hashed with bcrypt (10 rounds).
- Only `pending` requests can be approved or rejected (rejected cannot be revived).
- A request can produce exactly one item (unique `sourceRequestId`).
- Only **found** items can be received at the hub.
- A claim requires: item is found, not deleted, `hubReceived`, and `status === "open"`.
- Users cannot claim items they reported themselves.
- No duplicate active claim by the same user on the same item.
- Approving a claim sets item `claimed` and auto-rejects other pending claims.
- Handover requires an `approved` claim; it sets claim `completed` and item `collected`.
- Soft-delete requires a reason; pending claims trigger a 409 unless `confirm: true`.
- Public responses exclude `reportedBy`, `sourceRequestId`, deletion info, and admin-only fields.
- Claimant responses exclude `adminNotes`.
- Inactive accounts are rejected at login and in `protect`.

---

## 13. Security and privacy

**Implemented**
- bcrypt password hashing; hash never serialized.
- JWT auth (default 7-day expiry); middleware reloads the user from DB instead of trusting token claims.
- Role-based access control (`protect` + `requireAdmin`).
- Cross-user isolation (owners only see their own requests/claims).
- Field-level privacy on public item and claim payloads.
- Upload validation: MIME allow-list **plus magic-byte verification** (JPEG/PNG/GIF/WebP); 5 MB limit; random unique filenames; invalid files deleted.
- Central error handler hides stack traces; maps validation/cast/duplicate/oversize/Multer errors to safe 4xx responses.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`; `x-powered-by` disabled.
- CORS restricted to `CLIENT_ORIGIN`; JSON body limit 1 MB.
- In-memory rate limiting on auth endpoints (50 requests / 15 min per IP), skipped in tests.
- `TRUST_PROXY` support for correct client IPs behind a reverse proxy.
- Input length limits on all user-supplied strings (names, emails, descriptions, reasons, notes).
- Secrets in `.env` (git-ignored); `.env.example` provided; startup validates `MONGODB_URI`/`JWT_SECRET` and warns on weak secrets.
- Soft-delete retains audit data.

**Weaknesses / not implemented**
- JWT stored in `localStorage` (exposed if XSS occurs).
- Rate limiting is in-memory and per-process (not shared across instances) and covers auth routes only.
- Security headers are set manually; no `helmet` dependency, no CSP.
- No HTML sanitization (data is rendered as text by React, which mitigates XSS).
- No CSRF protection (token-in-header mitigates).
- No password reset / email verification / 2FA.
- No account lockout; `isActive` exists but no UI/endpoint to manage it.
- No audit log beyond per-record fields.

---

## 14. Environment variables

### `server/.env`
```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lostfoundhub
JWT_SECRET=replace-this-with-a-long-random-string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
# Optional
# UPLOAD_DIR=uploads          # relative to server/ or absolute; use persistent storage in production
# TRUST_PROXY=true            # when behind Nginx/Heroku/etc.
```

Uploaded images are stored on local disk. Point `UPLOAD_DIR` at a persistent
volume in production; an ephemeral filesystem will lose images on redeploy.

### `client/.env`
```
VITE_API_URL=http://localhost:5000/api
```

---

## 15. Setup and run

**Prerequisites:** Node.js, npm, and a running MongoDB instance.

```powershell
# 1. Backend dependencies
cd LostFoundHub/server
npm install

# 2. Backend env
Copy-Item .env.example .env
# edit .env (set a strong JWT_SECRET)

# 3. Create the first admin
$env:ADMIN_NAME="Site Admin"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="Admin123456"; npm run seed:admin

# 4. Start the API (http://localhost:5000)
npm run dev

# 5. Frontend (new terminal)
cd ../client
npm install
Copy-Item .env.example .env
npm run dev        # http://localhost:5173

# 6. Production build (optional)
npm run build
```

> On Windows, paths containing `&` can break some npm scripts; the project scripts call `node node_modules/...` directly to avoid this.

**Default admin (as seeded):** `admin@example.com` / `Admin123456` — change these in production.

---

## 16. Verification performed

- **Automated API tests:** `cd server; npm test` runs
  `server/tests/integration.test.js` on Node's built-in test runner. It uses a
  dedicated `lostfoundhub_test` database and `server/uploads-test/`, drops only
  that test database, and **passes 18/18**.
- The suite covers auth/role injection, authorization, validation (filters, IDs,
  dates, image URLs, malformed JSON), real vs spoofed/oversized uploads, the full
  request → approval → receipt → claim → handover lifecycle, duplicate/concurrent
  approvals and claims, privacy of contact/admin fields, soft-delete conflicts,
  inactive/expired tokens, dashboard/report totals, public stats, and safe 404s.
- Full production build of the client succeeds (101 modules; ~19 kB CSS,
  ~369 kB JS before gzip).
- Server health check returns `ok`; MongoDB connects.
- Admin login returns the `admin` role; dashboard counters and reports respond.
- Public `/api/items` and `/api/stats` respond correctly.

Run the suite with MongoDB running:

```powershell
cd LostFoundHub/server
npm test
```

---

## 17. Feature status matrix

### Fully implemented and working
- User registration, login, session persistence, logout.
- Role-based access control (user/admin) and route guards.
- Report lost/found items with optional image upload.
- Admin approval/rejection of reports (with duplicate-approval protection).
- Public browsing, text search, and type/category/location/status filters.
- Item detail pages with public-field filtering.
- Hub receipt tracking for found items.
- Claim submission with eligibility rules and duplicate protection.
- Admin claim review with required notes; auto-reject competing claims.
- Handover confirmation (claim completed, item collected).
- Soft-delete with reason, 409 warning, and auto-rejection of pending claims.
- Admin dashboard with headline counters and 4 reports.
- Hub inventory with global counts and filters.
- **Pagination** on public listings and admin tables, plus server-side sorting.
- Home page uses **real `/api/stats` and newest-item data** (no placeholders).
- Image uploads with preview, progress, replace/remove, and client-side validation.
- Responsive, consistent UI matching the static design.
- Session-safe rendering: navbar/pages adapt to guest/user/admin.
- Automated integration test suite (18 tests) via `npm test`.

### Partially implemented / present in data model but not wired up
| Item | Status | Detail |
|------|--------|--------|
| Claim status `needsInfo` | **Partial** | Exists in the enum and duplicate-check logic, but no endpoint/UI sets it. Admin can only approve/reject. |
| Item status `resolved` | **Partial** | Exists in the enum but nothing ever sets it. Lost items cannot be marked "found/resolved". |
| Request status `cancelled` | **Partial** | Exists in the enum but there is no "cancel my request" endpoint/UI. |
| `GET /api/items/my` | **Unused** | Endpoint exists; no frontend page consumes it (no "My Items" page). |
| Home "Success Stories" | **Partial** | Stats and recent items are live; the single success-story card remains illustrative static copy. |
| About / Contact pages | **Removed/absent** | The static versions were deleted during cleanup; the React app has no About/Contact routes. Footer only links Home/Items/Report. |
| Footer social links | **Placeholder** | Point to `#`. Contact details are static. |
| Claim decision notifications | **Missing** | Users must refresh "My Claims"; no email/in-app notification. |

### Not implemented (gaps / future work)
- **Admin user management:** `isActive` exists and reports count active users, but no endpoint/UI to deactivate, promote, or list users.
- **Editing:** no edit/update for requests or items after creation (only approve/reject/delete).
- **Lost-item resolution flow:** no way to close a lost listing when the owner recovers the item.
- **Request withdrawal:** users cannot cancel pending requests.
- **Image lifecycle:** no cleanup of orphaned files (upload-before-submit failures; rejection; soft-delete) and no deletion of files on disk.
- **Full-text search:** escaped regex search only; no Mongo text index (can be slow at scale).
- **Notifications:** no email/SMS/websocket; no admin alerting for new reports/claims.
- **Password reset / change password / profile editing.**
- **Account management:** no self-service account deletion.
- **Hardened security:** no CSP/`helmet`, no shared (cluster/Redis) rate limiting, no lockout.
- **CI/CD, Docker/deployment configs** (the app has an automated API test suite but no pipeline).
- **Frontend/E2E tests:** only the backend API is covered automatically.
- **Observability:** only `console.log`/`console.error`; no structured logging/metrics.
- **Accessibility audit** (focus management, ARIA, color contrast verification).
- **Image processing** (compression, thumbnails, multiple images).
- **Localization / timezone formatting** beyond `toLocaleDateString()`.
- **Seed data** for demo listings (only the admin is seeded).
- **Database migrations/index management** beyond Mongoose auto-index.
- **API documentation tooling** (Swagger/OpenAPI) — this file is the closest reference.

---

## 18. Known edge cases and behaviours to be aware of

- Approving a request does **not** mark the item as received at the hub — that is a separate admin action.
- A lost item can never be "received at the hub"; only found items are hub inventory.
- Public listings include items in any status (`open`, `claimed`, `collected`, `resolved`) as long as they are not soft-deleted; the Home "recent items" can therefore include claimed/collected items.
- The Browse category filter is free text, while the report form uses a fixed category dropdown — values may not always match exactly.
- Soft-deleted items return 404 publicly but are visible to admins (via token) and in `/items/all`.
- A user cannot claim their own found item.
- Duplicate active claims by the same user are blocked; after a rejection they could claim again.
- If an admin deletes an item that has pending claims, confirming auto-rejects those claims.
- Uploaded images are served from `/uploads` with no access control (they are effectively public if the URL is known).
- JWT expiry defaults to 7 days; there is no refresh-token flow.

---

## 19. Suggested next steps (roadmap)

1. Add an admin **Users** page (list, activate/deactivate, promote) — exposes the existing `isActive`/`role` fields.
2. Add **request cancellation** and **lost-item resolution** flows.
3. Implement **`needsInfo`** claim state (admin asks claimant for more info) and notifications.
4. Add a Mongo **text index** for search once data volume grows.
5. Add **frontend/E2E tests** (e.g. Playwright) and a **CI** pipeline around the existing API suite.
6. Add **image cleanup** on rejection/deletion and store images in durable object storage.
7. Harden security further: CSP/`helmet`, shared (Redis) rate limiting, password reset, safer token storage.
8. Add **About / Contact** pages to the React app (recreate from the original static design).
9. Replace the remaining illustrative success story with real reunion data.
10. Add **Docker Compose** and deployment documentation.

---

## 20. Quick glossary

- **Request** — a user's raw lost/found report (private until approved).
- **Item** — the official, public listing created from an approved request.
- **Hub** — the physical lost-and-found desk where found items are stored.
- **Hub receipt** — confirmation that a found item physically reached the hub.
- **Claim** — a user's request to recover a found item, with proof of ownership.
- **Handover** — the admin confirming the owner physically collected the item.
- **Soft delete** — hiding a record without removing it from the database.
- **JWT** — signed token proving the user is logged in.

---

*This document describes the project as built. For setup steps and a step-by-step manual test checklist, see `README.md` in the same folder.*
