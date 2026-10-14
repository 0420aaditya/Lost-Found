# Lost & Found Hub — MERN Application

A full-stack **M**ongoDB, **E**xpress, **R**eact, **N**ode.js version of the original
static **Lost & Found Hub** website. The original HTML pages were converted into React
components while keeping the same teal theme, Nunito font, colours, cards and layout.

> If your project folder path contains the `&` character (like `Sunway_Lost&Found_MERN`),
> `npm run` scripts can break on Windows because `cmd` treats `&` as a command separator.
> The `package.json` scripts in this project call node directly, which avoids that problem.

---

## How to run it

### Prerequisites

1. Install [Node.js](https://nodejs.org/) (v18 or newer).
2. Install [MongoDB Community Edition](https://www.mongodb.com/try/download/community)
   and make sure the `MongoDB` service is running (it usually runs automatically on Windows).

### 1. Start MongoDB (once)

```powershell
# If the service is installed, start it:
Start-Service MongoDB

# Optional: check it is running
Get-Service MongoDB
```

### 2. Start the backend (server)

```powershell
cd server
npm install

# Create your .env file from the example and edit it
Copy-Item .env.example .env
# Edit .env and set JWT_SECRET to a long random string

npm start        # runs http://localhost:5000
```

The server logs `Server running on http://localhost:5000` when it is ready.

### 3. Create the first administrator (once)

There is **no default admin password**. The seed script reads the admin details from
environment variables:

```powershell
cd server
$env:ADMIN_NAME="Site Admin"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="YourStrongPassword123"
npm run seed:admin
```

If an account already uses that email it is simply promoted to admin.

### 4. Start the frontend (client)

```powershell
cd client
npm install
npm run dev      # loads http://localhost:5173
```

Open http://localhost:5173 in your browser.

The client calls the API at `http://localhost:5000/api`. You can change that in
`client/.env` (copy from `client/.env.example`) if your server runs elsewhere.

---

## What the app does

| Who | What they can do |
| --- | ---------------- |
| **Visitor** | Browse approved lost/found items, search & filter, read details. |
| **User** (logged in) | Report items, edit/delete their own pending items, see their listing status, claim found items, track/cancel claims, answer claims on their found items. |
| **Admin** | Approve/reject listings, approve/reject claims, manage users (roles, activate/deactivate), delete inappropriate listings, view site statistics. |

Key workflow ideas:

- Every new listing is **pending** until an admin approves it. Pending and rejected
  listings are never shown publicly.
- If a user **edits an approved listing**, it returns to **pending** for re-approval.
- A user claims someone else's **found** item. The owner (or an admin) approves or
  rejects the claim.
- When a claim is **approved**, the listing becomes **resolved** and all other open
  claims on it are closed. Resolved items no longer accept claims.
- New users always get the role **user**. Only an admin can change roles. A role or
  status change takes effect the next time that user logs in (a new token is issued
  then), and deactivated users' existing tokens stop working immediately.

---

## Project structure

```
Sunway_Lost&Found_MERN/
|-- client/                     # React app (Vite)
|   |-- index.html              # Vite entry HTML (loads /src/main.jsx)
|   |-- package.json
|   |-- vite.config.js
|   |-- .env.example
|   `-- src/
|       |-- main.jsx            # ReactDOM root + BrowserRouter
|       |-- App.jsx             # Holds the logged-in user + all routes
|       |-- index.css           # Original styles.css + responsive.css + small additions
|       |-- services/
|       |   `-- api.js          # Axios instance that sends the JWT on every request
|       |-- components/
|       |   |-- Navbar.jsx      # Header/navigation (converted from the HTML)
|       |   |-- Footer.jsx      # Footer (converted from the HTML)
|       |   |-- ProtectedRoute.jsx  # Blocks pages unless logged in
|       |   |-- AdminRoute.jsx      # Blocks pages unless admin
|       |   |-- ItemCard.jsx        # The item card used on listings pages
|       |   |-- ListingsPage.jsx    # Shared search/filter page for Lost & Found
|       |   |-- ListingForm.jsx     # Create/edit listing form
|       |   `-- Alert.jsx           # Small success/error message box
|       `-- pages/
|           |-- Home.jsx, About.jsx, Contact.jsx
|           |-- LostItems.jsx, FoundItems.jsx
|           |-- ReportItem.jsx, EditListing.jsx
|           |-- ListingDetail.jsx   # Detail view + claim form
|           |-- Login.jsx, Register.jsx
|           |-- Dashboard.jsx       # User dashboard
|           |-- MyListings.jsx, MyClaims.jsx, ClaimsReceived.jsx
|           |-- AdminDashboard.jsx, AdminListings.jsx, AdminClaims.jsx
|           |-- UserManagement.jsx
|           `-- NotFound.jsx        # 404 page
|
|-- server/                     # Backend API (Express)
|   |-- server.js               # Entry point, mounts all routes
|   |-- package.json
|   |-- .env.example            # Copy to .env and fill in real values
|   |-- config/
|   |   `-- db.js               # Connects Mongoose to MongoDB
|   |-- models/
|   |   |-- User.js             # name, email, passwordHash, role, status
|   |   |-- Listing.js          # lost/found item reports
|   |   `-- Claim.js            # claims on found items
|   |-- middleware/
|   |   `-- auth.js             # "protect" + "adminOnly" middlewares
|   |-- routes/                 # one file per resource group
|   |   |-- auth.js             # register / login / me
|   |   |-- users.js            # user management (admin-only actions)
|   |   |-- listings.js         # listings + admin review
|   |   |-- claims.js           # claims + admin/owner review
|   |   `-- dashboard.js        # summary numbers for dashboards
|   `-- seeds/
|       `-- createAdmin.js      # creates the first admin from env vars
|
|-- css/                        # ORIGINAL static website (kept as reference)
|   `-- styles.css, responsive.css
|-- *.html                      # ORIGINAL pages (index, lost-items, ...)
|-- README.md
```

---

## Environment variables

### `server/.env`

```ini
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lostfound
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

### `client/.env`

```ini
VITE_API_URL=http://localhost:5000/api
```

If you leave the client `.env` out, the app uses this default anyway.

---

## Authentication & security notes (short version)

- Passwords are hashed with `bcryptjs` before saving — the plain password is never
  stored. The API never returns `passwordHash`.
- On login the server signs a **JWT** containing `{ id, role }`. The client stores it
  in `localStorage` and sends it as `Authorization: Bearer <token>`.
- The `protect` middleware checks the token signature and expiry, then loads the user
  **from the database**. A deactivated user's requests are rejected even with a valid
  token, and a changed role is picked up on the user's next login.
- The `adminOnly` middleware allows only admins. Hiding buttons in React is only for
  convenience — every rule is enforced on the server.
- **XSS trade-off (explain this in your defence):** storing the token in `localStorage`
  is simple but means any script running on your site could read it. In a real app you
  would use `HttpOnly` cookies. For this beginner project `localStorage` is acceptable.

---

## API routes

All routes below return JSON. Protected routes need `Authorization: Bearer <token>`.

### Authentication
| Method | Path | Who | Purpose |
| ------ | ---- | --- | ------- |
| POST | `/api/auth/register` | public | Create account (role is always `user`) |
| POST | `/api/auth/login` | public | Log in, returns `{ token, user }` |
| GET | `/api/auth/me` | logged in | Current user (used to restore session) |

### Users
| Method | Path | Who | Purpose |
| ------ | ---- | --- | ------- |
| GET | `/api/users` | admin | List users (search/role/status filters) |
| GET | `/api/users/:id` | self or admin | View one user |
| PUT | `/api/users/:id` | self | Edit own name/email |
| PATCH | `/api/users/:id/role` | admin | Change role (not your own) |
| PATCH | `/api/users/:id/status` | admin | Activate/deactivate (not your own) |

### Listings
| Method | Path | Who | Purpose |
| ------ | ---- | --- | ------- |
| GET | `/api/listings` | public | Approved, unresolved items (search/type/category/location) |
| GET | `/api/listings/my` | logged in | My own listings |
| GET | `/api/listings/pending` | admin | Listings waiting for review |
| GET | `/api/listings/all` | admin | Every listing |
| GET | `/api/listings/:id` | public* | One listing (*pending/rejected visible only to owner/admin) |
| POST | `/api/listings` | logged in | Create listing (starts `pending`) |
| PUT | `/api/listings/:id` | owner/admin | Edit (owner edit returns it to `pending`) |
| DELETE | `/api/listings/:id` | owner/admin | Delete (owner only for pending/rejected) |
| PATCH | `/api/listings/:id/review` | admin | Approve/reject |
| PATCH | `/api/listings/:id/resolve` | owner/admin | Mark resolved and close open claims |

### Claims
| Method | Path | Who | Purpose |
| ------ | ---- | --- | ------- |
| POST | `/api/claims` | logged in | Claim a found item |
| GET | `/api/claims/my` | logged in | My claims |
| GET | `/api/claims/received` | logged in | Claims on my found items |
| GET | `/api/claims` | admin | All claims |
| PATCH | `/api/claims/:id/review` | listing owner or admin | Approve/reject |
| PATCH | `/api/claims/:id/cancel` | claimant | Cancel my pending claim |

### Dashboards
| Method | Path | Who | Purpose |
| ------ | ---- | --- | ------- |
| GET | `/api/dashboard/user` | logged in | User summary numbers |
| GET | `/api/dashboard/admin` | admin | Site-wide numbers + recent activity |

---

## End-to-end example workflow

**1. Register two normal users and one admin**

- Open `Register` and create Alice and Bob as normal users.
- Run the seed script from the console to create the first admin (see above).

**2. Alice reports a found item**

- Alice logs in, goes to `Report Item`, fills in the form and submits.
- The listing is saved with status `pending`. It does **not** appear on the public
  `Found Items` page.
- Alice can see it in `My Listings` as *pending*.

**3. Admin approves it**

- Admin logs in, opens `Admin → Review Listings`, clicks **Approve**.
- The listing now appears publicly on `Found Items`.

**4. Bob claims the item**

- Bob (logged in) opens the item and submits a claim with a reason and identifying
  details.
- Alice sees the claim under `Claims Received` and clicks **Approve**.
- The listing becomes **resolved**, the claim becomes **approved**, and it no longer
  accepts further claims.

---

## Sample API requests

Create a listing (logged in):

```powershell
$body = @{
  title = "Black Jansport Backpack"; type = "lost"; category = "other";
  description = "Backpack with a keychain"; location = "Science Building";
  itemDate = "2026-10-01"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/listings" -Method Post `
  -ContentType "application/json" -Body $body `
  -Headers @{ Authorization = "Bearer <token>" }
```

Approve a listing (admin):

```powershell
$body = @{ status = "approved" } | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/listings/<listingId>/review" -Method Patch `
  -ContentType "application/json" -Body $body `
  -Headers @{ Authorization = "Bearer <adminToken>" }
```

---

## Manual testing checklist

Use this list to demonstrate the project works correctly.

- [ ] Register a new user, then log out and log back in.
- [ ] Try logging in with the wrong password → clear error message.
- [ ] Register the same email twice → "already exists" error.
- [ ] As a normal user, visit `/admin` → redirected away; call `GET /api/users` directly → 403.
- [ ] Call an API route without a token → 401.
- [ ] Create a listing → status `Pending`, not visible publicly.
- [ ] Open `My Listings` → your listing is pending. Edit it → still pending.
- [ ] As admin, approve the listing → it now appears on the public page; search filters work.
- [ ] As admin, reject a listing with a reason → creator sees the reason; stays hidden.
- [ ] User A reports a *found* item (approved). User B submits a claim.
- [ ] User B cannot claim their own item and cannot claim twice (409).
- [ ] User A sees the claim under `Claims Received`, approves it → item becomes `Resolved`,
      further claims are blocked, other open claims on it are closed.
- [ ] A claim that was rejected/cancelled cannot be changed again (400).
- [ ] Admin deactivates a user → that user's old token stops working (403).
- [ ] Admin changes a user's role → change applies after that user logs in again.
- [ ] Admin cannot change/deactivate their own account (400).
- [ ] Dashboards show counts that match the data created above.

---

## Known limitations & future improvements

- **Image uploads**: listings accept an image URL but there is no file upload/multipart.
  A cloud bucket (or `multer` local uploads) would make this real.
- **Email/notifications**: owners and claimants are not emailed. They must check the site.
- **Pagination**: public listings return everything; a real app would page the results.
- **Token storage**: `localStorage` is convenient but XSS-vulnerable (see security notes).
- **Contact page**: its form just shows a confirmation message — there is no mail backend.
- **Search**: uses simple MongoDB `$regex` filters — fine for a small dataset.
- **Rate limiting & password rules**: a production app would add these.
- **`identifyingDetails`** on listings is shown only on the detail page to the owner/admin,
  and on claim forms to the listing owner — the current UI keeps it simple.

## Converting back to the original site

The original static pages still live at the project root (`index.html`, `lost-items.html`,
`css/`, etc.) and are untouched. They are kept as a design reference. Delete them once you
no longer need the reference.