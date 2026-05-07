#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.goodone.marketplace"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
ANDROID_DIR="$CLIENT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/dist"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="$OUTPUT_DIR/goodone-debug.apk"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
USE_ADMOB_TEST_ADS="${REACT_APP_USE_ADMOB_TEST_ADS:-true}"

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
if command -v /usr/libexec/java_home >/dev/null 2>&1; then
  if /usr/libexec/java_home -v 17 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "Using Java 17: $JAVA_HOME"
  elif /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "Using Java 21: $JAVA_HOME"
  else
    echo "WARNING: Java 17/21 not found via /usr/libexec/java_home."
    echo "Continuing with current Java:"
    java -version || true
  fi
else
  java -version || true
fi

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
echo "REACT_APP_USE_ADMOB_TEST_ADS=$USE_ADMOB_TEST_ADS"
REACT_APP_USE_ADMOB_TEST_ADS="$USE_ADMOB_TEST_ADS" npm run build

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

For AdMob banner logs while testing:
cd "$CLIENT_DIR" && npm run logs:android:admob

EOF2
