// pages/MyRequests.jsx
// The logged-in user's own requests and their review status.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";

function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/requests/my");
        if (!active) return;
        setRequests(res.data.requests);
      } catch (err) {
        if (!active) return;
        setRequests([]);
        setError(
          err.response?.data?.message || "Could not load your requests."
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

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
          {error && (
            <div className="alert error" role="alert">
              {error}{" "}
              <button
                type="button"
                className="btn btn-sm secondary"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <p className="empty">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="empty">
              You have not submitted any requests yet.{" "}
              <Link to="/submit">Report an item</Link> to get started.
            </p>
          ) : (
            requests.map((request) => (
              <div className="card" key={request._id}>
                <h3>
                  {request.itemName}{" "}
                  <span className={`status ${request.type}`}>
                    {request.type}
                  </span>{" "}
                  <span className={`status ${request.status}`}>
                    {request.status}
                  </span>
                </h3>
                <p className="muted">
                  {request.category} &middot; {request.locationLostOrFound}{" "}
                  &middot;{" "}
                  {new Date(request.dateLostOrFound).toLocaleDateString()}
                </p>
                {request.status === "rejected" && request.rejectionReason && (
                  <p className="error">Reason: {request.rejectionReason}</p>
                )}
                {request.status === "approved" && request.approvedItemId && (
                  <p className="success">
                    Approved and published as an official listing.
                  </p>
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
