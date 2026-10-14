// pages/admin/AdminInventory.jsx
// The hub's physical stock: found items with search, filters and counts.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";

function AdminInventory() {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    inHub: 0,
    awaitingReceipt: 0,
  });
  const [search, setSearch] = useState("");
  const [hubReceived, setHubReceived] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (search) params.search = search;
    if (hubReceived) params.hubReceived = hubReceived;
    if (status) params.status = status;
    try {
      const res = await api.get("/items/inventory", { params });
      setItems(res.data.items);
      setCounts(res.data.counts);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load inventory");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Hub Inventory</h1>
          <p>Found items in the hub's physical storage.</p>
        </div>
      </section>

      <section className="admin-section">
        <div className="container">
          <AdminNav />
          {error && <div className="alert error">{error}</div>}

          <div className="stat-grid">
            <div className="stat">
              <div className="num">{counts.total}</div>
              <div className="label">Found items</div>
            </div>
            <div className="stat">
              <div className="num">{counts.inHub}</div>
              <div className="label">Currently at hub</div>
            </div>
            <div className="stat">
              <div className="num">{counts.awaitingReceipt}</div>
              <div className="label">Awaiting receipt</div>
            </div>
          </div>

          <div className="card">
            <form
              className="filters"
              onSubmit={(e) => {
                e.preventDefault();
                load();
              }}
            >
              <label>
                Search
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Item name..."
                />
              </label>
              <label>
                At hub
                <select
                  value={hubReceived}
                  onChange={(e) => setHubReceived(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="true">Received</option>
                  <option value="false">Not received</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="claimed">Claimed</option>
                  <option value="collected">Collected</option>
                </select>
              </label>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          </div>

          {loading ? (
            <p className="empty">Loading...</p>
          ) : items.length === 0 ? (
            <p className="empty">Nothing in inventory.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>At hub</th>
                    <th>Received on</th>
                    <th>Received by</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it._id}>
                      <td>{it.itemName}</td>
                      <td>
                        <span className={`status ${it.status}`}>
                          {it.status}
                        </span>
                      </td>
                      <td>{it.hubReceived ? "yes" : "no"}</td>
                      <td>
                        {it.hubReceivedAt
                          ? new Date(it.hubReceivedAt).toLocaleDateString()
                          : "-"}
                      </td>
                      <td>{it.receivedBy?.name || "-"}</td>
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

export default AdminInventory;
