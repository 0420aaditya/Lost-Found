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
  const [reloadKey, setReloadKey] = useState(0);

  // Claim form state
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ownershipDetails, setOwnershipDetails] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [claimErr, setClaimErr] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/items/${id}`);
        if (!active) return;
        setItem(res.data.item);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || "Could not load item");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  async function submitClaim(event) {
    event.preventDefault();
    setClaimMsg("");
    setClaimErr("");
    setClaiming(true);
    try {
      await api.post("/claims", {
        itemId: id,
        contactPhone,
        contactEmail,
        ownershipDetails,
      });
      setClaimMsg(
        "Your claim was submitted. The admin will contact you privately to verify ownership."
      );
      setContactPhone("");
      setContactEmail("");
      setOwnershipDetails("");
      setReloadKey((key) => key + 1);
    } catch (err) {
      setClaimErr(err.response?.data?.message || "Could not submit claim");
    } finally {
      setClaiming(false);
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
            <p className="error" role="alert">
              {error}
            </p>
            <div className="btn-row">
              <Link to="/items" className="btn secondary">
                &larr; Back to browse
              </Link>
              <button
                type="button"
                className="btn"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
  if (!item) return null;

  // A claim is only possible for a found item that is at the hub and still open.
  const claimable =
    item.type === "found" &&
    item.hubReceived &&
    item.status === "open";

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
              <div
                className="form-group"
                style={{ flex: "0 0 320px", minWidth: 0 }}
              >
                <div
                  className="item-image"
                  style={{ borderRadius: 8, overflow: "hidden" }}
                >
                  {item.imageUrl ? (
                    <img
                      src={imageSrc(item.imageUrl)}
                      alt={item.itemName}
                      loading="lazy"
                    />
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
                    At hub: {item.hubReceived ? "Yes" : "Not yet"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {claimable && (
            <div className="form-container">
              <h2>Claim this item</h2>
              <p className="muted">
                Contact details and your ownership explanation are only shown to
                the admin. They will contact you privately to verify ownership.
              </p>
              {claimMsg && (
                <div className="alert success" role="status">
                  {claimMsg}
                </div>
              )}
              {claimErr && (
                <div className="alert error" role="alert">
                  {claimErr}
                </div>
              )}
              {user ? (
                <form onSubmit={submitClaim} noValidate>
                  <div className="form-group">
                    <label htmlFor="phone">Your phone*</label>
                    <input
                      id="phone"
                      type="text"
                      value={contactPhone}
                      onChange={(event) => setContactPhone(event.target.value)}
                      required
                      maxLength={30}
                      autoComplete="tel"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cemail">Your email (optional)</label>
                    <input
                      id="cemail"
                      type="email"
                      value={contactEmail}
                      onChange={(event) =>
                        setContactEmail(event.target.value)
                      }
                      maxLength={254}
                      autoComplete="email"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ownership">Why is this yours?*</label>
                    <textarea
                      id="ownership"
                      value={ownershipDetails}
                      onChange={(event) =>
                        setOwnershipDetails(event.target.value)
                      }
                      minLength={10}
                      maxLength={3000}
                      required
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={claiming}
                  >
                    {claiming ? "Submitting..." : "Submit claim"}
                  </button>
                </form>
              ) : (
                <p>
                  Please <Link to="/login">log in</Link> to claim this item.
                </p>
              )}
            </div>
          )}

          {!claimable && item.type === "found" && (
            <div className="card">
              <h2>Claiming not available</h2>
              <p className="muted">
                This found item can only be claimed if it is physically at the
                hub, is still open, and has not been collected.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default ItemDetail;
