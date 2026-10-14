// pages/Register.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api.js";

function Register({ onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/auth/register", { name, email, password });
      onLogin(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Could not register");
    }
    setBusy(false);
  }

  return (
    <main>
      <section className="auth-section">
        <div className="container">
          <div className="card auth-card">
            <h1>Create account</h1>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password (at least 6 characters)</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Creating..." : "Register"}
              </button>
            </form>
            <p className="switch">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Register;
