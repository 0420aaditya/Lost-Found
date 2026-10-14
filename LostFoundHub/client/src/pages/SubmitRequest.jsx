// pages/SubmitRequest.jsx
// A logged-in user reports a lost or found item. They can optionally attach an
// image, which is uploaded first, then the request is created.
// The layout mirrors the static report-item.html form.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api.js";

function SubmitRequest() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") === "found" ? "found" : "lost";

  const [form, setForm] = useState({
    type: initialType,
    itemName: "",
    category: "",
    description: "",
    dateLostOrFound: "",
    locationLostOrFound: "",
    additionalDetails: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("No file chosen");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setUploading(true);
    const data = new FormData();
    data.append("image", file);
    try {
      const res = await api.post("/uploads", data);
      setImageUrl(res.data.imageUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Image upload failed");
    }
    setUploading(false);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/requests", { ...form, imageUrl });
      navigate("/my-requests");
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit request");
    }
    setBusy(false);
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>Report an Item</h1>
          <p>
            Fill out the form below to report a lost or found item. Please
            provide as much detail as possible to help with identification. An
            admin reviews every report before it becomes a public listing.
          </p>
        </div>
      </section>

      <section className="report-form">
        <div className="container">
          <form className="form-container" onSubmit={submit}>
            {error && <div className="alert error">{error}</div>}

            <div className="form-group radio-group">
              <label>Item Status</label>
              <div className="radio-options">
                <div className="radio-option">
                  <input
                    type="radio"
                    id="lost"
                    name="type"
                    value="lost"
                    checked={form.type === "lost"}
                    onChange={change}
                  />
                  <label htmlFor="lost">Lost Item</label>
                </div>
                <div className="radio-option">
                  <input
                    type="radio"
                    id="found"
                    name="type"
                    value="found"
                    checked={form.type === "found"}
                    onChange={change}
                  />
                  <label htmlFor="found">Found Item</label>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="itemName">Item Name/Title*</label>
              <input
                id="itemName"
                name="itemName"
                value={form.itemName}
                onChange={change}
                placeholder="Enter item name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category*</label>
              <select
                id="category"
                name="category"
                value={form.category}
                onChange={change}
                required
              >
                <option value="" disabled>
                  Select a category
                </option>
                <option value="electronics">Electronics</option>
                <option value="personal-items">Personal Items</option>
                <option value="documents">Documents</option>
                <option value="accessories">Accessories</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description*</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={change}
                placeholder="Provide a detailed description of the item (color, brand, distinguishing features, etc.)"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="locationLostOrFound">Location*</label>
                <input
                  id="locationLostOrFound"
                  name="locationLostOrFound"
                  value={form.locationLostOrFound}
                  onChange={change}
                  placeholder="Where was the item lost/found?"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="dateLostOrFound">Date*</label>
                <input
                  id="dateLostOrFound"
                  type="date"
                  name="dateLostOrFound"
                  value={form.dateLostOrFound}
                  onChange={change}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="additionalDetails">Additional details (optional)</label>
              <textarea
                id="additionalDetails"
                name="additionalDetails"
                value={form.additionalDetails}
                onChange={change}
                placeholder="Anything else that might help identify the item."
              />
            </div>

            <div className="form-group">
              <label htmlFor="image">Upload Image</label>
              <div className="file-upload">
                <input
                  type="file"
                  id="image"
                  name="image"
                  accept="image/*"
                  onChange={uploadImage}
                />
                <label htmlFor="image" className="file-upload-btn">
                  <i className="fas fa-cloud-upload-alt"></i> Choose File
                </label>
                <span className="file-name">{fileName}</span>
              </div>
              <p className="form-hint">
                Max file size: 5MB. Formats: JPG, PNG, GIF
              </p>
              {uploading && <p className="muted">Uploading image...</p>}
              {imageUrl && <p className="success">Image attached.</p>}
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy || uploading}>
                {busy ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="tips-section">
        <div className="container">
          <h2 className="section-title">Tips for Reporting</h2>
          <div className="tips-container">
            <div className="tip">
              <div className="tip-icon">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="tip-content">
                <h3>Be Specific</h3>
                <p>
                  Include as many details as possible about the item, such as
                  brand, color, size, and any unique features or markings.
                </p>
              </div>
            </div>
            <div className="tip">
              <div className="tip-icon">
                <i className="fas fa-map-marked-alt"></i>
              </div>
              <div className="tip-content">
                <h3>Accurate Location</h3>
                <p>
                  Be as precise as possible about where the item was lost or
                  found. Include building names, room numbers, or landmarks.
                </p>
              </div>
            </div>
            <div className="tip">
              <div className="tip-icon">
                <i className="fas fa-camera"></i>
              </div>
              <div className="tip-content">
                <h3>Add Photos</h3>
                <p>
                  If you have a photo of the item, upload it to help with
                  identification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default SubmitRequest;
