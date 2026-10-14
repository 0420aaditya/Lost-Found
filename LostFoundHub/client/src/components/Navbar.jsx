// components/Navbar.jsx
// Top navigation, styled to match the site header from the static pages:
// a white sticky bar with the brand on the left and a nav list on the right.
// Links change based on whether a user is logged in (and whether they are an
// admin). On small screens the list collapses behind a hamburger button.
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

function linkClass({ isActive }) {
  return isActive ? "active" : "";
}

function Navbar({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function logout() {
    onLogout();
    setOpen(false);
    navigate("/");
  }

  function close() {
    setOpen(false);
  }

  return (
    <header>
      <div className="container">
        <div className="logo">
          <Link to="/" onClick={close}>
            Lost &amp; Found Hub
          </Link>
        </div>

        <nav>
          <button
            className="nav-toggle-label"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <span></span>
          </button>

          <ul className={open ? "open" : ""}>
            <li>
              <NavLink to="/" end className={linkClass} onClick={close}>
                Home
              </NavLink>
            </li>
            <li>
              <Link to="/items?type=lost" onClick={close}>
                Lost Items
              </Link>
            </li>
            <li>
              <Link to="/items?type=found" onClick={close}>
                Found Items
              </Link>
            </li>

            {user && (
              <li>
                <NavLink to="/submit" className={linkClass} onClick={close}>
                  Report Item
                </NavLink>
              </li>
            )}
            {user && (
              <li>
                <NavLink to="/my-requests" className={linkClass} onClick={close}>
                  My Requests
                </NavLink>
              </li>
            )}
            {user && (
              <li>
                <NavLink to="/my-claims" className={linkClass} onClick={close}>
                  My Claims
                </NavLink>
              </li>
            )}

            {user && user.role === "admin" && (
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    isActive ? "active admin-link" : "admin-link"
                  }
                  onClick={close}
                >
                  Admin
                </NavLink>
              </li>
            )}

            {!user && (
              <li>
                <NavLink to="/login" className={linkClass} onClick={close}>
                  Login
                </NavLink>
              </li>
            )}
            {!user && (
              <li>
                <NavLink to="/register" className={linkClass} onClick={close}>
                  Register
                </NavLink>
              </li>
            )}

            {user && (
              <li>
                <span className="nav-user">
                  {user.name}
                  <button className="logout" onClick={logout}>
                    Logout
                  </button>
                </span>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
