#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="com.goodone.marketplace"
APK_PATH="${APK_PATH:-$ROOT_DIR/dist/goodone-release.apk}"
LOG_PATH="$ROOT_DIR/dist/goodone-release-logcat.txt"
SCREENSHOT_PATH="$ROOT_DIR/dist/goodone-release-screenshot.png"
REQUIRE_ADB="${REQUIRE_ADB:-false}"
META_FRESH_INSTALL="${META_FRESH_INSTALL:-true}"
META_RELEASE_LAUNCH_WAIT_SECONDS="${META_RELEASE_LAUNCH_WAIT_SECONDS:-15}"

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

find_android_tool() {
  local tool_name="$1"

  if command -v "$tool_name" >/dev/null 2>&1; then
    command -v "$tool_name"
    return 0
  fi

  local sdk_dir="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  if [ -d "$sdk_dir" ]; then
    find "$sdk_dir" -name "$tool_name" -type f | sort | tail -n 1
  fi
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

redact_meta_client_token_file() {
  local path="$1"
  local token
  local tmp_path

  [ -f "$path" ] || return 0
  token="$(read_meta_client_token || true)"
  [ -n "$token" ] || return 0

  tmp_path="${path}.redacted.$$"
  GOODONE_META_CLIENT_TOKEN_TO_REDACT="$token" \
    perl -pe 'BEGIN { $token = $ENV{"GOODONE_META_CLIENT_TOKEN_TO_REDACT"} // ""; } s/\Q$token\E/[REDACTED_META_CLIENT_TOKEN]/g if length $token' \
    "$path" > "$tmp_path"
  mv "$tmp_path" "$path"
}

adb_cmd() {
  adb -s "$DEVICE_ID" "$@"
}

wait_for_app_pid() {
  local deadline=$((SECONDS + META_RELEASE_LAUNCH_WAIT_SECONDS))
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

verify_release_apk_not_debuggable() {
  local apkanalyzer_bin
  local aapt_bin
  local manifest_dump="$ROOT_DIR/dist/goodone-release-apk-manifest.txt"

  apkanalyzer_bin="$(find_android_tool apkanalyzer || true)"
  aapt_bin="$(find_android_tool aapt || true)"

  if [ -n "$apkanalyzer_bin" ] && [ -x "$apkanalyzer_bin" ]; then
    "$apkanalyzer_bin" manifest print "$APK_PATH" > "$manifest_dump"
  elif [ -n "$aapt_bin" ] && [ -x "$aapt_bin" ]; then
    "$aapt_bin" dump xmltree "$APK_PATH" AndroidManifest.xml > "$manifest_dump"
  else
    fail "apkanalyzer or aapt is required to prove the release APK is non-debuggable."
  fi

  if grep -Eiq 'android:debuggable=("true"|true)|debuggable.*0xffffffff|debuggable.*true' "$manifest_dump"; then
    fail "Release APK is debuggable."
  fi

  echo "Release APK non-debuggable check passed."
}

capture_release_logcat() {
  local pid="$1"
  local raw_log="$ROOT_DIR/dist/goodone-release-logcat.raw"

  mkdir -p "$ROOT_DIR/dist"
  : > "$raw_log"

  if [ -n "$pid" ] && adb_cmd logcat --pid="$pid" -d -v time > "$raw_log" 2>/dev/null; then
    adb_cmd logcat -d -v time |
      grep -Ei "Process ${APP_ID} has died|Activity class.*not found|ANR in ${APP_ID}|Application Not Responding: ${APP_ID}" \
      >> "$raw_log" || true
  else
    adb_cmd logcat -d -v time |
      grep -Ei "${APP_ID}|AndroidRuntime|FATAL EXCEPTION|FacebookException|SDK has not been initialized|ApplicationId|Client token|SecurityException|UnsatisfiedLinkError|Activity class.*not found|ANR" \
      > "$raw_log" || true
  fi

  cp "$raw_log" "$LOG_PATH"
  rm -f "$raw_log"
  redact_meta_client_token_file "$LOG_PATH"

  {
    echo ""
    echo "Process proof:"
    echo "pidof $APP_ID: $(adb_cmd shell pidof "$APP_ID" 2>/dev/null | tr -d '\r' || true)"
    adb_cmd shell dumpsys activity processes 2>/dev/null | grep -F "$APP_ID" || true
  } >> "$LOG_PATH"
}

scan_release_log_failures() {
  if grep -Eiq "FATAL EXCEPTION|FacebookException|SDK has not been initialized|missing.*ApplicationId|invalid.*ApplicationId|ApplicationId.*(missing|invalid)|missing.*client token|client token.*(missing|required|invalid)|SecurityException|UnsatisfiedLinkError|Activity class.*not found|Process ${APP_ID} has died|ANR in ${APP_ID}|Application Not Responding: ${APP_ID}" "$LOG_PATH"; then
    fail "Release log contains a GoodOne crash, Meta configuration, or launch failure signature: $LOG_PATH"
  fi
}

validate_boolean_env REQUIRE_ADB "$REQUIRE_ADB"
validate_boolean_env META_FRESH_INSTALL "$META_FRESH_INSTALL"
case "$META_RELEASE_LAUNCH_WAIT_SECONDS" in
  ''|*[!0-9]*) fail "META_RELEASE_LAUNCH_WAIT_SECONDS must be a positive integer." ;;
esac

if [ "$REQUIRE_ADB" != "true" ]; then
  echo "Release APK device QA skipped because REQUIRE_ADB=false."
  echo "Google Play Internal Testing is the authoritative runtime test for the Play-signed build."
  exit 0
fi

[ -f "$APK_PATH" ] || fail "Release APK not found: $APK_PATH"
verify_release_apk_not_debuggable

if ! command -v adb >/dev/null 2>&1; then
  fail "REQUIRE_ADB=true but adb is not installed or not on PATH."
fi

DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
if [ -z "$DEVICE_ID" ]; then
  adb devices -l || true
  fail "REQUIRE_ADB=true but no authorized adb device/emulator is connected."
fi

if [ "$META_FRESH_INSTALL" = "true" ]; then
  echo "Fresh-install mode: uninstalling $APP_ID if present..."
  adb_cmd uninstall "$APP_ID" >/dev/null 2>&1 || true
fi

echo "Installing release APK on $DEVICE_ID..."
adb_cmd install -r "$APK_PATH"

echo "Launching $APP_ID..."
adb_cmd logcat -c || true
LAUNCH_OUTPUT="$(adb_cmd shell monkey -p "$APP_ID" 1 2>&1)" || {
  echo "$LAUNCH_OUTPUT"
  fail "Release package launch failed."
}
echo "$LAUNCH_OUTPUT"

if echo "$LAUNCH_OUTPUT" | grep -Eiq "No activities found|monkey aborted|Activity class.*not found"; then
  fail "Release package launch output indicates $APP_ID could not be launched."
fi

APP_PID="$(wait_for_app_pid || true)"
[ -n "$APP_PID" ] || {
  capture_release_logcat ""
  fail "Did not observe a running $APP_ID process within ${META_RELEASE_LAUNCH_WAIT_SECONDS}s."
}
echo "$APP_ID is running with pid $APP_PID"

sleep "$META_RELEASE_LAUNCH_WAIT_SECONDS"
adb_cmd shell input keyevent HOME
sleep 2
adb_cmd shell monkey -p "$APP_ID" 1 >/dev/null
sleep 3
adb_cmd shell input keyevent HOME
sleep 2
adb_cmd shell monkey -p "$APP_ID" 1 >/dev/null
sleep 3

APP_PID="$(wait_for_app_pid || true)"
[ -n "$APP_PID" ] || {
  capture_release_logcat ""
  fail "$APP_ID process was not alive after background/foreground cycles."
}

capture_release_logcat "$APP_PID"
scan_release_log_failures

if adb_cmd exec-out screencap -p > "$SCREENSHOT_PATH"; then
  echo "Captured release screenshot at $SCREENSHOT_PATH"
else
  fail "Could not capture release screenshot."
fi

echo "Release APK device QA passed."
echo "Log written to: $LOG_PATH"
echo "Screenshot written to: $SCREENSHOT_PATH"
echo "APK tested: $APK_PATH"
echo "Note: do not force local upload-key App Links expectations onto this APK if live assetlinks.json contains only Google Play app-signing fingerprints. Use Google Play Internal Testing for the Play-signed runtime path."
