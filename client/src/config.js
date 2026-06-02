const PRODUCTION_BACKEND_URL = "https://good-one-api.onrender.com";
const DEVELOPMENT_BACKEND_URL = "http://localhost:5000";
const DEFAULT_PUBLIC_WEB_URL = "https://good-one-jlcu.onrender.com";

const stripTrailingSlashes = (value) => String(value || "").trim().replace(/\/+$/, "");

const isUnsafePublicWebUrl = (value) => {
  try {
    const parsed = new URL(value);
    return (
      ["capacitor:", "ionic:"].includes(parsed.protocol) ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "0.0.0.0"
    );
  } catch {
    return true;
  }
};

const getPublicWebUrl = (value) => {
  const normalized = stripTrailingSlashes(value || DEFAULT_PUBLIC_WEB_URL);
  return isUnsafePublicWebUrl(normalized) ? DEFAULT_PUBLIC_WEB_URL : normalized;
};

const defaultBackendUrl =
  process.env.NODE_ENV === "production" ? PRODUCTION_BACKEND_URL : DEVELOPMENT_BACKEND_URL;

export const BACKEND_URL = stripTrailingSlashes(
  process.env.REACT_APP_BACKEND_URL || defaultBackendUrl
);
export const API_URL = stripTrailingSlashes(
  process.env.REACT_APP_API_URL || `${BACKEND_URL}/api`
);
export const PUBLIC_WEB_URL = getPublicWebUrl(process.env.REACT_APP_PUBLIC_WEB_URL);
export const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "goodone@swivelit.in";

export const buildPublicUrl = (path = "/") => {
  const rawPath = String(path || "/").trim();
  let normalizedPath = rawPath;

  if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath)) {
    try {
      const parsed = new URL(rawPath);
      normalizedPath = parsed.hash?.startsWith("#/")
        ? parsed.hash
        : `${parsed.pathname}${parsed.search}`;
    } catch {
      normalizedPath = "/";
    }
  }

  normalizedPath = normalizedPath.replace(/^#\/?/, "/");
  normalizedPath = normalizedPath.replace(/^\/?#\/?/, "/");
  normalizedPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

  return `${PUBLIC_WEB_URL}${normalizedPath}`;
};

export const getUploadUrl = (fileName) => {
  if (!fileName) return "";

  const value = String(fileName).trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedName = value.replace(/^\/+/, "").replace(/^uploads\/+/i, "");
  return `${BACKEND_URL}/uploads/${normalizedName}`;
};
