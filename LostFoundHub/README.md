# Lost & Found Hub Management System

A beginner-friendly **MERN** (MongoDB, Express, React, Node.js) web app for a
campus **Lost & Found Hub**. Users report lost or found items; an admin reviews
every report before it becomes a public listing. Items that are found are
physically handed in to a central hub, and owners can claim them. The admin
verifies ownership privately and records the handover.

There are only **two roles**: `user` and `admin`.

---

## 1. How it works (simple workflow)

```
User submits request  ->  Admin reviews  ->  Request approved  ->  Official item created
        (pending)            (approve/reject)                       (public listing)
                                                                          |
                          Owner finds it on the public list  <-----------+
                                                                          |
      Found item physically handed to hub  ->  Admin marks "received at hub"
                                                                          |
                          User submits a claim  ->  Admin contacts & verifies
                                                                          |
             Admin approves claim  ->  Admin confirms handover  ->  Item "collected"
```

Key rules:

- A request is **pending** until an admin approves or rejects it.
- **Approval creates exactly one official item.** Approving twice is blocked.
- Rejected requests are **kept** (history) and cannot be approved later; the user
  simply submits a new request (which gets a new id).
- Only **approved, non-deleted** items are public.
- A **found** item is not claimable until it is physically **received at the hub**.
- **Lost** listings cannot be claimed (they are reports, not hub inventory).
- Approving a claim is **not** the handover; the admin confirms collection separately.
- Once **collected**, an item accepts no new claims.
- Claim **contact details** and **admin notes** are private: visible only to the
  admin (and the claimant for their own claim, without the admin notes).

---

## 2. Tech stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React 19 + Vite, react-router-dom, axios               |
| Backend  | Node.js + Express 5, JWT auth, multer (image uploads)  |
| Database | MongoDB with Mongoose 9                                |

---

## 3. Folder structure

```
LostFoundHub/
├─ server/                     # Express API
│  ├─ config/db.js             # MongoDB connection
│  ├─ middleware/
│  │  ├─ auth.js               # protect + requireAdmin
│  │  └─ upload.js             # multer image storage
│  ├─ models/                  # User, ItemRequest, Item, ClaimRequest
│  ├─ routes/                  # auth, requests, uploads, items, claims, admin
│  ├─ seeds/createAdmin.js     # create the first admin
│  ├─ uploads/                 # uploaded images (served at /uploads)
│  ├─ .env.example
│  ├─ package.json
│  └─ server.js                # app entry point
└─ client/                     # React app
   ├─ src/
   │  ├─ api.js, auth.js       # shared axios + session helpers
   │  ├─ components/           # Navbar, ProtectedRoute, AdminNav
   │  ├─ pages/                # user pages
   │  ├─ pages/admin/          # admin pages
   │  ├─ App.jsx, main.jsx, index.css
   ├─ .env.example
   ├─ package.json
   └─ vite.config.js
```

---

## 4. Prerequisites

- **Node.js** 18+ (built with Node 24)
- **MongoDB** running locally (default `mongodb://127.0.0.1:27017`)
- A terminal (PowerShell on Windows, bash on macOS/Linux)

---

## 5. Setup

### 5.1 Install dependencies

```powershell
# Backend
cd "LostFoundHub\server"
npm install

# Frontend (in a second terminal)
cd "LostFoundHub\client"
npm install
```

### 5.2 Environment variables

Copy each `.env.example` to `.env` and adjust if needed.

**`server/.env`**

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lostfoundhub
JWT_SECRET=replace-this-with-a-long-random-string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

**`client/.env`**

```
VITE_API_URL=http://localhost:5000/api
```

> Never commit the real `.env` files. They are already in `.gitignore`.

### 5.3 Create the first admin

Public registration can never create an admin, so the first admin is seeded:

```powershell
cd "LostFoundHub\server"
$env:ADMIN_NAME="Site Admin"; $env:ADMIN_EMAIL="admin@example.com"; $env:ADMIN_PASSWORD="Admin123456"; npm run seed:admin
```

Running it again with an existing email simply promotes that account to admin.

---

## 6. Running the app

Open **two terminals**.

```powershell
# Terminal 1 - API  (http://localhost:5000)
cd "LostFoundHub\server"
npm run dev

# Terminal 2 - React app  (http://localhost:5173)
cd "LostFoundHub\client"
npm run dev
```

Open **http://localhost:5173** in the browser.
Log in as the admin with the email/password you seeded above.

---

## 7. API overview

| Method | Endpoint                             | Access        | Purpose                              |
| ------ | ------------------------------------ | ------------- | ------------------------------------ |
| POST   | `/api/auth/register`                 | public        | create a normal user                 |
| POST   | `/api/auth/login`                    | public        | log in, returns a JWT                |
| GET    | `/api/auth/me`                       | logged in     | current user                         |
| POST   | `/api/uploads`                       | logged in     | upload one image                     |
| POST   | `/api/requests`                      | logged in     | submit a lost/found request          |
| GET    | `/api/requests/my`                   | logged in     | own requests                         |
| GET    | `/api/requests`                      | admin         | all requests (filter type/status)    |
| GET    | `/api/requests/:id`                  | owner/admin   | one request                          |
| PATCH  | `/api/requests/:id/approve`          | admin         | approve; creates one item            |
| PATCH  | `/api/requests/:id/reject`           | admin         | reject with a reason                 |
| GET    | `/api/items`                         | public        | approved, non-deleted listings       |
| GET    | `/api/items/:id`                     | public        | one item (admins may see deleted)    |
| GET    | `/api/items/my`                      | logged in     | own item records                     |
| GET    | `/api/items/all`                     | admin         | all items                            |
| GET    | `/api/items/inventory`               | admin         | found items in hub inventory         |
| PATCH  | `/api/items/:id/receive-at-hub`      | admin         | record physical receipt              |
| PATCH  | `/api/items/:id/soft-delete`         | admin         | hide a listing with a reason         |
| POST   | `/api/claims`                        | logged in     | claim an eligible found item         |
| GET    | `/api/claims/my`                     | logged in     | own claims (safe fields)             |
| GET    | `/api/claims`                        | admin         | all claims (filter status)           |
| GET    | `/api/claims/:id`                    | claimant/admin| one claim                            |
| PATCH  | `/api/claims/:id/decision`           | admin         | approve/reject with notes            |
| PATCH  | `/api/claims/:id/handover`           | admin         | confirm collection                   |
| GET    | `/api/admin/dashboard`               | admin         | dashboard counts                     |
| GET    | `/api/admin/reports/{requests,claims,inventory,users}` | admin | reports         |

---

## 8. Manual test checklist

### A. As a normal user

1. **Register** a new account and log in. You land on the **Home** page.
2. **Report Item** -> submit a *Found* item (e.g. "Blue Bottle", photo optional).
3. Open **My Requests** - it shows the request as **pending**.
4. Submit a *Lost* item too, and confirm both appear under My Requests.
5. Open **Lost Items** / **Found Items** (the Browse page at `/items`), and
   confirm your items are **not** listed yet (pending).
6. Browse and use the **search** and **Type**/**Category** filters.
7. (After an admin approves + receives an item) Open its detail page. A
   **Claim this item** form appears only for *found* items that are at the hub.
8. Submit a claim with your phone and an ownership explanation.
9. Open **My Claims** - your claim shows as **pending**.
10. Try to claim a **lost** listing: no claim form is shown.
11. Refresh the page - you stay logged in (session in localStorage).

### B. As the admin

1. Log in with the seeded admin account. An **Admin** link appears in the navbar.
2. **Admin -> Requests**: filter by **Found/Lost** and **status**. Approve your
   pending Found request; reject another with a reason.
3. Confirm the rejected request shows the reason (as the user) and cannot be
   re-approved.
4. **Admin -> Items**: find the approved found item and click **Record receipt**
   (approval alone does not mark it received).
5. **Admin -> Claims**: open a pending claim, read the claimant's private phone
   and explanation, click **Approve** and type verification notes.
6. With the item claimed, try a new claim as another user - it is refused.
7. Back in **Claims**, click **Confirm handover** - the claim becomes *completed*
   and the item becomes *collected*.
8. Try to claim the collected item again - refused.
9. **Admin -> Items**: **Delete** an item and give a reason. If it has pending
   claims you are warned first; confirming also rejects those claims.
10. Confirm the deleted item disappears from the public **Lost/Found Items** page.
11. **Admin -> Hub Inventory**: see found items, filters, and the counts
    (Found items / Currently at hub / Awaiting receipt).
12. **Admin -> Dashboard**: confirm the counters and the four reports match what
    you did above.

### C. Privacy & security spot-checks

- Browse a public item while logged out: no reporter name/email is shown.
- As a normal user, try opening `/admin` in the URL bar: you are redirected.
- Directly call `GET /api/admin/dashboard` or `GET /api/requests` with a normal
  user's token: the API returns **403**.

---

## 9. Quick debugging tips

- **"Could not connect to MongoDB"** - make sure MongoDB is running and
  `MONGODB_URI` is correct.
- **Login fails right after seeding** - check `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  and that `JWT_SECRET` is set in `server/.env`.
- **CORS error in the browser** - make sure `CLIENT_ORIGIN` matches the React
  dev URL (default `http://localhost:5173`).
- **Images do not appear** - ensure the server is running on port 5000 so
  `/uploads/...` resolves.
