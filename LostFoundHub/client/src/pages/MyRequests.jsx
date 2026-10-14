// pages/MyRequests.jsx
// The logged-in user's own requests and their review status.
import { useEffect, useState } from "react";
import api from "../api.js";

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/requests/my");
        setRequests(res.data.requests);
      } catch (err) {
        setRequests([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>My Requests</h1>
          <p>Track the review status of the items you have reported.</p>
        </div>
      </section>

      <section>
        <div className="container">
          {loading ? (
            <p className="empty">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="empty">
              You have not submitted any requests yet. Use "Report Item".
            </p>
          ) : (
            requests.map((r) => (
              <div className="card" key={r._id}>
                <h3>
                  {r.itemName}{" "}
                  <span className={`status ${r.type}`}>{r.type}</span>{" "}
                  <span className={`status ${r.status}`}>{r.status}</span>
                </h3>
                <p className="muted">
                  {r.category} &middot; {r.locationLostOrFound} &middot;{" "}
                  {new Date(r.dateLostOrFound).toLocaleDateString()}
                </p>
                {r.status === "rejected" && r.rejectionReason && (
                  <p className="error">Reason: {r.rejectionReason}</p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default MyRequests;
