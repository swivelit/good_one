#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ID="com.goodone.marketplace"
APK_PATH="$ROOT_DIR/dist/goodone-debug.apk"
LOG_PATH="$ROOT_DIR/dist/goodone-debug-logcat.txt"

echo "Building GoodOne debug APK..."
bash "$ROOT_DIR/scripts/build-android-apk.sh"

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: APK build completed but $APK_PATH was not found."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "APK build succeeded: $APK_PATH"
  echo "Launch skipped because adb is not installed or not on PATH."
  exit 0
fi

DEVICE_ID="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"

if [ -z "$DEVICE_ID" ]; then
  echo "APK build succeeded: $APK_PATH"
  echo "Launch skipped because no adb device/emulator is connected."
  exit 0
fi

echo "Installing $APK_PATH on adb device $DEVICE_ID..."
adb -s "$DEVICE_ID" install -r "$APK_PATH"

echo "Launching $APP_ID..."
adb -s "$DEVICE_ID" logcat -c || true
adb -s "$DEVICE_ID" shell monkey -p "$APP_ID" 1
sleep 5

mkdir -p "$(dirname "$LOG_PATH")"
adb -s "$DEVICE_ID" logcat -d -v time \
  | grep -Ei "GoodOne|Capacitor|auth|forgot|otp|password|AndroidRuntime|FATAL EXCEPTION" \
  > "$LOG_PATH" || true

echo "Captured filtered logcat output at $LOG_PATH"
