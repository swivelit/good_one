#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ID="com.goodone.marketplace"
APK_PATH="$ROOT_DIR/dist/goodone-debug.apk"
LOG_PATH="$ROOT_DIR/dist/goodone-debug-logcat.txt"
SCREENSHOT_PATH="$ROOT_DIR/dist/goodone-debug-screenshot.png"
SHARED_PRODUCT_URL="${SHARED_PRODUCT_URL:-}"
REQUIRE_ADB="${REQUIRE_ADB:-false}"
META_FRESH_INSTALL="${META_FRESH_INSTALL:-false}"
META_LAUNCH_WAIT_SECONDS="${META_LAUNCH_WAIT_SECONDS:-10}"
META_REQUIRE_EVENT_EVIDENCE="${META_REQUIRE_EVENT_EVIDENCE:-false}"
META_EVENT_WAIT_SECONDS="${META_EVENT_WAIT_SECONDS:-45}"
LOG_FILTER="GoodOne|GoodOneNativeAd|AdMob|MobileAds|GoogleMobileAds|Ads|NativeAd|AdLoader|AdView|MetaSdk|FacebookSDK|AppEvents|FacebookException|MOBILE_APP_INSTALL|fb_mobile_activate_app|Flush completed|Result: Success|SDK has not been initialized|Client token|ApplicationId|AndroidRuntime|FATAL EXCEPTION|Process ${APP_ID} has died|UnknownHostException|SocketTimeoutException|SSLHandshakeException|GraphResponse|WebView|chromium|MediaCodec|OMX|ExoPlayer|Capacitor"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

validate_boolean_env() {
  local name="$1"
  local value="$2"
  case "$value" in
    true|false) ;;
    *) fail "$name must be true or false." ;;
  esac
}

read_meta_client_token() {
  if [ -n "${META_CLIENT_TOKEN:-}" ]; then
    printf '%s' "$META_CLIENT_TOKEN"
    return 0
  fi

  if [ -f "$ROOT_DIR/client/android/meta.properties" ]; then
    sed -nE 's/^[[:space:]]*META_CLIENT_TOKEN[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$/\1/p' \
      "$ROOT_DIR/client/android/meta.properties" | head -n 1
  fi
}

redact_meta_client_token() {
  local token
  token="$(read_meta_client_token || true)"
  if [ -n "$token" ]; then
    awk -v token="$token" '{ gsub(token, "[REDACTED_META_CLIENT_TOKEN]"); print }'
  else
    cat
  fi
}

adb_cmd() {
  adb -s "$DEVICE_ID" "$@"
}

wait_for_app_pid() {
  local deadline=$((SECONDS + META_LAUNCH_WAIT_SECONDS))
  local pid=""

  while [ "$SECONDS" -le "$deadline" ]; do
    pid="$(adb_cmd shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' | awk '{ print $1; exit }')"
    if [ -n "$pid" ]; then
      printf '%s' "$pid"
      return 0
    fi
    sleep 1
  done

  return 1
}

capture_relevant_logcat() {
  local pid="$1"
  local raw_log="$ROOT_DIR/dist/goodone-debug-logcat.raw"

  mkdir -p "$(dirname "$LOG_PATH")"
  : > "$raw_log"

  if [ -n "$pid" ] && adb_cmd logcat --pid="$pid" -d -v time > "$raw_log" 2>/dev/null; then
    adb_cmd logcat -d -v time \
      | grep -Ei "Process ${APP_ID} has died|Activity class.*not found|AndroidRuntime|FATAL EXCEPTION" \
      >> "$raw_log" || true
  else
    adb_cmd logcat -d -v time > "$raw_log" || true
  fi

  grep -Ei "$LOG_FILTER" "$raw_log" | redact_meta_client_token > "$LOG_PATH" || true
  rm -f "$raw_log"

  {
    echo ""
    echo "Process proof:"
    echo "pidof $APP_ID: $(adb_cmd shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)"
    adb_cmd shell dumpsys activity processes 2>/dev/null | grep -F "$APP_ID" || true
  } >> "$LOG_PATH"
}

strict_log_checks() {
  if [ "$REQUIRE_ADB" != "true" ]; then
    return 0
  fi

  grep -Fq "MetaSdk" "$LOG_PATH" ||
    fail "Strict mode expected MetaSdk diagnostics in $LOG_PATH."
  grep -Fq "FacebookSdk initialized=true" "$LOG_PATH" ||
    fail "Strict mode expected FacebookSdk initialized=true in $LOG_PATH."
  grep -Fq "Meta App ID configured=true" "$LOG_PATH" ||
    fail "Strict mode expected a configured Meta App ID in $LOG_PATH."
  grep -Fq "Meta APP_EVENTS debug logging enabled=true" "$LOG_PATH" ||
    fail "Strict mode expected APP_EVENTS debug logging evidence in $LOG_PATH."

  if grep -Eiq "FATAL EXCEPTION|FacebookException|SDK has not been initialized|missing.*ApplicationId|invalid.*ApplicationId|ApplicationId.*(missing|invalid)|missing.*client token|client token.*(missing|required|invalid)|Process ${APP_ID} has died|Activity class.*not found|SecurityException|UnsatisfiedLinkError" "$LOG_PATH"; then
    fail "Strict mode found a crash, Meta configuration, or launch failure signature in $LOG_PATH."
  fi

  if ! adb_cmd shell pidof "$APP_ID" >/dev/null 2>&1; then
    fail "Strict mode could not prove $APP_ID is still running."
  fi
}

event_evidence_checks() {
  if [ "$META_REQUIRE_EVENT_EVIDENCE" != "true" ]; then
    return 0
  fi

  local deadline=$((SECONDS + META_EVENT_WAIT_SECONDS))
  local saw_event="false"
  local saw_flush="false"

  while [ "$SECONDS" -le "$deadline" ]; do
    capture_relevant_logcat "$APP_PID"

    if grep -Eiq "fb_mobile_activate_app|MOBILE_APP_INSTALL" "$LOG_PATH"; then
      saw_event="true"
    fi

    if grep -Eiq "Flush completed|Result: Success" "$LOG_PATH"; then
      saw_flush="true"
    fi

    if [ "$saw_event" = "true" ] && [ "$saw_flush" = "true" ]; then
      echo "Meta automatic event and flush-success evidence observed."
      return 0
    fi

    if grep -Eiq "FacebookException|SDK has not been initialized|missing.*ApplicationId|invalid.*ApplicationId|ApplicationId.*(missing|invalid)|missing.*client token|client token.*(missing|required|invalid)" "$LOG_PATH"; then
      fail "Meta configuration failure signature found while waiting for event evidence in $LOG_PATH."
    fi

    if grep -Eiq "UnknownHostException|SocketTimeoutException|SSLHandshakeException|GraphResponse.*(error|Exception|failed)|Failed.*AppEvents|network.*(error|failed)" "$LOG_PATH"; then
      fail "Meta event evidence wait saw a network or endpoint failure signature in $LOG_PATH."
    fi

    sleep 2
  done

  if grep -Fq "FacebookSdk initialized=true" "$LOG_PATH"; then
    if [ "$saw_event" != "true" ]; then
      fail "Meta SDK initialized, but no automatic activation/install event evidence appeared within ${META_EVENT_WAIT_SECONDS}s."
    fi
    fail "Meta automatic event evidence appeared, but no flush-success evidence appeared within ${META_EVENT_WAIT_SECONDS}s."
  fi

  fail "Meta SDK initialization evidence was absent while waiting for event evidence."
}

validate_boolean_env REQUIRE_ADB "$REQUIRE_ADB"
validate_boolean_env META_FRESH_INSTALL "$META_FRESH_INSTALL"
validate_boolean_env META_REQUIRE_EVENT_EVIDENCE "$META_REQUIRE_EVENT_EVIDENCE"
case "$META_LAUNCH_WAIT_SECONDS" in
  ''|*[!0-9]*) fail "META_LAUNCH_WAIT_SECONDS must be a positive integer." ;;
esac
case "$META_EVENT_WAIT_SECONDS" in
  ''|*[!0-9]*) fail "META_EVENT_WAIT_SECONDS must be a positive integer." ;;
esac

echo "Building GoodOne debug APK..."
bash "$ROOT_DIR/scripts/build-android-apk.sh"

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: APK build completed but $APK_PATH was not found."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "APK build succeeded: $APK_PATH"
  if [ "$REQUIRE_ADB" = "true" ]; then
    fail "REQUIRE_ADB=true but adb is not installed or not on PATH."
  else
    echo "Launch skipped because adb is not installed or not on PATH."
    exit 0
  fi
fi

DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"

if [ -z "$DEVICE_ID" ]; then
  echo "APK build succeeded: $APK_PATH"
  if [ "$REQUIRE_ADB" = "true" ]; then
    adb devices -l || true
    fail "REQUIRE_ADB=true but no authorized adb device/emulator is connected."
  else
    echo "Launch skipped because no adb device/emulator is connected."
    exit 0
  fi
fi

if [ "$META_FRESH_INSTALL" = "true" ]; then
  echo "Fresh-install mode: uninstalling $APP_ID from adb device $DEVICE_ID if present..."
  if adb_cmd uninstall "$APP_ID"; then
    echo "Uninstalled previous $APP_ID install."
  else
    echo "No previous $APP_ID install was removed; continuing."
  fi
fi

echo "Installing $APK_PATH on adb device $DEVICE_ID..."
if ! adb_cmd install -r "$APK_PATH"; then
  fail "APK install failed on adb device $DEVICE_ID."
fi

echo "Launching $APP_ID..."
adb_cmd logcat -c || true
LAUNCH_OUTPUT="$(adb_cmd shell monkey -p "$APP_ID" 1 2>&1)" || {
  echo "$LAUNCH_OUTPUT"
  fail "Package launch failed for $APP_ID."
}
echo "$LAUNCH_OUTPUT"

if echo "$LAUNCH_OUTPUT" | grep -Eiq "No activities found|monkey aborted|Activity class.*not found"; then
  fail "Package launch output indicates $APP_ID could not be launched."
fi

APP_PID="$(wait_for_app_pid || true)"
if [ -z "$APP_PID" ]; then
  capture_relevant_logcat ""
  if [ "$REQUIRE_ADB" = "true" ]; then
    fail "Strict mode did not observe a running $APP_ID process within ${META_LAUNCH_WAIT_SECONDS}s."
  fi
  echo "WARNING: Could not observe a running $APP_ID process within ${META_LAUNCH_WAIT_SECONDS}s."
else
  echo "$APP_ID is running with pid $APP_PID"
fi

sleep "$META_LAUNCH_WAIT_SECONDS"
capture_relevant_logcat "$APP_PID"

echo "Captured filtered logcat output at $LOG_PATH"

strict_log_checks
event_evidence_checks

if adb_cmd exec-out screencap -p > "$SCREENSHOT_PATH"; then
  echo "Captured device screenshot at $SCREENSHOT_PATH"
else
  if [ "$REQUIRE_ADB" = "true" ]; then
    fail "Strict mode could not capture device screenshot."
  else
    echo "WARNING: Could not capture device screenshot."
  fi
fi

if [ -x "$ROOT_DIR/scripts/test-android-app-links.sh" ]; then
  echo "Running Android App Links verification..."
  if [ -n "$SHARED_PRODUCT_URL" ]; then
    echo "Testing shared product URL: $SHARED_PRODUCT_URL"
  else
    echo "Testing shared product URL: (not provided; script will use live-product fallback)"
  fi
  SHARED_PRODUCT_URL="$SHARED_PRODUCT_URL" "$ROOT_DIR/scripts/test-android-app-links.sh"
fi

echo "APK written to: $APK_PATH"
echo "Log written to: $LOG_PATH"
echo "Screenshot written to: $SCREENSHOT_PATH"
