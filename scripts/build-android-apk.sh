#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.goodone.marketplace"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
ANDROID_DIR="$CLIENT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/dist"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="$OUTPUT_DIR/goodone-debug.apk"

echo "========================================"
echo " GoodOne Android APK Build"
echo "========================================"

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
  if /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "Using Java 21: $JAVA_HOME"
  else
    echo "WARNING: Java 21 not found via /usr/libexec/java_home."
    echo "Continuing with current Java:"
    java -version || true
  fi
else
  java -version || true
fi

echo ""
echo "Installing frontend dependencies..."
cd "$CLIENT_DIR"
npm ci

echo ""
echo "Building React app..."
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

echo ""
echo "========================================"
echo " APK build complete"
echo "========================================"
echo "APK location:"
echo "$APK_TARGET"
echo ""
echo "To install on phone with USB debugging:"
echo "adb install -r \"$APK_TARGET\""
echo ""
echo "To uninstall old app first:"
echo "adb uninstall $APP_ID"
echo ""