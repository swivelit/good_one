#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.goodone.marketplace"
WEB_ORIGIN="${WEB_ORIGIN:-https://good-one-jlcu.onrender.com}"
API_BASE="${API_BASE:-https://good-one-api.onrender.com/api}"
LOG_PATH="${LOG_PATH:-dist/android-app-links-test-logcat.txt}"
STATE_PATH="dist/android-app-links-state.txt"
PRODUCT_FOCUS_PATH="dist/android-product-link-focus.txt"
VENDOR_FOCUS_PATH="dist/android-vendor-link-focus.txt"
PRODUCT_LOG_PATH="dist/android-product-link-logcat.txt"
VENDOR_LOG_PATH="dist/android-vendor-link-logcat.txt"
PRODUCT_JSON_PATH="dist/android-app-links-product.json"
LIVE_HEADERS_PATH="dist/live-assetlinks-headers.txt"
LIVE_ASSETLINKS_PATH="dist/live-assetlinks.json"
REPO_ASSETLINKS_PATH="client/public/.well-known/assetlinks.json"

mkdir -p dist "$(dirname "$LOG_PATH")"

if ! command -v adb >/dev/null 2>&1; then
  echo "Android App Links test skipped: adb is not installed or not on PATH."
  exit 0
fi

DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
if [ -z "$DEVICE_ID" ]; then
  echo "Android App Links test skipped: no adb device/emulator is connected."
  exit 0
fi

adb_cmd() {
  adb -s "$DEVICE_ID" "$@"
}

echo "Testing Android App Links on adb device $DEVICE_ID"
echo "APP_ID=$APP_ID"
echo "WEB_ORIGIN=$WEB_ORIGIN"
echo "API_BASE=$API_BASE"

echo "Fetching one live product..."
curl -fsS "$API_BASE/products?limit=1" -o "$PRODUCT_JSON_PATH"

read -r PRODUCT_ID VENDOR_ID < <(node - "$PRODUCT_JSON_PATH" <<'NODE'
const fs = require('fs');

const payloadPath = process.argv[2];
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const firstArray = (...values) => values.find((value) => Array.isArray(value)) || [];
const products = firstArray(
  payload,
  payload.products,
  payload.data,
  payload.data?.products,
  payload.result,
  payload.result?.products
);

const getId = (value) => value?._id || value?.id || value?.uuid || '';
const getVendorId = (product) => (
  product?.vendorId ||
  product?.vendor_id ||
  getId(product?.vendor) ||
  getId(product?.seller) ||
  ''
);

const product = products.find((item) => (
  item &&
  item.isActive !== false &&
  getId(item) &&
  getVendorId(item)
));

if (!product) {
  console.error('No active product with a vendor id was found in the API response.');
  process.exit(1);
}

console.log(`${getId(product)} ${getVendorId(product)}`);
NODE
)

if [ -z "${PRODUCT_ID:-}" ] || [ -z "${VENDOR_ID:-}" ]; then
  echo "ERROR: could not parse PRODUCT_ID and VENDOR_ID from $PRODUCT_JSON_PATH"
  exit 1
fi

PRODUCT_URL="$WEB_ORIGIN/products/$PRODUCT_ID"
VENDOR_URL="$WEB_ORIGIN/vendors/$VENDOR_ID"
HOST="$(node -e "console.log(new URL(process.argv[1]).host)" "$WEB_ORIGIN")"

echo "PRODUCT_ID=$PRODUCT_ID"
echo "VENDOR_ID=$VENDOR_ID"
echo "PRODUCT_URL=$PRODUCT_URL"
echo "VENDOR_URL=$VENDOR_URL"

echo ""
echo "Current Android App Links state:"
adb_cmd shell pm get-app-links --user cur "$APP_ID" || true

echo ""
echo "Requesting Android App Links re-verification..."
adb_cmd shell pm set-app-links --package "$APP_ID" 0 all || true
adb_cmd shell pm verify-app-links --re-verify "$APP_ID" || true
sleep 20
adb_cmd shell pm get-app-links --user cur "$APP_ID" | tee "$STATE_PATH" || true

echo ""
echo "Explicit package deep-link test..."
adb_cmd shell am force-stop "$APP_ID"
adb_cmd shell logcat -c || true
adb_cmd shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "$PRODUCT_URL" \
  "$APP_ID"
sleep 6
adb_cmd shell am start -W \
  -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "$VENDOR_URL" \
  "$APP_ID"
sleep 6
adb_cmd shell logcat -d -v time > "$LOG_PATH" || true

PRODUCT_ROUTE="[GoodOne] Deep link opened: /products/$PRODUCT_ID"
VENDOR_ROUTE="[GoodOne] Deep link opened: /vendors/$VENDOR_ID"

if ! grep -Fq "$PRODUCT_ROUTE" "$LOG_PATH"; then
  echo "ERROR: explicit product deep link did not route to /products/$PRODUCT_ID"
  echo "Log saved at $LOG_PATH"
  exit 1
fi

if ! grep -Fq "$VENDOR_ROUTE" "$LOG_PATH"; then
  echo "ERROR: explicit vendor deep link did not route to /vendors/$VENDOR_ID"
  echo "Log saved at $LOG_PATH"
  exit 1
fi

if grep -iE "AndroidRuntime|FATAL EXCEPTION" "$LOG_PATH"; then
  echo "ERROR: crash signature found in explicit deep-link logcat."
  exit 1
fi

echo "Explicit package deep-link routing passed."

fetch_live_assetlinks() {
  curl -fsSL -D "$LIVE_HEADERS_PATH" "$WEB_ORIGIN/.well-known/assetlinks.json" \
    -o "$LIVE_ASSETLINKS_PATH" || true
}

print_app_link_diagnostics() {
  echo ""
  echo "Android App Links diagnostics"
  echo "pm get-app-links:"
  adb_cmd shell pm get-app-links --user cur "$APP_ID" || true

  fetch_live_assetlinks

  INSTALLED_SIGNATURE="$(sed -nE 's/.*Signatures: \[([^]]+)\].*/\1/p' "$STATE_PATH" | head -n 1)"
  export INSTALLED_SIGNATURE

  node - "$LIVE_ASSETLINKS_PATH" "$REPO_ASSETLINKS_PATH" "$INSTALLED_SIGNATURE" <<'NODE'
const fs = require('fs');

const [livePath, repoPath, installedSignature] = process.argv.slice(2);

const readJson = (filePath) => {
  try {
    return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { error: error.message };
  }
};

const fingerprints = (data) => (
  Array.isArray(data)
    ? data.flatMap((statement) => statement?.target?.sha256_cert_fingerprints || [])
    : []
);

const live = readJson(livePath);
const repo = readJson(repoPath);
const liveFingerprints = fingerprints(live.value);
const repoFingerprints = fingerprints(repo.value);

console.log(`Installed app signature from pm get-app-links: ${installedSignature || '(not found)'}`);
console.log(`Live assetlinks fingerprints: ${live.error ? `(not valid JSON: ${live.error})` : JSON.stringify(liveFingerprints)}`);
console.log(`Repo assetlinks fingerprints: ${repo.error ? `(not valid JSON: ${repo.error})` : JSON.stringify(repoFingerprints)}`);

if (installedSignature) {
  if (!liveFingerprints.includes(installedSignature)) {
    console.log(`Missing installed app fingerprint in live assetlinks.json: ${installedSignature}`);
  }
  if (!repoFingerprints.includes(installedSignature)) {
    console.log(`Installed app fingerprint is not in repo assetlinks.json: ${installedSignature}`);
  }
}
NODE

  echo ""
  echo "Live assetlinks response headers:"
  cat "$LIVE_HEADERS_PATH" || true
}

run_implicit_test() {
  local kind="$1"
  local url="$2"
  local expected_route="$3"
  local focus_path="$4"
  local log_path="$5"

  echo ""
  echo "Implicit OS-level $kind App Link test..."
  adb_cmd shell am force-stop "$APP_ID"
  adb_cmd shell logcat -c || true
  adb_cmd shell am start -W \
    -a android.intent.action.VIEW \
    -c android.intent.category.BROWSABLE \
    -d "$url"
  sleep 6
  adb_cmd shell dumpsys window \
    | grep -E "mCurrentFocus|topResumedActivity|mFocusedApp" \
    | tee "$focus_path" || true
  adb_cmd shell logcat -d -v time > "$log_path" || true

  if ! grep -Fq "$APP_ID" "$focus_path"; then
    echo "ERROR: implicit $kind App Link did not focus $APP_ID."
    echo "Focused/current activity:"
    cat "$focus_path" || true
    echo "This is an Android App Links verification problem if the explicit package test passed."
    print_app_link_diagnostics
    exit 2
  fi

  if ! grep -Fq "$expected_route" "$log_path"; then
    echo "ERROR: implicit $kind App Link focused $APP_ID but did not log route $expected_route"
    echo "Log saved at $log_path"
    exit 1
  fi

  if grep -iE "AndroidRuntime|FATAL EXCEPTION" "$log_path"; then
    echo "ERROR: crash signature found in implicit $kind App Link logcat."
    exit 1
  fi

  echo "Implicit $kind App Link opened $APP_ID and routed to $expected_route"
}

run_implicit_test "product" "$PRODUCT_URL" "$PRODUCT_ROUTE" "$PRODUCT_FOCUS_PATH" "$PRODUCT_LOG_PATH"
run_implicit_test "vendor" "$VENDOR_URL" "$VENDOR_ROUTE" "$VENDOR_FOCUS_PATH" "$VENDOR_LOG_PATH"

echo ""
echo "Android App Links test passed for host $HOST"
