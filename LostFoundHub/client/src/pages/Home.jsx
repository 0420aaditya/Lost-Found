// pages/Home.jsx
// Landing page, matching the static index.html: a hero, a "how it works"
// strip, a few recent items pulled from the public API, then success stories
// and headline stats.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { imageSrc } from "../api.js";

function Home() {
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/items");
        setRecent(res.data.items.slice(0, 4));
      } catch (err) {
        setRecent([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1>Lost something? Found something?</h1>
            <h2>Let's reconnect you.</h2>
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
                Submit details about the item you've lost or found, including
                location and date.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">
                <i className="fas fa-search"></i>
              </div>
              <h3>Search</h3>
              <p>
                Browse through listings to find a match for your lost or found
                item.
              </p>
            </div>
            <div className="step">
              <div className="step-icon">
                <i className="fas fa-handshake"></i>
              </div>
              <h3>Reconnect</h3>
              <p>
                Get in touch with the finder/owner and arrange to retrieve your
                item.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Items Section */}
      <section className="recent-items">
        <div className="container">
          <h2 className="section-title">Recent Items</h2>
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
                      <img src={imageSrc(item.imageUrl)} alt={item.itemName} />
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

      {/* Success Stories Section */}
      <section className="success-stories">
        <div className="container">
          <h2 className="section-title">Success Stories</h2>
          <div className="story-card">
            <div className="story-content">
              <p>
                "I lost my laptop during finals week and was devastated. Thanks
                to Lost &amp; Found Hub, someone found it and I got it back
                within 24 hours!"
              </p>
              <p className="story-author">- Aaditya D.J, Student</p>
            </div>
          </div>
          <div className="stats-container">
            <div className="stat-item">
              <div className="stat-number">75+</div>
              <div className="stat-label">Items Reunited</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">100+</div>
              <div className="stat-label">Active Users</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24h</div>
              <div className="stat-label">Avg. Recovery Time</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
