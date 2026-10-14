// components/AdminNav.jsx
// Small set of links shown at the top of every admin page.
import { NavLink } from "react-router-dom";

function linkClass({ isActive }) {
  return isActive ? "active" : "";
}

function AdminNav() {
  return (
    <div className="admin-nav">
      <NavLink to="/admin" end className={linkClass}>
        Dashboard
      </NavLink>
      <NavLink to="/admin/requests" className={linkClass}>
        Requests
      </NavLink>
      <NavLink to="/admin/items" className={linkClass}>
        Items
      </NavLink>
      <NavLink to="/admin/claims" className={linkClass}>
        Claims
      </NavLink>
      <NavLink to="/admin/inventory" className={linkClass}>
        Hub Inventory
      </NavLink>
    </div>
  );
}

export default AdminNav;
