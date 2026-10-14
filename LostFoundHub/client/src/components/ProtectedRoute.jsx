// components/ProtectedRoute.jsx
// Wraps a page. If there is no logged-in user it redirects to /login.
// If "admin" is true it also requires the admin role.
import { Navigate } from "react-router-dom";

function ProtectedRoute({ user, admin, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (admin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default ProtectedRoute;
