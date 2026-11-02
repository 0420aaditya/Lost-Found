// pages/admin/AdminRequests.jsx
// Review requests and approve or reject them with an accessible confirmation.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const params = {};
    if (type) params.type = type;
    if (status) params.status = status;
    try {
      const res = await api.get("/requests", { params });
      setRequests(res.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openApprove(request) {
    setError("");
    setReason("");
    setDialog({ action: "approve", request });
  }

  function openReject(request) {
    setError("");
    setReason("");
    setDialog({ action: "reject", request });
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setReason("");
  }

  async function confirmDialog() {
    if (!dialog) return;
    if (dialog.action === "reject" && !reason.trim()) {
      setError("Please enter a rejection reason.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (dialog.action === "approve") {
        await api.patch(`/requests/${dialog.request._id}/approve`);
      } else {
        await api.patch(`/requests/${dialog.request._id}/reject`, {
          reason: reason.trim(),
        });
      }
      setDialog(null);
      setReason("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update the request");
    } finally {
      setBusy(false);
    }
  }

  const isReject = dialog?.action === "reject";

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Item Requests</h1>
          <p>Approve a request to publish it, or reject it with a reason.</p>
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
                Type
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </label>
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
                </select>
              </label>
              <button className="btn" type="submit">
                Apply
              </button>
            </form>
          </div>

          {loading ? (
            <p className="empty">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="empty">No requests match.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Submitted by</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request._id}>
                      <td>{request.itemName}</td>
                      <td>
                        <span className={`status ${request.type}`}>
                          {request.type}
                        </span>
                      </td>
                      <td>{request.userId?.email}</td>
                      <td>
                        <span className={`status ${request.status}`}>
                          {request.status}
                        </span>
                        {request.status === "rejected" &&
                          request.rejectionReason && (
                            <div className="muted">
                              {request.rejectionReason}
                            </div>
                          )}
                      </td>
                      <td>
                        {request.locationLostOrFound}
                        <br />
                        <span className="muted">
                          {new Date(
                            request.dateLostOrFound
                          ).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        {request.status === "pending" && (
                          <div className="btn-row">
                            <button
                              className="btn small"
                              type="button"
                              onClick={() => openApprove(request)}
                            >
                              Approve
                            </button>
                            <button
                              className="btn small danger"
                              type="button"
                              onClick={() => openReject(request)}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(dialog)}
        title={isReject ? "Reject this request?" : "Approve this request?"}
        message={
          isReject
            ? "The request stays in history and the user will see your reason."
            : `"${dialog?.request?.itemName || ""}" will become a public official listing. This cannot be undone.`
        }
        confirmLabel={isReject ? "Reject request" : "Approve and publish"}
        danger={isReject}
        busy={busy}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      >
        {isReject && (
          <div className="form-group">
            <label htmlFor="reject-reason">Rejection reason*</label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              required
            />
          </div>
        )}
      </ConfirmDialog>
    </main>
  );
}

export default AdminRequests;
