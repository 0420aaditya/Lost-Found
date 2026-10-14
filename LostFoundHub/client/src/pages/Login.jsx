// pages/Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api.js";

function Login({ onLogin }) {
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
      const res = await api.post("/auth/login", { email, password });
      onLogin(res.data.token, res.data.user);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Could not log in");
    }
    setBusy(false);
  }

  return (
    <main>
      <section className="auth-section">
        <div className="container">
          <div className="card auth-card">
            <h1>Login</h1>
            {error && <div className="alert error">{error}</div>}
            <form onSubmit={submit}>
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
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Logging in..." : "Login"}
              </button>
            </form>
            <p className="switch">
              No account? <Link to="/register">Register</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
