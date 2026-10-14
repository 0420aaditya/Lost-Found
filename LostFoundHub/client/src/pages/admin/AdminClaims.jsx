// pages/admin/AdminClaims.jsx
// Review claims: read the claimant's private contact details, record a
// decision with notes, then confirm the physical handover.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";

function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (status) params.status = status;
    try {
      const res = await api.get("/claims", { params });
      setClaims(res.data.claims);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load claims");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id, decision) {
    const notes = window.prompt(
      decision === "approved"
        ? "Verification notes (what did you check?):"
        : "Reason / notes for rejecting:"
    );
    if (!notes) return;
    setError("");
    try {
      await api.patch(`/claims/${id}/decision`, { decision, adminNotes: notes });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not record decision");
    }
  }

  async function handover(id) {
    if (!window.confirm("Confirm the item was physically collected?")) return;
    setError("");
    try {
      await api.patch(`/claims/${id}/handover`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not complete handover");
    }
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Claims</h1>
          <p>Verify ownership, record a decision, then confirm the handover.</p>
        </div>
      </section>

      <section className="admin-section">
        <div className="container">
          <AdminNav />
          {error && <div className="alert error">{error}</div>}

          <div className="card">
            <form
              className="filters"
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
            >
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          </div>

          {loading ? (
            <p className="empty">Loading...</p>
          ) : claims.length === 0 ? (
            <p className="empty">No claims match.</p>
          ) : (
            claims.map((c) => (
              <div className="card" key={c._id}>
                <h3>
                  {c.itemId?.itemName || "Item removed"}{" "}
                  <span className={`status ${c.status}`}>{c.status}</span>
                </h3>
                <p className="muted">
                  Claimant: {c.claimantId?.name} ({c.claimantId?.email})
                  <br />
                  Phone: {c.contactPhone}
                  {c.contactEmail ? ` | Email: ${c.contactEmail}` : ""}
                </p>
                <p>
                  <strong>Ownership explanation:</strong> {c.ownershipDetails}
                </p>
                {c.adminNotes && (
                  <p className="muted">
                    <strong>Admin notes:</strong> {c.adminNotes}
                  </p>
                )}

                {c.status === "pending" && (
                  <div className="btn-row">
                    <button
                      className="btn small"
                      onClick={() => decide(c._id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn small danger"
                      onClick={() => decide(c._id, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {c.status === "approved" && (
                  <div className="btn-row">
                    <button
                      className="btn small"
                      onClick={() => handover(c._id)}
                    >
                      Confirm handover
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default AdminClaims;
