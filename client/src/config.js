const PRODUCTION_BACKEND_URL = "https://good-one-api.onrender.com";
const DEVELOPMENT_BACKEND_URL = "http://localhost:5000";

const stripTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");

const defaultBackendUrl =
  process.env.NODE_ENV === "production" ? PRODUCTION_BACKEND_URL : DEVELOPMENT_BACKEND_URL;

export const BACKEND_URL = stripTrailingSlashes(
  process.env.REACT_APP_BACKEND_URL || defaultBackendUrl
);
export const API_URL = stripTrailingSlashes(
  process.env.REACT_APP_API_URL || `${BACKEND_URL}/api`
);
export const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "goodone@swivelit.in";

export const getUploadUrl = (fileName) => {
  if (!fileName) return "";

  const value = String(fileName).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedName = value.replace(/^\/+/, "").replace(/^uploads\/+/i, "");
  return `${BACKEND_URL}/uploads/${normalizedName}`;
};
