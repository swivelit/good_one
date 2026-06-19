#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.goodone.marketplace"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="$ROOT_DIR/client"
ANDROID_DIR="$CLIENT_DIR/android"
OUTPUT_DIR="$ROOT_DIR/dist"
JAVA_HELPER="$ROOT_DIR/scripts/lib/java21.sh"

KEY_PROPERTIES="$ANDROID_DIR/key.properties"
ADMOB_RELEASE_ENV_FILE="$CLIENT_DIR/.env.admob.release.local"
ADMOB_SERVICE_FILE="$CLIENT_DIR/src/services/admob.js"

AAB_SOURCE="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

AAB_TARGET="$OUTPUT_DIR/goodone-release.aab"
APK_TARGET="$OUTPUT_DIR/goodone-release.apk"
AAB_SIGNATURE_LOG="$OUTPUT_DIR/goodone-release-aab-jarsigner.txt"
APK_SIGNATURE_LOG="$OUTPUT_DIR/goodone-release-apk-apksigner.txt"

NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"

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

mask_admob_id() {
  local ad_id="${1:-}"

  if [ -z "$ad_id" ]; then
    echo "missing"
    return
  fi

  local prefix="${ad_id%%/*}"
  local unit="${ad_id#*/}"

  if [ "$prefix" = "$ad_id" ] || [ -z "$unit" ]; then
    echo "configured"
    return
  fi

  local prefix_tail="${prefix: -4}"
  local unit_tail="${unit: -4}"
  echo "ca-app-pub-****${prefix_tail}/****${unit_tail}"
}

is_interstitial_admob_enabled() {
  [ -f "$ADMOB_SERVICE_FILE" ] && grep -q "export const showAdMobInterstitial" "$ADMOB_SERVICE_FILE"
}

require_admob_release_id() {
  local env_name="$1"
  local label="$2"
  local env_value="${!env_name:-}"

  if [ -z "$env_value" ]; then
    cat <<EOF
ERROR: Missing required production AdMob ID: $env_name ($label).

Create or update:
$ADMOB_RELEASE_ENV_FILE

Use this template:
$CLIENT_DIR/.env.admob.release.example
EOF
    exit 1
  fi
}

read_meta_release_setting() {
  local name="$1"
  local env_value="${!name:-}"

  if [ -n "$env_value" ]; then
    printf '%s' "$env_value"
    return 0
  fi

  if [ -f "$ANDROID_DIR/meta.properties" ]; then
    sed -nE "s/^[[:space:]]*${name}[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$/\\1/p" \
      "$ANDROID_DIR/meta.properties" | head -n 1
  fi
}

require_meta_release_setting() {
  local name="$1"
  local value

  value="$(read_meta_release_setting "$name" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  if [ -z "$value" ]; then
    echo "ERROR: Missing Meta Android release configuration: $name"
    echo "Set it as a CI/local environment variable or in ignored client/android/meta.properties."
    exit 1
  fi

  printf '%s' "$value"
}

validate_meta_release_config() {
  local meta_app_id
  local meta_client_token
  local meta_auto_log
  local meta_ad_id

  meta_app_id="$(require_meta_release_setting META_APP_ID)"
  meta_client_token="$(require_meta_release_setting META_CLIENT_TOKEN)"
  meta_auto_log="$(require_meta_release_setting META_AUTO_LOG_APP_EVENTS_ENABLED)"
  meta_ad_id="$(require_meta_release_setting META_ADVERTISER_ID_COLLECTION_ENABLED)"

  if ! printf '%s' "$meta_app_id" | grep -Eq '^[0-9]+$' ||
    [ "$meta_app_id" = "123456789012345" ] ||
    printf '%s' "$meta_app_id" | grep -Eq '^0+$'; then
    echo "ERROR: META_APP_ID must be numeric and non-placeholder."
    exit 1
  fi

  case "$(printf '%s' "$meta_client_token" | tr '[:upper:]' '[:lower:]')" in
    *replace*|*placeholder*|*example*)
      echo "ERROR: META_CLIENT_TOKEN must be non-placeholder."
      exit 1
      ;;
  esac

  case "$meta_auto_log" in
    true|false) ;;
    *) echo "ERROR: META_AUTO_LOG_APP_EVENTS_ENABLED must be exactly true or false."; exit 1 ;;
  esac

  case "$meta_ad_id" in
    true|false) ;;
    *) echo "ERROR: META_ADVERTISER_ID_COLLECTION_ENABLED must be exactly true or false."; exit 1 ;;
  esac

  META_RELEASE_APP_ID="$meta_app_id"
  META_RELEASE_AUTO_LOG="$meta_auto_log"
  META_RELEASE_AD_ID="$meta_ad_id"
}

cat <<'BANNER'
========================================
 GoodOne Android Release Build
========================================
This builds:
- Signed release AAB for Google Play upload
- Signed release APK for local QA only
========================================
BANNER

if [ ! -d "$CLIENT_DIR" ]; then
  echo "ERROR: client directory not found."
  echo "Run this script from the project root."
  exit 1
fi

cd "$ROOT_DIR"

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

if [ ! -f "$KEY_PROPERTIES" ]; then
  cat <<EOF
ERROR: Release signing file missing:

$KEY_PROPERTIES

Create it from:
$ANDROID_DIR/key.properties.example

Example:
cd "$ANDROID_DIR"
mkdir -p keystores
keytool -genkeypair \\
  -v \\
  -keystore keystores/goodone-upload-key.jks \\
  -alias goodone-upload \\
  -keyalg RSA \\
  -keysize 2048 \\
  -validity 10000

Then create android/key.properties with:
storeFile=../keystores/goodone-upload-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=goodone-upload
keyPassword=YOUR_KEY_PASSWORD

Never commit key.properties or the .jks file.
EOF
  exit 1
fi

if grep -q "CHANGE_ME" "$KEY_PROPERTIES"; then
  echo "ERROR: $KEY_PROPERTIES still contains CHANGE_ME values."
  echo "Fill real release signing values before building."
  exit 1
fi

echo ""
echo "Checking Meta Android release configuration..."
validate_meta_release_config
echo "Meta Android release configuration is present."

echo ""
echo "Loading release AdMob environment..."
cd "$CLIENT_DIR"
if [ -f "$ADMOB_RELEASE_ENV_FILE" ]; then
  echo "Loading $ADMOB_RELEASE_ENV_FILE"
  set -a
  # shellcheck source=/dev/null
  . "$ADMOB_RELEASE_ENV_FILE"
  set +a
else
  echo "WARNING: $ADMOB_RELEASE_ENV_FILE not found."
fi

export REACT_APP_USE_ADMOB_TEST_ADS=false
export_android_version_env

if [ -n "${CURRENT_PLAY_VERSION_CODE:-}" ]; then
  case "$CURRENT_PLAY_VERSION_CODE" in
    ''|*[!0-9]*)
      echo "ERROR: CURRENT_PLAY_VERSION_CODE must be a non-negative integer when supplied."
      exit 1
      ;;
  esac

  if [ "$REACT_APP_ANDROID_VERSION_CODE" -le "$CURRENT_PLAY_VERSION_CODE" ]; then
    echo "ERROR: Android versionCode $REACT_APP_ANDROID_VERSION_CODE must be greater than CURRENT_PLAY_VERSION_CODE=$CURRENT_PLAY_VERSION_CODE."
    exit 1
  fi
else
  echo "WARNING: CURRENT_PLAY_VERSION_CODE is not set. Check Play Console and confirm versionCode $REACT_APP_ANDROID_VERSION_CODE is greater than the highest uploaded version."
fi

echo "REACT_APP_USE_ADMOB_TEST_ADS=$REACT_APP_USE_ADMOB_TEST_ADS"
echo "REACT_APP_ANDROID_VERSION_CODE=$REACT_APP_ANDROID_VERSION_CODE"
echo "REACT_APP_ANDROID_VERSION_NAME=$REACT_APP_ANDROID_VERSION_NAME"
echo "META_AUTO_LOG_APP_EVENTS_ENABLED=$META_RELEASE_AUTO_LOG"
echo "META_ADVERTISER_ID_COLLECTION_ENABLED=$META_RELEASE_AD_ID"
echo "REACT_APP_ADMOB_ANDROID_BANNER_ID=$(mask_admob_id "${REACT_APP_ADMOB_ANDROID_BANNER_ID:-}")"
echo "REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID=$(mask_admob_id "${REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID:-}")"
echo "REACT_APP_ADMOB_ANDROID_NATIVE_ID=$(mask_admob_id "${REACT_APP_ADMOB_ANDROID_NATIVE_ID:-}")"
echo "REACT_APP_ADMOB_ANDROID_REWARDED_ID=$(mask_admob_id "${REACT_APP_ADMOB_ANDROID_REWARDED_ID:-}")"
echo "REACT_APP_ADMOB_ANDROID_APP_OPEN_ID=$(mask_admob_id "${REACT_APP_ADMOB_ANDROID_APP_OPEN_ID:-}")"
echo "Do not upload this AAB if required production AdMob IDs are missing."

require_admob_release_id REACT_APP_ADMOB_ANDROID_BANNER_ID "banner"
if is_interstitial_admob_enabled; then
  require_admob_release_id REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID "interstitial"
fi
require_admob_release_id REACT_APP_ADMOB_ANDROID_NATIVE_ID "native advanced"

if [ "${REACT_APP_ADMOB_ANDROID_NATIVE_ID:-}" = "${REACT_APP_ADMOB_ANDROID_BANNER_ID:-}" ]; then
  echo "ERROR: Native Advanced ad ID must not match the banner ad ID."
  echo "Use a Native Advanced unit for REACT_APP_ADMOB_ANDROID_NATIVE_ID."
  exit 1
fi

echo ""
echo "Installing frontend dependencies..."
npm ci --prefer-offline --no-audit --registry="$NPM_REGISTRY"

echo ""
echo "Building React production bundle with AdMob production env config..."
npm run build

echo ""
echo "Syncing Capacitor Android..."
npx cap sync android

echo ""
echo "Building signed release AAB and APK..."
cd "$ANDROID_DIR"
./gradlew clean bundleRelease assembleRelease

if [ ! -f "$AAB_SOURCE" ]; then
  echo "ERROR: Release AAB not found at $AAB_SOURCE"
  exit 1
fi

if [ ! -f "$APK_SOURCE" ]; then
  echo "ERROR: Release APK not found at $APK_SOURCE"
  exit 1
fi

echo ""
echo "Verifying Meta SDK release artifacts before copying..."
cd "$ROOT_DIR"
"$ROOT_DIR/scripts/verify-meta-sdk-android.sh" --variant release --skip-build

echo ""
echo "Copying release artifacts to dist..."
mkdir -p "$OUTPUT_DIR"
cp "$AAB_SOURCE" "$AAB_TARGET"
cp "$APK_SOURCE" "$APK_TARGET"

echo ""
echo "Verifying AAB signature..."
if command -v jarsigner >/dev/null 2>&1; then
  if jarsigner -verify -certs "$AAB_TARGET" > "$AAB_SIGNATURE_LOG" 2>&1; then
    echo "AAB signature verified with jarsigner. Details: $AAB_SIGNATURE_LOG"
  else
    cat "$AAB_SIGNATURE_LOG"
    exit 1
  fi
else
  echo "WARNING: jarsigner not found; skipping AAB signature verification."
fi

echo ""
echo "Verifying APK signature..."
APK_SIGNER=""
if command -v apksigner >/dev/null 2>&1; then
  APK_SIGNER="$(command -v apksigner)"
else
  for candidate in \
    "${ANDROID_HOME:-}/build-tools"/*/apksigner \
    "${ANDROID_SDK_ROOT:-}/build-tools"/*/apksigner
  do
    if [ -x "$candidate" ]; then
      APK_SIGNER="$candidate"
      break
    fi
  done
fi

if [ -n "$APK_SIGNER" ]; then
  if "$APK_SIGNER" verify --verbose "$APK_TARGET" > "$APK_SIGNATURE_LOG" 2>&1; then
    echo "APK signature verified with apksigner. Details: $APK_SIGNATURE_LOG"
  else
    cat "$APK_SIGNATURE_LOG"
    exit 1
  fi
else
  echo "WARNING: apksigner not found; skipping APK signature verification."
fi

if [ "${RUN_RELEASE_DEVICE_QA:-false}" = "true" ]; then
  echo ""
  echo "Running release APK device QA..."
  "$ROOT_DIR/scripts/test-android-release-apk.sh"
fi

cat <<EOF

========================================
Release build complete
========================================

Google Play upload artifact:
$AAB_TARGET

Local QA install artifact:
$APK_TARGET

Install release APK locally:
adb install -r "$APK_TARGET"

Uninstall old app first, if needed:
adb uninstall $APP_ID

Important:
- Upload the AAB to Google Play. APK is for local QA only.
- Do not click your own live AdMob ads.
- Use debug builds/test devices for ad testing.
- Package: $APP_ID
- versionCode: $REACT_APP_ANDROID_VERSION_CODE
- versionName: $REACT_APP_ANDROID_VERSION_NAME
- Meta automatic app events enabled: $META_RELEASE_AUTO_LOG
- Meta advertiser-ID collection enabled: $META_RELEASE_AD_ID

EOF
