// api.js
// One shared axios instance for the whole app. Every request automatically
// includes the login token (if any), and every response error is passed on.
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Attach the saved token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lfh_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The server base URL (without the trailing /api) so we can show uploaded images.
export const SERVER_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/api\/?$/, "");

// Turn a stored path like "/uploads/x.png" into a full image URL.
export function imageSrc(path) {
  if (!path) return "";
  return SERVER_URL + path;
}

export default api;
