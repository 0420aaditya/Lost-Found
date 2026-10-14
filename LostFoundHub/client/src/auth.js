// auth.js
// Small helpers for saving/reading the login session in localStorage.
// Keeping this in one place means every page reads the session the same way.
export function saveSession(token, user) {
  localStorage.setItem("lfh_token", token);
  localStorage.setItem("lfh_user", JSON.stringify(user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("lfh_user"));
  } catch (error) {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("lfh_token");
  localStorage.removeItem("lfh_user");
}
