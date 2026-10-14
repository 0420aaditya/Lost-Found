// pages/MyClaims.jsx
// The logged-in user's own claims and their status. Private admin notes are
// never sent to this page by the server.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api.js";

function MyClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/claims/my");
        setClaims(res.data.claims);
      } catch (err) {
        setClaims([]);
      }
      setLoading(false);
    }
    load();
  }, []);

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
          {loading ? (
            <p className="empty">Loading...</p>
          ) : claims.length === 0 ? (
            <p className="empty">You have not claimed any items yet.</p>
          ) : (
            claims.map((c) => (
              <div className="card" key={c._id}>
                <h3>
                  {c.itemId?.itemName || "Item removed"}{" "}
                  <span className={`status ${c.status}`}>{c.status}</span>
                </h3>
                <p className="muted">
                  Claimed on {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <p>{c.ownershipDetails}</p>
                {c.status === "completed" && (
                  <p className="success">Handover completed. Thank you!</p>
                )}
                {c.itemId?._id && (
                  <Link to={`/items/${c.itemId._id}`}>View item</Link>
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
