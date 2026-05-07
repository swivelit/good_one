#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
IOS_APP_DIR="$CLIENT_DIR/ios/App"
OUTPUT_DIR="$ROOT_DIR/dist/ios"
ARCHIVE_PATH="$OUTPUT_DIR/GoodOne.xcarchive"
IPA_EXPORT_DIR="$OUTPUT_DIR/ipa"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
USE_ADMOB_TEST_ADS="${REACT_APP_USE_ADMOB_TEST_ADS:-true}"
IOS_SCHEME="${IOS_SCHEME:-App}"
IOS_CONFIGURATION="${IOS_CONFIGURATION:-Release}"
IOS_DESTINATION="${IOS_DESTINATION:-generic/platform=iOS}"
IOS_TEAM_ID="${IOS_TEAM_ID:-}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-}"
IOS_EXPORT_OPTIONS_PLIST="${IOS_EXPORT_OPTIONS_PLIST:-}"

cat <<'BANNER'
========================================
 GoodOne iOS Archive Build
========================================
BANNER

if [ "$(uname -s)" != "Darwin" ]; then
  echo "ERROR: iOS builds require macOS with Xcode installed."
  exit 1
fi

if [ ! -d "$CLIENT_DIR" ]; then
  echo "ERROR: client directory not found."
  echo "Run this script from the project root."
  exit 1
fi

if [ ! -d "$IOS_APP_DIR" ]; then
  echo "ERROR: iOS project not found at client/ios/App."
  echo "Run: cd client && npx cap add ios"
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "ERROR: xcodebuild not found. Install Xcode and run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "ERROR: CocoaPods not found. Install it with: sudo gem install cocoapods"
  exit 1
fi

echo ""
echo "Xcode:"
xcodebuild -version

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
echo "Syncing Capacitor iOS..."
npx cap sync ios

echo ""
echo "Installing iOS pods..."
cd "$IOS_APP_DIR"
pod install --repo-update

echo ""
echo "Archiving iOS app..."
mkdir -p "$OUTPUT_DIR"
rm -rf "$ARCHIVE_PATH"

XCODEBUILD_ARGS=(
  -workspace "App.xcworkspace"
  -scheme "$IOS_SCHEME"
  -configuration "$IOS_CONFIGURATION"
  -destination "$IOS_DESTINATION"
  -archivePath "$ARCHIVE_PATH"
)

if [ -n "$IOS_TEAM_ID" ]; then
  XCODEBUILD_ARGS+=(DEVELOPMENT_TEAM="$IOS_TEAM_ID" CODE_SIGN_STYLE=Automatic)
else
  echo "WARNING: IOS_TEAM_ID is not set. If Xcode signing is not already configured, archive will fail."
  echo "Example: IOS_TEAM_ID=ABCDE12345 ./scripts/build-ios-archive.sh"
fi

if [ -n "$IOS_BUNDLE_ID" ]; then
  XCODEBUILD_ARGS+=(PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID")
fi

xcodebuild "${XCODEBUILD_ARGS[@]}" -allowProvisioningUpdates archive

cat <<EOF2

========================================
 iOS archive complete
========================================
Archive location:
$ARCHIVE_PATH
EOF2

if [ -n "$IOS_EXPORT_OPTIONS_PLIST" ]; then
  if [ ! -f "$IOS_EXPORT_OPTIONS_PLIST" ]; then
    echo "ERROR: IOS_EXPORT_OPTIONS_PLIST was set but file does not exist: $IOS_EXPORT_OPTIONS_PLIST"
    exit 1
  fi

  echo ""
  echo "Exporting IPA..."
  rm -rf "$IPA_EXPORT_DIR"
  mkdir -p "$IPA_EXPORT_DIR"
  xcodebuild \
    -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$IPA_EXPORT_DIR" \
    -exportOptionsPlist "$IOS_EXPORT_OPTIONS_PLIST" \
    -allowProvisioningUpdates

  cat <<EOF3

IPA export complete.
IPA folder:
$IPA_EXPORT_DIR
EOF3
else
  cat <<EOF4

IPA export skipped.
To export an IPA, create an ExportOptions.plist in Xcode or App Store Connect workflow, then rerun with:
IOS_EXPORT_OPTIONS_PLIST=/absolute/path/to/ExportOptions.plist ./scripts/build-ios-archive.sh

For local iPhone testing, open this archive in Xcode Organizer or run the app directly from Xcode after setting Signing & Capabilities.
EOF4
fi
