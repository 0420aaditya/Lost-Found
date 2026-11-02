// pages/admin/AdminDashboard.jsx
// Headline counts plus the four reports. Every number comes from the API.
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
    let active = true;
    async function load() {
      try {
        const [dash, reqs, claims, inv, users] = await Promise.all([
          api.get("/admin/dashboard"),
          api.get("/admin/reports/requests"),
          api.get("/admin/reports/claims"),
          api.get("/admin/reports/inventory"),
          api.get("/admin/reports/users"),
        ]);
        if (!active) return;
        setCounts(dash.data.counts);
        setRequestsReport(reqs.data.report);
        setClaimsReport(claims.data.report);
        setInventoryReport(inv.data.report);
        setUsersReport(users.data.report);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
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
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {loading ? (
            <p className="empty">Loading...</p>
          ) : (
            <>
              {counts && (
                <div className="stat-grid">
                  <Stat num={counts.pendingRequests} label="Pending requests" />
                  <Stat num={counts.activeListings} label="Active listings" />
                  <Stat num={counts.lostReports} label="Lost reports" />
                  <Stat num={counts.foundReports} label="Found reports" />
                  <Stat num={counts.pendingClaims} label="Pending claims" />
                  <Stat num={counts.itemsAtHub} label="Items at hub" />
                  <Stat
                    num={counts.awaitingReceipt}
                    label="Awaiting receipt"
                  />
                  <Stat
                    num={counts.completedHandovers}
                    label="Completed handovers"
                  />
                  <Stat num={counts.totalUsers} label="Total users" />
                  <Stat num={counts.adminUsers} label="Admins" />
                  <Stat num={counts.normalUsers} label="Normal users" />
                  <Stat num={counts.activeUsers} label="Active users" />
                </div>
              )}

              <ReportCard title="Requests report">
                {requestsReport.length === 0 ? (
                  <p className="empty">No data.</p>
                ) : (
                  <ul>
                    {requestsReport.map((row) => (
                      <li key={`${row.type}-${row.status}`}>
                        {row.type} / {row.status}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </ReportCard>

              <ReportCard title="Claims report">
                {claimsReport.length === 0 ? (
                  <p className="empty">No data.</p>
                ) : (
                  <ul>
                    {claimsReport.map((row) => (
                      <li key={row.status}>
                        {row.status}: <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </ReportCard>

              <ReportCard title="Inventory report">
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
              </ReportCard>

              <ReportCard title="Users report">
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
                    <li>
                      Inactive: <strong>{usersReport.inactive}</strong>
                    </li>
                  </ul>
                )}
              </ReportCard>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function ReportCard({ title, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
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
