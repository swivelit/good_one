#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.goodone.marketplace"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
ANDROID_DIR="$CLIENT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/dist"
JAVA_HELPER="$ROOT_DIR/scripts/lib/java21.sh"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="$OUTPUT_DIR/goodone-debug.apk"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
USE_ADMOB_TEST_ADS="${REACT_APP_USE_ADMOB_TEST_ADS:-true}"

if [ "${ALLOW_LIVE_ADS_IN_DEBUG:-false}" != "true" ]; then
  if [ "${REACT_APP_USE_ADMOB_TEST_ADS:-true}" = "false" ]; then
    echo "WARNING: Debug APK builds use Google test ads by default."
    echo "Set ALLOW_LIVE_ADS_IN_DEBUG=true only for explicit live-ad debug testing."
  fi
  USE_ADMOB_TEST_ADS=true
fi

export_android_version_env() {
  local gradle_file="$ANDROID_DIR/app/build.gradle"
  local version_code
  local version_name

  if [ ! -f "$gradle_file" ]; then
    echo "ERROR: Android Gradle file not found at $gradle_file"
    exit 1
  fi

  version_code="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' "$gradle_file" | head -n 1)"
  version_name="$(sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/p' "$gradle_file" | head -n 1)"

  if [ -z "$version_code" ] || [ -z "$version_name" ]; then
    echo "ERROR: Could not parse versionCode/versionName from $gradle_file"
    exit 1
  fi

  export REACT_APP_ANDROID_VERSION_CODE="$version_code"
  export REACT_APP_ANDROID_VERSION_NAME="$version_name"
}

cat <<'BANNER'
========================================
 GoodOne Android APK Build
========================================
BANNER

if [ ! -d "$CLIENT_DIR" ]; then
  echo "ERROR: client directory not found."
  echo "Run this script from the project root."
  exit 1
fi

if [ ! -d "$ANDROID_DIR" ]; then
  echo "ERROR: Android project not found at client/android."
  echo "Run: cd client && npx cap add android"
  exit 1
fi

echo ""
echo "Checking Java..."
# shellcheck source=scripts/lib/java21.sh
. "$JAVA_HELPER"
require_java21

echo ""
echo "Installing frontend dependencies..."
echo "Using npm registry: $NPM_REGISTRY"
cd "$CLIENT_DIR"
if [ "${SKIP_NPM_CI:-false}" = "true" ]; then
  echo "Skipping npm ci because SKIP_NPM_CI=true"
elif ! npm ci --prefer-offline --no-audit --registry="$NPM_REGISTRY"; then
  if [ -d node_modules ]; then
    echo "WARNING: npm ci failed, but node_modules exists. Continuing with existing dependencies."
    echo "For a clean build, fix npm/network access and rerun without SKIP_NPM_CI."
  else
    echo "ERROR: npm ci failed and node_modules is missing."
    echo "Check your network/proxy/npm registry, then rerun."
    exit 1
  fi
fi

echo ""
echo "Building React app..."
export_android_version_env
export REACT_APP_USE_ADMOB_TEST_ADS="$USE_ADMOB_TEST_ADS"
echo "REACT_APP_USE_ADMOB_TEST_ADS=$REACT_APP_USE_ADMOB_TEST_ADS"
echo "REACT_APP_ANDROID_VERSION_CODE=$REACT_APP_ANDROID_VERSION_CODE"
echo "REACT_APP_ANDROID_VERSION_NAME=$REACT_APP_ANDROID_VERSION_NAME"
npm run build

echo ""
echo "Syncing Capacitor Android..."
npx cap sync android

echo ""
echo "Building debug APK..."
cd "$ANDROID_DIR"
./gradlew assembleDebug

echo ""
echo "Copying APK to dist folder..."
mkdir -p "$OUTPUT_DIR"
cp "$APK_SOURCE" "$APK_TARGET"

cat <<EOF2

========================================
 APK build complete
========================================
APK location:
$APK_TARGET

To install on phone with USB debugging:
adb install -r "$APK_TARGET"

To uninstall old app first:
adb uninstall $APP_ID

For AdMob logs while testing:
cd "$CLIENT_DIR" && npm run logs:android:admob

EOF2
