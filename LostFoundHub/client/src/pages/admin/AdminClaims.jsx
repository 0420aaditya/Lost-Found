// pages/admin/AdminClaims.jsx
// Review claims: read the claimant's private contact details, record a
// decision with notes, then confirm the physical handover.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (status) params.status = status;
    try {
      const res = await api.get("/claims", { params });
      setClaims(res.data.claims);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load claims");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openDecision(claim, decision) {
    setError("");
    setNotes("");
    setDialog({ action: decision, claim });
  }

  function openHandover(claim) {
    setError("");
    setDialog({ action: "handover", claim });
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setNotes("");
  }

  async function confirmDialog() {
    if (!dialog) return;

    if (dialog.action === "handover") {
      setBusy(true);
      setError("");
      try {
        await api.patch(`/claims/${dialog.claim._id}/handover`);
        setDialog(null);
        await load();
      } catch (err) {
        setError(err.response?.data?.message || "Could not complete handover");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!notes.trim()) {
      setError("Please enter admin notes for this decision.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api.patch(`/claims/${dialog.claim._id}/decision`, {
        decision: dialog.action,
        adminNotes: notes.trim(),
      });
      setDialog(null);
      setNotes("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not record decision");
    } finally {
      setBusy(false);
    }
  }

  const isDecision = dialog?.action === "approved" || dialog?.action === "rejected";
  const isReject = dialog?.action === "rejected";

  let title = "Confirm handover?";
  let message =
    "This marks the claim as completed and the item as collected. The item will accept no new claims.";
  if (isDecision) {
    title = isReject ? "Reject this claim?" : "Approve this claim?";
    message = isReject
      ? "The item stays available and the claimant will see the claim as rejected."
      : "The item will be reserved for this claimant and all other pending claims for it will be auto-rejected.";
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Claims</h1>
          <p>Verify ownership, record a decision, then confirm the handover.</p>
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

          <div className="card">
            <form
              className="filters"
              onSubmit={(event) => {
                event.preventDefault();
                load();
              }}
            >
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          </div>

          {loading ? (
            <p className="empty">Loading...</p>
          ) : claims.length === 0 ? (
            <p className="empty">No claims match.</p>
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
                  Claimant: {claim.claimantId?.name} ({claim.claimantId?.email})
                  <br />
                  Phone: {claim.contactPhone}
                  {claim.contactEmail ? ` | Email: ${claim.contactEmail}` : ""}
                </p>
                <p>
                  <strong>Ownership explanation:</strong>{" "}
                  {claim.ownershipDetails}
                </p>
                {claim.adminNotes && (
                  <p className="muted">
                    <strong>Admin notes:</strong> {claim.adminNotes}
                  </p>
                )}

                {claim.status === "pending" && (
                  <div className="btn-row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => openDecision(claim, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn small danger"
                      type="button"
                      onClick={() => openDecision(claim, "rejected")}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {claim.status === "approved" && (
                  <div className="btn-row">
                    <button
                      className="btn small"
                      type="button"
                      onClick={() => openHandover(claim)}
                    >
                      Confirm handover
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={title}
        message={message}
        confirmLabel={
          dialog?.action === "handover"
            ? "Confirm handover"
            : isReject
            ? "Reject claim"
            : "Approve claim"
        }
        danger={isReject}
        busy={busy}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      >
        {isDecision && (
          <div className="form-group">
            <label htmlFor="claim-notes">
              {isReject
                ? "Reason / notes for rejecting*"
                : "Verification notes (what did you check?)*"}
            </label>
            <textarea
              id="claim-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              required
            />
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}

export default AdminClaims;
