// pages/admin/AdminItems.jsx
// Manage official items: record hub receipt and soft-delete listings.
import { useEffect, useState } from "react";
import api from "../../api.js";
import AdminNav from "../../components/AdminNav.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function AdminItems() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/items/all");
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openReceive(item) {
    setError("");
    setDialog({ action: "receive", item });
  }

  function openDelete(item) {
    setError("");
    setReason("");
    setDialog({ action: "delete", item, conflict: "" });
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setReason("");
  }

  async function confirmDialog() {
    if (!dialog) return;

    if (dialog.action === "receive") {
      setBusy(true);
      setError("");
      try {
        await api.patch(`/items/${dialog.item._id}/receive-at-hub`);
        setDialog(null);
        await load();
      } catch (err) {
        setError(err.response?.data?.message || "Could not record receipt");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!reason.trim()) {
      setError("Please enter a deletion reason.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const confirmed = dialog.action === "conflict";
      await api.patch(`/items/${dialog.item._id}/soft-delete`, {
        reason: reason.trim(),
        confirm: confirmed,
      });
      setDialog(null);
      setReason("");
      await load();
    } catch (err) {
      // 409 with pendingClaims means the admin must explicitly confirm.
      if (
        err.response?.status === 409 &&
        err.response.data?.pendingClaims &&
        dialog.action !== "conflict"
      ) {
        setDialog({ ...dialog, action: "conflict", conflict: err.response.data.message });
      } else {
        setError(err.response?.data?.message || "Could not delete item");
      }
    } finally {
      setBusy(false);
    }
  }

  const isDelete = dialog?.action === "delete" || dialog?.action === "conflict";
  const isConflict = dialog?.action === "conflict";

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Manage Items</h1>
          <p>Record when a found item reaches the hub, or remove a listing.</p>
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

          {loading ? (
            <p className="empty">Loading...</p>
          ) : items.length === 0 ? (
            <p className="empty">No official items yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>At hub</th>
                    <th>Reported by</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item._id}
                      style={item.isDeleted ? { opacity: 0.55 } : {}}
                    >
                      <td>
                        {item.itemName}
                        {item.isDeleted && (
                          <>
                            <br />
                            <span className="error">
                              deleted: {item.deletionReason}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`status ${item.type}`}>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.hubReceived ? "yes" : "no"}</td>
                      <td>{item.reportedBy?.email}</td>
                      <td>
                        {!item.isDeleted && (
                          <div className="btn-row">
                            {item.type === "found" && !item.hubReceived && (
                              <button
                                className="btn small"
                                type="button"
                                onClick={() => openReceive(item)}
                              >
                                Record receipt
                              </button>
                            )}
                            <button
                              className="btn small danger"
                              type="button"
                              onClick={() => openDelete(item)}
                            >
                              Delete
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
        title={
          dialog?.action === "receive"
            ? "Record physical receipt?"
            : isConflict
            ? "This item has pending claims"
            : "Remove this listing?"
        }
        message={
          dialog?.action === "receive"
            ? `Confirm that "${dialog?.item?.itemName || ""}" was physically handed in to the hub.`
            : isConflict
            ? dialog?.conflict
            : `"${dialog?.item?.itemName || ""}" will be hidden from public listings. The record and history are kept.`
        }
        confirmLabel={
          dialog?.action === "receive"
            ? "Record receipt"
            : isConflict
            ? "Delete and reject claims"
            : "Delete listing"
        }
        danger={isDelete}
        busy={busy}
        onCancel={closeDialog}
        onConfirm={confirmDialog}
      >
        {isDelete && (
          <div className="form-group">
            <label htmlFor="delete-reason">Deletion reason*</label>
            <textarea
              id="delete-reason"
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

export default AdminItems;
