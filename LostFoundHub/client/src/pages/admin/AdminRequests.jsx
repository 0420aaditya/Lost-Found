// pages/admin/AdminRequests.jsx
// Review pending requests and approve or reject them.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";

function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (type) params.type = type;
    if (status) params.status = status;
    try {
      const res = await api.get("/requests", { params });
      setRequests(res.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load requests");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    setError("");
    try {
      await api.patch(`/requests/${id}/approve`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not approve");
    }
  }

  async function reject(id) {
    const reason = window.prompt("Reason for rejection:");
    if (!reason) return;
    setError("");
    try {
      await api.patch(`/requests/${id}/reject`, { reason });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not reject");
    }
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Item Requests</h1>
          <p>Approve a request to publish it, or reject it with a reason.</p>
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
                Type
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">All</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </label>
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
                </select>
              </label>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          </div>

          {loading ? (
            <p className="empty">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="empty">No requests match.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Submitted by</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r._id}>
                      <td>{r.itemName}</td>
                      <td>
                        <span className={`status ${r.type}`}>{r.type}</span>
                      </td>
                      <td>{r.userId?.email}</td>
                      <td>
                        <span className={`status ${r.status}`}>{r.status}</span>
                      </td>
                      <td>
                        {r.locationLostOrFound}
                        <br />
                        <span className="muted">
                          {new Date(r.dateLostOrFound).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        {r.status === "pending" && (
                          <div className="btn-row">
                            <button
                              className="btn small"
                              onClick={() => approve(r._id)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn small danger"
                              onClick={() => reject(r._id)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default AdminRequests;
