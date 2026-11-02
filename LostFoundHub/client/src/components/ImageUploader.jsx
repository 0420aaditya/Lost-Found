// components/ImageUploader.jsx
// Choose, preview, replace and remove an image, then upload it immediately.
// The parent form stores the returned server path (e.g. "/uploads/abc.png").
import { useEffect, useRef, useState } from "react";
import api, { imageSrc } from "../api.js";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function ImageUploader({ value, onChange, onUploadingChange }) {
  const inputRef = useRef(null);
  const [localPreview, setLocalPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // Release the temporary object URL when it is replaced or the form unmounts.
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  async function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setError("");
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG, GIF or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    if (file.size === 0) {
      setError("The selected file is empty.");
      event.target.value = "";
      return;
    }

    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setUploading(true);
    setProgress(0);
    onUploadingChange?.(true);

    const data = new FormData();
    data.append("image", file);

    try {
      const res = await api.post("/uploads", data, {
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });
      onChange(res.data.imageUrl);
      setProgress(100);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Image upload failed. Please try another image."
      );
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview("");
      setFileName("");
      onChange("");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  }

  function removeImage() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview("");
    setFileName("");
    setProgress(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onChange("");
  }

  const previewSrc = localPreview || (value ? imageSrc(value) : "");

  return (
    <div className="image-uploader">
      {previewSrc ? (
        <img
          className="image-preview"
          src={previewSrc}
          alt="Selected item preview"
        />
      ) : (
        <div className="image-placeholder" aria-hidden="true">
          <i className="fas fa-image"></i>
          <span>No image selected</span>
        </div>
      )}

      <div className="image-uploader-actions">
        <input
          ref={inputRef}
          type="file"
          id="image"
          name="image"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFile}
          className="sr-only"
        />
        <label htmlFor="image" className="btn btn-sm">
          <i className="fas fa-cloud-upload-alt"></i>{" "}
          {previewSrc ? "Replace image" : "Choose image"}
        </label>
        {previewSrc && (
          <button
            type="button"
            className="btn btn-sm secondary"
            onClick={removeImage}
            disabled={uploading}
          >
            Remove
          </button>
        )}
      </div>

      <p className="form-hint">
        JPG, PNG, GIF or WebP. Maximum 5 MB.
        {fileName ? ` Selected: ${fileName}` : ""}
      </p>

      {uploading && (
        <p className="muted" aria-live="polite">
          Uploading... {progress}%
        </p>
      )}
      {!uploading && value && (
        <p className="success" aria-live="polite">
          Image uploaded.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default ImageUploader;
