// pages/ItemDetail.jsx
// Public details for one item, plus a claim form when the item is claimable.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { imageSrc } from "../api.js";

function ItemDetail({ user }) {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Claim form state
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ownershipDetails, setOwnershipDetails] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [claimErr, setClaimErr] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/items/${id}`);
        setItem(res.data.item);
      } catch (err) {
        setError(err.response?.data?.message || "Could not load item");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function submitClaim(e) {
    e.preventDefault();
    setClaimMsg("");
    setClaimErr("");
    try {
      await api.post("/claims", {
        itemId: id,
        contactPhone,
        contactEmail,
        ownershipDetails,
      });
      setClaimMsg("Your claim was submitted. The admin will contact you.");
      setContactPhone("");
      setContactEmail("");
      setOwnershipDetails("");
    } catch (err) {
      setClaimErr(err.response?.data?.message || "Could not submit claim");
    }
  }

  if (loading) {
    return (
      <main>
        <section className="admin-section">
          <div className="container">
            <p className="empty">Loading...</p>
          </div>
        </section>
      </main>
    );
  }
  if (error) {
    return (
      <main>
        <section className="admin-section">
          <div className="container">
            <p className="error">{error}</p>
            <Link to="/items">&larr; Back to browse</Link>
          </div>
        </section>
      </main>
    );
  }
  if (!item) return null;

  // A claim is only possible for a found item that is at the hub and still open.
  const claimable =
    item.type === "found" && item.hubReceived && item.status === "open";

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>{item.itemName}</h1>
          <p>
            <span className={`status ${item.type}`}>{item.type}</span>{" "}
            <span className={`status ${item.status}`}>{item.status}</span>
          </p>
        </div>
      </section>

      <section>
        <div className="container">
          <p style={{ marginTop: "1rem" }}>
            <Link to="/items">&larr; Back to browse</Link>
          </p>

          <div className="card">
            <div className="form-row">
              <div className="form-group" style={{ flex: "0 0 320px", minWidth: 0 }}>
                <div className="item-image" style={{ borderRadius: 8, overflow: "hidden" }}>
                  {item.imageUrl ? (
                    <img src={imageSrc(item.imageUrl)} alt={item.itemName} />
                  ) : (
                    <div className="no-image">No photo</div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <span className="item-category">{item.category}</span>
                <p className="description">{item.description}</p>
                <p className="location">
                  <i className="fas fa-map-marker-alt"></i>{" "}
                  {item.locationLostOrFound}
                </p>
                <p className="date">
                  <i className="far fa-calendar-alt"></i>{" "}
                  {new Date(item.dateLostOrFound).toLocaleDateString()}
                </p>
                {item.type === "found" && (
                  <p className="muted">
                    At hub: {item.hubReceived ? "yes" : "not yet"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {claimable && (
            <div className="form-container">
              <h2>Claim this item</h2>
              <p className="muted">
                Contact details are only shown to the admin. They will contact
                you privately to verify ownership.
              </p>
              {claimMsg && <div className="alert success">{claimMsg}</div>}
              {claimErr && <div className="alert error">{claimErr}</div>}
              {user ? (
                <form onSubmit={submitClaim}>
                  <div className="form-group">
                    <label htmlFor="phone">Your phone</label>
                    <input
                      id="phone"
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cemail">Your email (optional)</label>
                    <input
                      id="cemail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ownership">Why is this yours?</label>
                    <textarea
                      id="ownership"
                      value={ownershipDetails}
                      onChange={(e) => setOwnershipDetails(e.target.value)}
                      required
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Submit claim
                  </button>
                </form>
              ) : (
                <p>
                  Please <Link to="/login">log in</Link> to claim this item.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default ItemDetail;
