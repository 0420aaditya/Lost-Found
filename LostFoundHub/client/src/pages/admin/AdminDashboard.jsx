// pages/admin/AdminDashboard.jsx
// Headline counts plus the four simple reports.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";

function AdminDashboard() {
  const [counts, setCounts] = useState(null);
  const [requestsReport, setRequestsReport] = useState([]);
  const [claimsReport, setClaimsReport] = useState([]);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [usersReport, setUsersReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dash, reqs, claims, inv, users] = await Promise.all([
          api.get("/admin/dashboard"),
          api.get("/admin/reports/requests"),
          api.get("/admin/reports/claims"),
          api.get("/admin/reports/inventory"),
          api.get("/admin/reports/users"),
        ]);
        setCounts(dash.data.counts);
        setRequestsReport(reqs.data.report);
        setClaimsReport(claims.data.report);
        setInventoryReport(inv.data.report);
        setUsersReport(users.data.report);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load dashboard");
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Admin Dashboard</h1>
          <p>An overview of requests, listings, claims and hub activity.</p>
        </div>
      </section>

      <section className="admin-section">
        <div className="container">
          <AdminNav />
          {error && <div className="alert error">{error}</div>}
          {loading ? (
            <p className="empty">Loading...</p>
          ) : (
            <>
              {counts && (
                <div className="stat-grid">
                  <Stat num={counts.pendingRequests} label="Pending requests" />
                  <Stat num={counts.approvedListings} label="Approved listings" />
                  <Stat num={counts.lostReports} label="Lost reports" />
                  <Stat num={counts.foundReports} label="Found reports" />
                  <Stat num={counts.pendingClaims} label="Pending claims" />
                  <Stat num={counts.itemsAtHub} label="Items at hub" />
                  <Stat
                    num={counts.completedHandovers}
                    label="Completed handovers"
                  />
                  <Stat num={counts.totalUsers} label="Users" />
                </div>
              )}

              <div className="card">
                <h2>Requests report</h2>
                {requestsReport.length === 0 ? (
                  <p className="empty">No data.</p>
                ) : (
                  <ul>
                    {requestsReport.map((row, i) => (
                      <li key={i}>
                        {row.type} / {row.status}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h2>Claims report</h2>
                {claimsReport.length === 0 ? (
                  <p className="empty">No data.</p>
                ) : (
                  <ul>
                    {claimsReport.map((row, i) => (
                      <li key={i}>
                        {row.status}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card">
                <h2>Inventory report</h2>
                {inventoryReport && (
                  <ul>
                    <li>
                      Awaiting receipt:{" "}
                      <strong>{inventoryReport.awaitingReceipt}</strong>
                    </li>
                    <li>
                      Currently stored:{" "}
                      <strong>{inventoryReport.stored}</strong>
                    </li>
                    <li>
                      Collected: <strong>{inventoryReport.collected}</strong>
                    </li>
                  </ul>
                )}
              </div>

              <div className="card">
                <h2>Users report</h2>
                {usersReport && (
                  <ul>
                    <li>
                      Total: <strong>{usersReport.total}</strong>
                    </li>
                    <li>
                      Admins: <strong>{usersReport.admins}</strong>
                    </li>
                    <li>
                      Normal users: <strong>{usersReport.normal}</strong>
                    </li>
                    <li>
                      Active: <strong>{usersReport.active}</strong>
                    </li>
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

// Tiny presentational helper for a single stat box.
function Stat({ num, label }) {
  return (
    <div className="stat">
      <div className="num">{num}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export default AdminDashboard;
