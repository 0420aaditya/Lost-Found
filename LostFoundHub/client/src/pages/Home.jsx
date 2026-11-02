// pages/Home.jsx
// Landing page: hero, how the hub works, recent approved items, and live
// aggregate statistics from the API (never fabricated numbers).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { imageSrc } from "../api.js";

function Home() {
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [itemsRes, statsRes] = await Promise.all([
          api.get("/items", { params: { limit: 4, sort: "newest" } }),
          api.get("/stats"),
        ]);
        if (!active) return;
        setRecent(itemsRes.data.items);
        setStats(statsRes.data.stats);
      } catch (err) {
        if (!active) return;
        setRecent([]);
        setStats(null);
        setError(
          err.response?.data?.message || "Could not load the latest hub data."
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
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Lost something? Found something?</h1>
            <h2>Let's reconnect you.</h2>
            <p>
              Report an item, browse admin-reviewed listings, and submit a claim.
              Found items are only claimable once they are physically at the hub.
            </p>
            <div className="hero-buttons">
              <Link to="/submit?type=lost" className="btn btn-primary">
                Report Lost Item
              </Link>
              <Link to="/submit?type=found" className="btn btn-secondary">
                Report Found Item
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-icon">
                <i className="fas fa-clipboard"></i>
              </div>
              <h3>Report</h3>
              <p>
                Submit details about the item you lost or found, including the
                location, date and an optional photo.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">
                <i className="fas fa-user-shield"></i>
              </div>
              <h3>Admin Review</h3>
              <p>
                An admin reviews every report. Approved reports become public
                listings, and found items wait to be handed to the hub.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">
                <i className="fas fa-handshake"></i>
              </div>
              <h3>Claim &amp; Collect</h3>
              <p>
                If a found item is yours, submit a claim. The admin verifies
                ownership privately and records the handover.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Items Section */}
      <section className="recent-items">
        <div className="container">
          <h2 className="section-title">Recent Items</h2>

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
            <p className="empty text-center">Loading...</p>
          ) : recent.length === 0 ? (
            <p className="empty text-center">
              No items have been listed yet. Be the first to report one!
            </p>
          ) : (
            <div className="items-grid">
              {recent.map((item) => (
                <Link
                  className="item-card"
                  key={item._id}
                  to={`/items/${item._id}`}
                >
                  <div className="item-image">
                    {item.imageUrl ? (
                      <img
                        src={imageSrc(item.imageUrl)}
                        alt={item.itemName}
                        loading="lazy"
                      />
                    ) : (
                      <div className="no-image">No photo</div>
                    )}
                    <span className={`status ${item.type}`}>{item.type}</span>
                  </div>
                  <div className="item-details">
                    <h3>{item.itemName}</h3>
                    <p className="location">
                      <i className="fas fa-map-marker-alt"></i>{" "}
                      {item.locationLostOrFound}
                    </p>
                    <p className="date">
                      <i className="far fa-calendar-alt"></i>{" "}
                      {new Date(item.dateLostOrFound).toLocaleDateString()}
                    </p>
                    <span className="btn btn-sm">View Details</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="view-all">
            <Link to="/items?type=lost" className="btn btn-outline">
              View All Lost Items
            </Link>{" "}
            <Link to="/items?type=found" className="btn btn-outline">
              View All Found Items
            </Link>
          </div>
        </div>
      </section>

      {/* Live Statistics Section */}
      {stats && (
        <section className="success-stories">
          <div className="container">
            <h2 className="section-title">Hub at a Glance</h2>
            <p className="text-center muted">
              Live totals from the public hub listings.
            </p>
            <div className="stats-container">
              <div className="stat-item">
                <div className="stat-number">{stats.totalItems}</div>
                <div className="stat-label">Items Listed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.lostItems}</div>
                <div className="stat-label">Lost Reports</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.foundItems}</div>
                <div className="stat-label">Found Reports</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.reunited}</div>
                <div className="stat-label">Reunited</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.atHub}</div>
                <div className="stat-label">At the Hub</div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default Home;
