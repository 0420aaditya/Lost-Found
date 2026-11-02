// pages/MyClaims.jsx
// The logged-in user's own claims and their status. Private admin notes are
// never sent to this page by the server.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";

function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/claims/my");
        if (!active) return;
        setClaims(res.data.claims);
      } catch (err) {
        if (!active) return;
        setClaims([]);
        setError(err.response?.data?.message || "Could not load your claims.");
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
          <h1>My Claims</h1>
          <p>See the status of the items you have asked to claim.</p>
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
          ) : claims.length === 0 ? (
            <p className="empty">
              You have not claimed any items yet.{" "}
              <Link to="/items?type=found">Browse found items</Link>.
            </p>
          ) : (
            claims.map((claim) => (
              <div className="card" key={claim._id}>
                <h3>
                  {claim.itemId?.itemName || "Item removed"}{" "}
                  <span className={`status ${claim.status}`}>
                    {claim.status}
                  </span>
                </h3>
                <p className="muted">
                  Claimed on{" "}
                  {new Date(claim.createdAt).toLocaleDateString()}
                </p>
                <p>{claim.ownershipDetails}</p>
                {claim.status === "rejected" && (
                  <p className="error">
                    This claim was not approved. Contact the hub if you believe
                    this is a mistake.
                  </p>
                )}
                {claim.status === "completed" && (
                  <p className="success">
                    Handover completed. Thank you!
                  </p>
                )}
                {claim.itemId?._id && (
                  <Link to={`/items/${claim.itemId._id}`}>View item</Link>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default MyClaims;
