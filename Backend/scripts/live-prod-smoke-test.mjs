const API_BASE_URL = process.env.API_BASE_URL || "https://good-one-api.onrender.com/api";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://good-one-jlcu.onrender.com";
const CUSTOMER_EMAIL = process.env.CUSTOMER_EMAIL;
const CUSTOMER_PASSWORD = process.env.CUSTOMER_PASSWORD;
const VENDOR_EMAIL = process.env.VENDOR_EMAIL;
const VENDOR_PASSWORD = process.env.VENDOR_PASSWORD;

const backendOrigin = new URL(API_BASE_URL).origin;
const frontendOrigin = FRONTEND_URL.replace(/\/+$/, "");

let activeCheckLabel = "";
let latestResponseContext = null;

class SmokeTestError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SmokeTestError";
    this.label = details.label || activeCheckLabel;
    this.status = details.status;
    this.body = details.body;
  }
}

function validateCredentials() {
  const missing = [
    ["CUSTOMER_EMAIL", CUSTOMER_EMAIL],
    ["CUSTOMER_PASSWORD", CUSTOMER_PASSWORD],
    ["VENDOR_EMAIL", VENDOR_EMAIL],
    ["VENDOR_PASSWORD", VENDOR_PASSWORD],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    console.error(
      "Set CUSTOMER_EMAIL, CUSTOMER_PASSWORD, VENDOR_EMAIL, and VENDOR_PASSWORD before running the production smoke test."
    );
    process.exit(1);
  }
}

function logPass(label) {
  console.log(`✅ ${label}`);
}

function logWarn(label, message) {
  console.warn(`⚠️ ${label}: ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new SmokeTestError(message, latestResponseContext || {});
  }
}

async function runCheck(label, fn) {
  activeCheckLabel = label;
  latestResponseContext = null;
  await fn();
  logPass(label);
}

async function requestJson(path, options = {}, expectedStatuses = [200], label = activeCheckLabel) {
  const url = buildApiUrl(path);
  const response = await requestRawUrl(url, options, expectedStatuses, label);
  const body = await response.text();
  rememberResponse(label, response.status, body);

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new SmokeTestError(`${label} expected a JSON response`, {
      label,
      status: response.status,
      body,
    });
  }
}

async function requestRawUrl(url, options = {}, expectedStatuses = [200], label = activeCheckLabel) {
  const expected = toStatusSet(expectedStatuses);
  let response;

  try {
    response = await fetch(url, prepareFetchOptions(options));
  } catch (error) {
    throw new SmokeTestError(`${label} request failed: ${error.message}`, {
      label,
      body: error.cause?.message || error.message,
    });
  }

  if (!expected.has(response.status)) {
    const body = await response.text();
    rememberResponse(label, response.status, body);
    throw new SmokeTestError(
      `${label} expected status ${formatStatuses(expectedStatuses)} but received ${response.status}`,
      { label, status: response.status, body }
    );
  }

  rememberResponse(label, response.status, null);
  return response;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function buildFrontendUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${frontendOrigin}${normalizedPath}`;
}

function toStatusSet(expectedStatuses) {
  const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  return new Set(statuses);
}

function formatStatuses(expectedStatuses) {
  const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  return statuses.join(" or ");
}

function rememberResponse(label, status, body) {
  latestResponseContext = { label, status, body };
}

function prepareFetchOptions(options) {
  const prepared = { ...options };
  const headers = new Headers(options.headers || {});

  if (shouldJsonEncode(prepared.body)) {
    prepared.body = JSON.stringify(prepared.body);
    if (!headers.has("content-type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  prepared.headers = headers;
  return prepared;
}

function shouldJsonEncode(body) {
  return (
    body !== undefined &&
    body !== null &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams) &&
    !ArrayBuffer.isView(body)
  );
}

function getId(value) {
  return value?.id || value?._id;
}

function emailsMatch(actual, expected) {
  return actual?.toLowerCase() === expected?.toLowerCase();
}

function readViews(product) {
  return Number(product?.views || 0);
}

function assertCorsAllowed(response, origin) {
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  assert(
    allowedOrigin === origin || allowedOrigin === "*",
    `CORS did not allow ${origin}. Received Access-Control-Allow-Origin: ${allowedOrigin || "<missing>"}`
  );
}

function printFailureDetails(error) {
  const label = error.label || activeCheckLabel || "Production smoke test";
  console.error(`❌ ${label}`);
  console.error(error.message);

  if (error.status !== undefined) {
    console.error(`Status: ${error.status}`);
  }

  if (error.body !== undefined && error.body !== null) {
    console.error(`Body: ${formatBody(error.body)}`);
  }
}

function formatBody(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (text.length <= 4000) return text;
  return `${text.slice(0, 4000)}... [truncated]`;
}

async function main() {
  validateCredentials();

  let customerToken;
  let vendorToken;
  let firstProductId;

  await runCheck("01 Backend root", async () => {
    const data = await requestJson(`${backendOrigin}/`, { method: "GET" }, [200]);
    assert(data?.success === true, "Backend root did not return success true.");
  });

  await runCheck("02 Backend health", async () => {
    const data = await requestJson("/health", { method: "GET" }, [200]);
    assert(data?.status === "OK", "Backend health did not return status OK.");
  });

  await runCheck("03 Public stats", async () => {
    const data = await requestJson("/stats/public", { method: "GET" }, [200]);
    assert(data?.success === true, "Public stats did not return success true.");
    assert(typeof data?.stats?.activeListings === "number", "Public stats missing activeListings number.");
    assert(typeof data?.stats?.registeredVendors === "number", "Public stats missing registeredVendors number.");
    assert(typeof data?.stats?.verifiedVendors === "number", "Public stats missing verifiedVendors number.");
    assert(typeof data?.stats?.registeredBuyers === "number", "Public stats missing registeredBuyers number.");
    assert(typeof data?.stats?.totalRenewals === "number", "Public stats missing totalRenewals number.");
  });

  await runCheck("04 Frontend homepage", async () => {
    await requestRawUrl(frontendOrigin, { method: "GET" }, [200]);
  });

  await runCheck("05 Frontend /login", async () => {
    await requestRawUrl(buildFrontendUrl("/login"), { method: "GET" }, [200]);
  });

  await runCheck("06 Frontend /privacy", async () => {
    await requestRawUrl(buildFrontendUrl("/privacy"), { method: "GET" }, [200]);
  });

  await runCheck("07 Frontend /account-deletion", async () => {
    await requestRawUrl(buildFrontendUrl("/account-deletion"), { method: "GET" }, [200]);
  });

  await runCheck("08 CORS web frontend", async () => {
    const response = await requestRawUrl(
      `${API_BASE_URL.replace(/\/+$/, "")}/health`,
      { method: "GET", headers: { Origin: frontendOrigin } },
      [200]
    );
    assertCorsAllowed(response, frontendOrigin);
  });

  await runCheck("09 CORS Capacitor localhost", async () => {
    const response = await requestRawUrl(
      `${API_BASE_URL.replace(/\/+$/, "")}/health`,
      { method: "GET", headers: { Origin: "capacitor://localhost" } },
      [200]
    );
    assertCorsAllowed(response, "capacitor://localhost");
  });

  await runCheck("10 CORS HTTP localhost", async () => {
    const response = await requestRawUrl(
      `${API_BASE_URL.replace(/\/+$/, "")}/health`,
      { method: "GET", headers: { Origin: "http://localhost" } },
      [200]
    );
    assertCorsAllowed(response, "http://localhost");
  });

  await runCheck("11 CORS Ionic localhost", async () => {
    const response = await requestRawUrl(
      `${API_BASE_URL.replace(/\/+$/, "")}/health`,
      { method: "GET", headers: { Origin: "ionic://localhost" } },
      [200]
    );
    assertCorsAllowed(response, "ionic://localhost");
  });

  await runCheck("12 CORS HTTPS localhost", async () => {
    const response = await requestRawUrl(
      `${API_BASE_URL.replace(/\/+$/, "")}/health`,
      { method: "GET", headers: { Origin: "https://localhost" } },
      [200]
    );
    assertCorsAllowed(response, "https://localhost");
  });

  await runCheck("13 Product search", async () => {
    const data = await requestJson("/products?search=iphone", { method: "GET" }, [200]);
    assert(data?.success === true, "Product search did not return success true.");
    assert(Array.isArray(data?.products), "Product search did not return a products array.");
  });

  await runCheck("14 Customer login", async () => {
    const data = await requestJson(
      "/auth/login",
      { method: "POST", body: { emailOrPhone: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD } },
      [200]
    );
    customerToken = data?.token;
    assert(data?.success === true, "Customer login did not return success true.");
    assert(Boolean(customerToken), "Customer login did not return a token.");
  });

  await runCheck("15 Customer getMe", async () => {
    const data = await requestJson(
      "/auth/me",
      { method: "GET", headers: authHeaders(customerToken) },
      [200]
    );
    assert(data?.success === true, "Customer getMe did not return success true.");
    assert(emailsMatch(data?.user?.email, CUSTOMER_EMAIL), "Customer getMe returned the wrong email.");
  });

  await runCheck("16 Vendor login", async () => {
    const data = await requestJson(
      "/auth/login",
      { method: "POST", body: { emailOrPhone: VENDOR_EMAIL, password: VENDOR_PASSWORD } },
      [200]
    );
    vendorToken = data?.token;
    assert(data?.success === true, "Vendor login did not return success true.");
    assert(Boolean(vendorToken), "Vendor login did not return a token.");
  });

  await runCheck("17 Vendor getMe", async () => {
    const data = await requestJson(
      "/auth/me",
      { method: "GET", headers: authHeaders(vendorToken) },
      [200]
    );
    assert(data?.success === true, "Vendor getMe did not return success true.");
    assert(emailsMatch(data?.user?.email, VENDOR_EMAIL), "Vendor getMe returned the wrong email.");
  });

  await runCheck("18 Product list", async () => {
    const data = await requestJson("/products", { method: "GET" }, [200]);
    assert(data?.success === true, "Product list did not return success true.");
    assert(Array.isArray(data?.products), "Product list did not return a products array.");
    firstProductId = getId(data.products[0]);
  });

  await runCheck("19 Owner vendor views", async () => {
    const mine = await requestJson(
      "/products/my-products",
      { method: "GET", headers: authHeaders(vendorToken) },
      [200]
    );
    const ownedProductId = getId(mine?.products?.[0]);

    if (!ownedProductId) {
      logWarn(activeCheckLabel, "Skipped because the smoke-test vendor has no products.");
      return;
    }

    const first = await requestJson(
      `/products/${encodeURIComponent(ownedProductId)}`,
      { method: "GET", headers: authHeaders(vendorToken) },
      [200]
    );
    const firstViews = readViews(first?.product);

    const second = await requestJson(
      `/products/${encodeURIComponent(ownedProductId)}`,
      { method: "GET", headers: authHeaders(vendorToken) },
      [200]
    );
    const secondViews = readViews(second?.product);

    assert(
      secondViews === firstViews,
      `Owner vendor product detail changed views from ${firstViews} to ${secondViews}.`
    );
  });

  await runCheck("20 Product detail", async () => {
    if (!firstProductId) return;

    const data = await requestJson(
      `/products/${encodeURIComponent(firstProductId)}`,
      { method: "GET" },
      [200]
    );
    assert(data?.success === true, "Product detail did not return success true.");
  });

  await runCheck("21 Product detail unique guest views", async () => {
    if (!firstProductId) return;

    const viewerId = `prod-smoke-${Date.now()}`;
    const first = await requestJson(
      `/products/${encodeURIComponent(firstProductId)}`,
      { method: "GET", headers: { "X-Viewer-Id": viewerId } },
      [200]
    );
    const firstViews = readViews(first?.product);

    const second = await requestJson(
      `/products/${encodeURIComponent(firstProductId)}`,
      { method: "GET", headers: { "X-Viewer-Id": viewerId } },
      [200]
    );
    const secondViews = readViews(second?.product);

    assert(
      secondViews === firstViews,
      `Repeated product detail with same X-Viewer-Id changed views from ${firstViews} to ${secondViews}.`
    );

    const third = await requestJson(
      `/products/${encodeURIComponent(firstProductId)}`,
      { method: "GET", headers: { "X-Viewer-Id": `${viewerId}-other` } },
      [200]
    );
    assert(
      readViews(third?.product) >= secondViews,
      "Different X-Viewer-Id should not reduce product views."
    );
  });

  console.log("Production smoke test completed successfully.");
}

main().catch((error) => {
  printFailureDetails(error);
  process.exit(1);
});
