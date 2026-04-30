import { Buffer } from "node:buffer";

const API_BASE_URL = process.env.API_BASE_URL || "https://good-one-api.onrender.com/api";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://good-one-jlcu.onrender.com";
const OTP_CODE = process.env.OTP_CODE || "111111";

const PASSWORD = "Test@12345";
const RUN_ID = Date.now().toString();
let phoneCounter = 0;

const customerEmail = `e2e-customer-${RUN_ID}@example.com`;
const vendorEmail = `e2e-vendor-${RUN_ID}@example.com`;
const customerPhone = makeUniquePhone("700");
const vendorPhone = makeUniquePhone("701");
const backendOrigin = new URL(API_BASE_URL).origin;
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

let activeCheckLabel = "";
let latestResponseContext = null;

const state = {
  customerToken: null,
  vendorToken: null,
  customerDeleted: false,
  vendorDeleted: false,
};

class E2EError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "E2EError";
    this.label = details.label || activeCheckLabel;
    this.status = details.status;
    this.body = details.body;
  }
}

function logPass(label) {
  console.log(`✅ ${label}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new E2EError(message, latestResponseContext || {});
  }
}

async function requestJson(path, options = {}, expectedStatuses = [200], label = activeCheckLabel) {
  const url = buildApiUrl(path);
  const response = await requestRawUrl(url, options, expectedStatuses, label);
  const body = await response.text();
  rememberResponse(label, response.status, body);

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new E2EError(`${label} expected a JSON response`, {
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
    throw new E2EError(`${label} request failed: ${error.message}`, {
      label,
      body: error.cause?.message || error.message,
    });
  }

  if (!expected.has(response.status)) {
    const body = await response.text();
    rememberResponse(label, response.status, body);
    throw new E2EError(
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

function makeUniquePhone(prefix) {
  phoneCounter += 1;
  const suffix = `${Date.now()}${process.pid}${phoneCounter}`.replace(/\D/g, "").slice(-9);
  return `${prefix}${suffix}`;
}

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
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

function makePngBlob() {
  return new Blob([pngBytes], { type: "image/png" });
}

function getId(value) {
  return value?.id || value?._id;
}

function uploadedImageUrl(fileName) {
  if (/^https?:\/\//i.test(fileName)) return fileName;
  return `${backendOrigin}/uploads/${encodeURIComponent(fileName)}`;
}

async function runCheck(label, fn) {
  activeCheckLabel = label;
  latestResponseContext = null;
  await fn();
  logPass(label);
}

async function cleanupAccount(label, token, deletedKey) {
  if (!token || state[deletedKey]) return;

  try {
    const data = await requestJson(
      "/auth/me",
      { method: "DELETE", headers: authHeaders(token) },
      [200],
      `cleanup ${label}`
    );
    if (data?.success) {
      state[deletedKey] = true;
      console.error(`Cleanup deleted ${label} account.`);
    }
  } catch (error) {
    console.error(`Cleanup failed for ${label} account.`);
    printFailureDetails(error);
  }
}

function printFailureDetails(error) {
  const label = error.label || activeCheckLabel || "Live E2E test";
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
  let productId;
  let conversationId;
  let vendorUserId;
  let productImage;

  console.log(`Live E2E run ${RUN_ID}`);
  console.log(`API_BASE_URL=${API_BASE_URL}`);
  console.log(`FRONTEND_URL=${FRONTEND_URL}`);

  try {
    await runCheck("01 Backend root", async () => {
      const data = await requestJson(`${backendOrigin}/`, { method: "GET" }, [200]);
      assert(data?.success === true, "Backend root did not return success true.");
    });

    await runCheck("02 Backend health", async () => {
      const data = await requestJson("/health", { method: "GET" }, [200]);
      assert(data?.status === "OK", "Backend health did not return status OK.");
    });

    await runCheck("03 Frontend homepage", async () => {
      const response = await requestRawUrl(FRONTEND_URL, { method: "GET" }, [200]);
      const body = await response.text();
      rememberResponse(activeCheckLabel, response.status, body);
      assert(
        body.includes("root") || body.includes("You need to enable JavaScript"),
        "Frontend homepage did not look like the app shell."
      );
    });

    await runCheck("04 Frontend login direct route", async () => {
      await requestRawUrl(`${FRONTEND_URL.replace(/\/+$/, "")}/login`, { method: "GET" }, [200]);
    });

    await runCheck("05 Frontend privacy direct route", async () => {
      await requestRawUrl(`${FRONTEND_URL.replace(/\/+$/, "")}/privacy`, { method: "GET" }, [200]);
    });

    await runCheck("06 Frontend account deletion direct route", async () => {
      await requestRawUrl(
        `${FRONTEND_URL.replace(/\/+$/, "")}/account-deletion`,
        { method: "GET" },
        [200]
      );
    });

    await runCheck("07 CORS", async () => {
      const response = await requestRawUrl(
        `${API_BASE_URL.replace(/\/+$/, "")}/health`,
        { method: "GET", headers: { Origin: FRONTEND_URL } },
        [200]
      );
      const allowedOrigin = response.headers.get("access-control-allow-origin");
      assert(
        allowedOrigin === FRONTEND_URL || Boolean(allowedOrigin),
        "CORS response did not include Access-Control-Allow-Origin."
      );
    });

    await runCheck("08 Customer send OTP", async () => {
      const data = await requestJson(
        "/sendOtp",
        { method: "POST", body: { email: customerEmail } },
        [200]
      );
      assert(data?.success === true, "Customer send OTP did not return success true.");
      assert(data?.testOtpEnabled === true, "Customer send OTP did not report testOtpEnabled true.");
    });

    await runCheck("09 Customer register", async () => {
      const data = await requestJson(
        "/auth/register/customer",
        {
          method: "POST",
          body: {
            name: `E2E Customer ${RUN_ID}`,
            email: customerEmail,
            phone: customerPhone,
            password: PASSWORD,
            otp: OTP_CODE,
          },
        },
        [200, 201]
      );
      state.customerToken = data?.token;
      assert(data?.success === true, "Customer register did not return success true.");
      assert(Boolean(state.customerToken), "Customer register did not return a token.");
      assert(data?.user?.role === "customer", "Customer register did not return role customer.");
      assert(!Object.hasOwn(data?.user || {}, "password"), "Customer user included a password.");
    });

    await runCheck("10 Customer login", async () => {
      const data = await requestJson(
        "/auth/login",
        { method: "POST", body: { emailOrPhone: customerEmail, password: PASSWORD } },
        [200]
      );
      state.customerToken = data?.token;
      assert(data?.success === true, "Customer login did not return success true.");
      assert(Boolean(state.customerToken), "Customer login did not return a token.");
    });

    await runCheck("11 Customer getMe", async () => {
      const data = await requestJson(
        "/auth/me",
        { method: "GET", headers: authHeaders(state.customerToken) },
        [200]
      );
      assert(data?.success === true, "Customer getMe did not return success true.");
      assert(data?.user?.email === customerEmail, "Customer getMe returned the wrong email.");
    });

    await runCheck("12 Vendor send OTP", async () => {
      const data = await requestJson(
        "/sendOtp",
        { method: "POST", body: { email: vendorEmail } },
        [200]
      );
      assert(data?.success === true, "Vendor send OTP did not return success true.");
      assert(data?.testOtpEnabled === true, "Vendor send OTP did not report testOtpEnabled true.");
    });

    await runCheck("13 Vendor register", async () => {
      const form = new FormData();
      form.append("name", `E2E Vendor ${RUN_ID}`);
      form.append("email", vendorEmail);
      form.append("phone", vendorPhone);
      form.append("password", PASSWORD);
      form.append("otp", OTP_CODE);
      form.append("businessName", `E2E Business ${RUN_ID}`);
      form.append("businessDescription", "Automated live E2E vendor account");
      form.append("businessCategory", "Electronics");
      form.append("businessAddress", "E2E Test Address");
      form.append("livePhoto", makePngBlob(), "live-photo.png");

      const data = await requestJson(
        "/auth/register/vendor",
        { method: "POST", body: form },
        [200, 201]
      );
      state.vendorToken = data?.token;
      vendorUserId = getId(data?.user);
      assert(data?.success === true, "Vendor register did not return success true.");
      assert(Boolean(state.vendorToken), "Vendor register did not return a token.");
      assert(data?.user?.role === "vendor", "Vendor register did not return role vendor.");
      assert(Boolean(vendorUserId), "Vendor register did not return a vendor user id.");
      assert(Boolean(data?.vendor), "Vendor register did not return a vendor object.");
    });

    await runCheck("14 Vendor login", async () => {
      const data = await requestJson(
        "/auth/login",
        { method: "POST", body: { emailOrPhone: vendorEmail, password: PASSWORD } },
        [200]
      );
      state.vendorToken = data?.token;
      vendorUserId = getId(data?.user) || vendorUserId;
      assert(data?.success === true, "Vendor login did not return success true.");
      assert(Boolean(state.vendorToken), "Vendor login did not return a token.");
      assert(Boolean(data?.vendorProfile), "Vendor login did not return vendorProfile.");
    });

    await runCheck("15 Vendor create product", async () => {
      const form = new FormData();
      form.append("title", `E2E Product ${RUN_ID}`);
      form.append("description", "Automated live E2E product listing");
      form.append("price", "123.45");
      form.append("originalPrice", "150.00");
      form.append("category", "Electronics");
      form.append("condition", "new");
      form.append("location", "E2E Test Location");
      form.append("tags", "e2e,live-test");
      form.append("images", makePngBlob(), "e2e-product.png");

      const data = await requestJson(
        "/products",
        { method: "POST", headers: authHeaders(state.vendorToken), body: form },
        [200, 201]
      );
      productId = getId(data?.product);
      productImage = data?.product?.images?.[0];
      assert(data?.success === true, "Product create did not return success true.");
      assert(Boolean(productId), "Product create did not return a product id.");
    });

    await runCheck("16 Product list/detail", async () => {
      const list = await requestJson("/products", { method: "GET" }, [200]);
      assert(list?.success === true, "Product list did not return success true.");
      assert(Array.isArray(list?.products), "Product list did not return a products array.");

      const detail = await requestJson(`/products/${encodeURIComponent(productId)}`, { method: "GET" }, [200]);
      productImage = detail?.product?.images?.[0] || productImage;
      assert(detail?.success === true, "Product detail did not return success true.");
      assert(getId(detail?.product) === productId, "Product detail returned the wrong product id.");
    });

    await runCheck("17 Uploaded image loads", async () => {
      assert(Boolean(productImage), "Product did not include an uploaded image filename.");
      await requestRawUrl(uploadedImageUrl(productImage), { method: "GET" }, [200]);
    });

    await runCheck("18 Customer creates conversation", async () => {
      const data = await requestJson(
        "/chat/conversation",
        {
          method: "POST",
          headers: authHeaders(state.customerToken),
          body: { productId },
        },
        [200]
      );
      conversationId = getId(data?.conversation);
      assert(data?.success === true, "Create conversation did not return success true.");
      assert(Boolean(conversationId), "Create conversation did not return a conversation id.");
    });

    await runCheck("19 Messaging", async () => {
      const customerMessage = await requestJson(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: authHeaders(state.customerToken),
          body: { text: "E2E customer message" },
        },
        [201]
      );
      assert(customerMessage?.success === true, "Customer message did not return success true.");

      const vendorMessage = await requestJson(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: authHeaders(state.vendorToken),
          body: { text: "E2E vendor reply" },
        },
        [201]
      );
      assert(vendorMessage?.success === true, "Vendor message did not return success true.");

      const messages = await requestJson(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        { method: "GET", headers: authHeaders(state.customerToken) },
        [200]
      );
      assert(messages?.success === true, "Get messages did not return success true.");
      assert(Array.isArray(messages?.messages), "Get messages did not return a messages array.");
      assert(messages.messages.length >= 2, "Get messages returned fewer than 2 messages.");
    });

    await runCheck("20 Report listing", async () => {
      const data = await requestJson(
        "/reports",
        {
          method: "POST",
          headers: authHeaders(state.customerToken),
          body: {
            product: productId,
            reportedUser: vendorUserId,
            reason: "E2E test report",
            details: "Automated test report",
          },
        },
        [201]
      );
      assert(data?.success === true, "Listing report did not return success true.");
    });

    await runCheck("21 Report conversation", async () => {
      const data = await requestJson(
        "/reports",
        {
          method: "POST",
          headers: authHeaders(state.customerToken),
          body: {
            conversation: conversationId,
            reportedUser: vendorUserId,
            reason: "E2E chat report",
            details: "Automated chat test report",
          },
        },
        [201]
      );
      assert(data?.success === true, "Conversation report did not return success true.");
    });

    await runCheck("22 Block user", async () => {
      const data = await requestJson(
        "/blocks",
        {
          method: "POST",
          headers: authHeaders(state.customerToken),
          body: {
            blockedUser: vendorUserId,
            conversation: conversationId,
          },
        },
        [200]
      );
      assert(data?.success === true, "Block user did not return success true.");
    });

    await runCheck("23 Block prevents further message", async () => {
      const data = await requestJson(
        `/chat/${encodeURIComponent(conversationId)}/messages`,
        {
          method: "POST",
          headers: authHeaders(state.vendorToken),
          body: { text: "This should be blocked" },
        },
        [403]
      );
      assert(data?.success === false, "Blocked message did not return success false.");
    });

    await runCheck("24 Account deletion cleanup", async () => {
      const customerDelete = await requestJson(
        "/auth/me",
        { method: "DELETE", headers: authHeaders(state.customerToken) },
        [200]
      );
      assert(customerDelete?.success === true, "Customer account deletion did not return success true.");
      state.customerDeleted = true;

      const vendorDelete = await requestJson(
        "/auth/me",
        { method: "DELETE", headers: authHeaders(state.vendorToken) },
        [200]
      );
      assert(vendorDelete?.success === true, "Vendor account deletion did not return success true.");
      state.vendorDeleted = true;
    });

    await runCheck("25 Verify deleted login fails", async () => {
      const customerLogin = await requestJson(
        "/auth/login",
        { method: "POST", body: { emailOrPhone: customerEmail, password: PASSWORD } },
        [401]
      );
      assert(customerLogin?.success === false, "Deleted customer login did not return success false.");

      const vendorLogin = await requestJson(
        "/auth/login",
        { method: "POST", body: { emailOrPhone: vendorEmail, password: PASSWORD } },
        [401]
      );
      assert(vendorLogin?.success === false, "Deleted vendor login did not return success false.");
    });

    console.log("Live E2E test completed successfully.");
  } catch (error) {
    printFailureDetails(error);
    await cleanupAccount("customer", state.customerToken, "customerDeleted");
    await cleanupAccount("vendor", state.vendorToken, "vendorDeleted");
    process.exitCode = 1;
  }
}

main();
