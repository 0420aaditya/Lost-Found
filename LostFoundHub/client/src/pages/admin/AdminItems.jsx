// pages/admin/AdminItems.jsx
// Manage official items: record hub receipt and soft-delete listings.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";

function AdminItems() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/items/all");
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load items");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function receive(id) {
    setError("");
    try {
      await api.patch(`/items/${id}/receive-at-hub`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not record receipt");
    }
  }

  async function softDelete(id) {
    const reason = window.prompt("Reason for removing this listing:");
    if (!reason) return;
    setError("");
    try {
      await api.patch(`/items/${id}/soft-delete`, { reason });
      load();
    } catch (err) {
      // 409 means there are pending claims and the admin must confirm.
      if (err.response?.status === 409) {
        const ok = window.confirm(err.response.data.message);
        if (!ok) return;
        try {
          await api.patch(`/items/${id}/soft-delete`, { reason, confirm: true });
          load();
        } catch (err2) {
          setError(err2.response?.data?.message || "Could not delete");
        }
      } else {
        setError(err.response?.data?.message || "Could not delete");
      }
    }
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Manage Items</h1>
          <p>Record when a found item reaches the hub, or remove a listing.</p>
        </div>
      </section>

      <section className="admin-section">
        <div className="container">
          <AdminNav />
          {error && <div className="alert error">{error}</div>}

          {loading ? (
            <p className="empty">Loading...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>At hub</th>
                    <th>Reported by</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it._id}
                      style={it.isDeleted ? { opacity: 0.55 } : {}}
                    >
                      <td>
                        {it.itemName}
                        {it.isDeleted && (
                          <>
                            <br />
                            <span className="error">
                              deleted: {it.deletionReason}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`status ${it.type}`}>{it.type}</span>
                      </td>
                      <td>
                        <span className={`status ${it.status}`}>
                          {it.status}
                        </span>
                      </td>
                      <td>{it.hubReceived ? "yes" : "no"}</td>
                      <td>{it.reportedBy?.email}</td>
                      <td>
                        {!it.isDeleted && (
                          <div className="btn-row">
                            {it.type === "found" && !it.hubReceived && (
                              <button
                                className="btn small"
                                onClick={() => receive(it._id)}
                              >
                                Record receipt
                              </button>
                            )}
                            <button
                              className="btn small danger"
                              onClick={() => softDelete(it._id)}
                            >
                              Delete
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

export default AdminItems;
