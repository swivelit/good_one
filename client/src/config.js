export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
export const API_URL = process.env.REACT_APP_API_URL || `${BACKEND_URL}/api`;
export const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "goodone@swivelit.in";

export const getUploadUrl = (fileName) => {
  if (!fileName) return "";

  const value = String(fileName).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedName = value.replace(/^\/+/, "").replace(/^uploads\//, "");
  return `${BACKEND_URL}/uploads/${normalizedName}`;
};
