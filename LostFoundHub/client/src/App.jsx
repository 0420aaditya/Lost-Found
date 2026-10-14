// App.jsx
// The app shell: holds the logged-in user in state, renders the navbar and
// footer, and maps URLs to pages. Each page gets the pieces it needs as props.
import { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { getUser, saveSession, clearSession } from "./auth.js";

import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Browse from "./pages/Browse.jsx";
import ItemDetail from "./pages/ItemDetail.jsx";
import SubmitRequest from "./pages/SubmitRequest.jsx";
import MyRequests from "./pages/MyRequests.jsx";
import MyClaims from "./pages/MyClaims.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminRequests from "./pages/admin/AdminRequests.jsx";
import AdminItems from "./pages/admin/AdminItems.jsx";
import AdminClaims from "./pages/admin/AdminClaims.jsx";
import AdminInventory from "./pages/admin/AdminInventory.jsx";

function App() {
  // Read any saved session when the app first loads.
  const [user, setUser] = useState(getUser());

  function handleLogin(token, loggedInUser) {
    saveSession(token, loggedInUser);
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearSession();
    setUser(null);
  }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/items" element={<Browse />} />
        <Route path="/items/:id" element={<ItemDetail user={user} />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/register" element={<Register onLogin={handleLogin} />} />

        {/* Logged-in users */}
        <Route
          path="/submit"
          element={
            <ProtectedRoute user={user}>
              <SubmitRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-requests"
          element={
            <ProtectedRoute user={user}>
              <MyRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-claims"
          element={
            <ProtectedRoute user={user}>
              <MyClaims />
            </ProtectedRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} admin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/requests"
          element={
            <ProtectedRoute user={user} admin>
              <AdminRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/items"
          element={
            <ProtectedRoute user={user} admin>
              <AdminItems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/claims"
          element={
            <ProtectedRoute user={user} admin>
              <AdminClaims />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute user={user} admin>
              <AdminInventory />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={
            <section className="admin-section">
              <div className="container">
                <p className="empty">Page not found.</p>
              </div>
            </section>
          }
        />
      </Routes>

      <Footer />
    </>
  );
}

export default App;
