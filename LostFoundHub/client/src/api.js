// api.js
// One shared axios instance for the whole app. Every request automatically
// includes the login token (if any), and every response error is passed on.
import axios from "axios";
import { clearSession } from "./auth.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_URL });

// Attach the saved token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("lfh_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token has expired/been rejected, clear the stale session and send the
// user to the login page (without looping on the login/register calls).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isAuthCall =
      url.includes("/auth/login") || url.includes("/auth/register");
    if (status === 401 && !isAuthCall) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

// The server base URL (without the trailing /api) so we can show uploaded images.
export const SERVER_URL = API_URL.replace(/\/api\/?$/, "");

// Turn a stored path like "/uploads/x.png" into a full image URL.
export function imageSrc(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return SERVER_URL + (path.startsWith("/") ? path : `/${path}`);
}

export default api;
