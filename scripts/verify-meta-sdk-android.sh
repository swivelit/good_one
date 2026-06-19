#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/client/android"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
APP_ID="com.goodone.marketplace"
EXPECTED_VERSION_CODE="11"
EXPECTED_VERSION_NAME="1.9"
DEPENDENCY_LOG="$ROOT_DIR/dist/meta-sdk-debugRuntimeClasspath.txt"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required tool not found on PATH: $1"
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    fail "Required file not found: $1"
  fi
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

get_configured_client_token() {
  if [ -n "${META_CLIENT_TOKEN:-}" ]; then
    printf '%s' "$META_CLIENT_TOKEN"
    return 0
  fi

  if [ -f "$ANDROID_DIR/meta.properties" ]; then
    sed -nE 's/^[[:space:]]*META_CLIENT_TOKEN[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$/\1/p' \
      "$ANDROID_DIR/meta.properties" | head -n 1
  fi
}

find_generated_values_file() {
  local generated_file=""
  while IFS= read -r candidate; do
    if grep -Fq 'name="facebook_app_id"' "$candidate" &&
      grep -Fq 'name="facebook_client_token"' "$candidate"; then
      generated_file="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build" -type f -name "*.xml" 2>/dev/null | sort)

  printf '%s' "$generated_file"
}

xml_string_value() {
  local file_path="$1"
  local resource_name="$2"
  sed -nE "s/.*<(string|item)[^>]*name=\"${resource_name}\"[^>]*>([^<]*)<\\/(string|item)>.*/\\2/p" "$file_path" |
    sed -E 's/^"//; s/"$//; s/^&quot;//; s/&quot;$//' |
    head -n 1
}

find_merged_manifest() {
  local merged_manifest=""
  while IFS= read -r candidate; do
    if grep -Fq 'com.facebook.sdk.ApplicationId' "$candidate"; then
      merged_manifest="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build/intermediates" -type f -name AndroidManifest.xml -path "*debug*" 2>/dev/null | sort)

  printf '%s' "$merged_manifest"
}

find_manifest_report() {
  local preferred_report="$ANDROID_DIR/app/build/intermediates/manifest_merge_blame_file/debug/processDebugMainManifest/manifest-merger-blame-debug-report.txt"
  if [ -f "$preferred_report" ]; then
    printf '%s' "$preferred_report"
    return 0
  fi

  local report=""
  while IFS= read -r candidate; do
    if grep -Fq 'uses-permission' "$candidate"; then
      report="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build" -type f \( -name "*manifest*report*.txt" -o -name "manifest-merger-*.txt" \) 2>/dev/null | sort)

  printf '%s' "$report"
}

permission_source() {
  local permission="$1"
  local report_path="$2"

  if [ -z "$report_path" ] || [ ! -f "$report_path" ]; then
    printf 'source unavailable'
    return 0
  fi

  awk -v permission="$permission" '
    index($0, "<uses-permission android:name=\"" permission "\"") {
      if (match($0, /^[0-9]+/)) {
        line_number = substr($0, RSTART, RLENGTH)
        in_permission = 1
      }
      next
    }
    in_permission && index($0, line_number "-->") == 1 {
      sub(/^[0-9]+-->/, "", $0)
      print $0
      found = 1
      exit
    }
    in_permission && /^[0-9]+[[:space:]]*</ {
      in_permission = 0
    }
    END {
      if (!found) print "source unavailable in manifest report"
    }
  ' "$report_path" | head -n 1
}

extract_permissions() {
  local manifest_path="$1"
  sed -nE 's/.*<uses-permission[^>]*android:name="([^"]+)".*/\1/p' "$manifest_path" | sort -u
}

verify_apk_with_apkanalyzer() {
  local apkanalyzer_bin="$1"
  local apk_path="$2"
  local manifest_dump="$ROOT_DIR/dist/meta-sdk-apk-manifest.txt"

  local actual_app_id
  local actual_version_code
  local actual_version_name

  actual_app_id="$("$apkanalyzer_bin" manifest application-id "$apk_path")"
  actual_version_code="$("$apkanalyzer_bin" manifest version-code "$apk_path")"
  actual_version_name="$("$apkanalyzer_bin" manifest version-name "$apk_path")"

  [ "$actual_app_id" = "$APP_ID" ] || fail "APK package is $actual_app_id, expected $APP_ID"
  [ "$actual_version_code" = "$EXPECTED_VERSION_CODE" ] ||
    fail "APK versionCode is $actual_version_code, expected $EXPECTED_VERSION_CODE"
  [ "$actual_version_name" = "$EXPECTED_VERSION_NAME" ] ||
    fail "APK versionName is $actual_version_name, expected $EXPECTED_VERSION_NAME"

  "$apkanalyzer_bin" manifest print "$apk_path" > "$manifest_dump"
  grep -Fq 'com.facebook.sdk.ApplicationId' "$manifest_dump" ||
    fail "Packaged APK manifest is missing Meta ApplicationId metadata."
  grep -Fq 'com.facebook.sdk.ClientToken' "$manifest_dump" ||
    fail "Packaged APK manifest is missing Meta ClientToken metadata."

  pass "APK identity verified with apkanalyzer."
}

verify_apk_with_aapt() {
  local aapt_bin="$1"
  local apk_path="$2"
  local badging_dump="$ROOT_DIR/dist/meta-sdk-apk-badging.txt"
  local manifest_dump="$ROOT_DIR/dist/meta-sdk-apk-manifest.txt"

  "$aapt_bin" dump badging "$apk_path" > "$badging_dump"

  local package_line
  package_line="$(sed -n "s/^package: //p" "$badging_dump" | head -n 1)"
  echo "$package_line" | grep -Fq "name='$APP_ID'" || fail "APK package name did not match $APP_ID."
  echo "$package_line" | grep -Fq "versionCode='$EXPECTED_VERSION_CODE'" ||
    fail "APK versionCode did not match $EXPECTED_VERSION_CODE."
  echo "$package_line" | grep -Fq "versionName='$EXPECTED_VERSION_NAME'" ||
    fail "APK versionName did not match $EXPECTED_VERSION_NAME."

  "$aapt_bin" dump xmltree "$apk_path" AndroidManifest.xml > "$manifest_dump"
  grep -Fq 'com.facebook.sdk.ApplicationId' "$manifest_dump" ||
    fail "Packaged APK manifest is missing Meta ApplicationId metadata."
  grep -Fq 'com.facebook.sdk.ClientToken' "$manifest_dump" ||
    fail "Packaged APK manifest is missing Meta ClientToken metadata."

  pass "APK identity verified with aapt."
}

scan_reports_for_token() {
  local token="$1"
  [ -n "$token" ] || return 0

  local paths=(
    "$DEPENDENCY_LOG"
    "$ROOT_DIR/dist/meta-sdk-apk-badging.txt"
    "$ROOT_DIR/dist/meta-sdk-apk-manifest.txt"
    "$ANDROID_DIR/app/build/reports"
    "$ANDROID_DIR/app/build/test-results"
    "$ANDROID_DIR/app/build/outputs/logs"
  )

  local path
  for path in "${paths[@]}"; do
    if [ -e "$path" ] && grep -RqsF "$token" "$path"; then
      fail "A generated report or diagnostic file contains the complete Meta client token: $path"
    fi
  done
}

mkdir -p "$ROOT_DIR/dist"

require_tool git
require_tool grep
require_tool sed
require_tool awk
require_tool find
require_tool sort
require_tool java
require_file "$APP_GRADLE"
require_file "$ANDROID_DIR/gradlew"

cd "$ROOT_DIR"

FORBIDDEN_DIFF_PATTERN='app[_ -]?sec''ret|META_APP_SEC''RET|client_sec''ret|BEGIN (RSA |EC )?PRIVATE KEY|storePass''word|keyPass''word'
PROJECT_SECRET_PATTERN='META_APP_SEC''RET|facebook_app_sec''ret|app[_ -]?sec''ret[[:space:]]*[=:]|client_sec''ret[[:space:]]*[=:]'

if ! git check-ignore -q client/android/meta.properties; then
  fail "client/android/meta.properties is not ignored by Git."
fi
pass "client/android/meta.properties is ignored by Git."

if git ls-files --error-unmatch client/android/meta.properties >/dev/null 2>&1; then
  fail "client/android/meta.properties is tracked. Remove it from Git."
fi
pass "client/android/meta.properties is not tracked."

if git diff -- . ':!client/android/meta.properties' |
  grep -Eiq "$FORBIDDEN_DIFF_PATTERN"; then
  fail "Forbidden secret-like material found in tracked changes."
fi
pass "No forbidden secret-like material found in tracked changes."

if git grep -Eiq "$PROJECT_SECRET_PATTERN" -- \
  client/android client/src scripts launch-debug_apk.sh; then
  fail "Forbidden Meta server-secret-like setting found in project files."
fi
pass "No Meta server-secret-like project setting was introduced."

grep -Fq "implementation 'com.facebook.android:facebook-core:18.2.3'" "$APP_GRADLE" ||
  fail "Exact facebook-core 18.2.3 dependency is missing from app/build.gradle."
pass "Exact facebook-core 18.2.3 dependency is declared."

if grep -RInE 'facebook-android-sdk|latest\.release' "$ANDROID_DIR/app" "$ANDROID_DIR/build.gradle" >/dev/null 2>&1; then
  fail "Rejected dependency pattern found: facebook-android-sdk or latest.release."
fi
pass "Umbrella facebook-android-sdk and latest.release are absent."

echo "Running Gradle dependency and Android checks..."
(
  cd "$ANDROID_DIR"
  ./gradlew :app:dependencies --configuration debugRuntimeClasspath
) | tee "$DEPENDENCY_LOG"

grep -Fq 'com.facebook.android:facebook-core:18.2.3' "$DEPENDENCY_LOG" ||
  fail "debugRuntimeClasspath did not resolve com.facebook.android:facebook-core:18.2.3."
if grep -Fq 'com.facebook.android:facebook-android-sdk' "$DEPENDENCY_LOG"; then
  fail "debugRuntimeClasspath resolved the umbrella facebook-android-sdk artifact."
fi
pass "Resolved dependency tree includes facebook-core 18.2.3 and excludes facebook-android-sdk."

(
  cd "$ANDROID_DIR"
  ./gradlew :app:processDebugMainManifest
  ./gradlew :app:lintDebug
  ./gradlew :app:testDebugUnitTest
  ./gradlew :app:assembleDebug
)

MERGED_MANIFEST="$(find_merged_manifest)"
[ -n "$MERGED_MANIFEST" ] || fail "Could not locate merged debug manifest containing Meta metadata."
pass "Merged debug manifest found: $MERGED_MANIFEST"

for metadata_name in \
  'com.facebook.sdk.ApplicationId' \
  'com.facebook.sdk.ClientToken' \
  'com.facebook.sdk.AutoInitEnabled' \
  'com.facebook.sdk.AutoLogAppEventsEnabled' \
  'com.facebook.sdk.AdvertiserIDCollectionEnabled'; do
  grep -Fq "$metadata_name" "$MERGED_MANIFEST" ||
    fail "Merged manifest missing metadata: $metadata_name"
done
pass "Merged manifest contains all required Meta metadata entries."

GENERATED_VALUES_FILE="$(find_generated_values_file)"
[ -n "$GENERATED_VALUES_FILE" ] || fail "Could not locate generated resource values for Meta SDK."
APP_ID_VALUE="$(xml_string_value "$GENERATED_VALUES_FILE" facebook_app_id)"
TOKEN_PRESENT="$(xml_string_value "$GENERATED_VALUES_FILE" facebook_client_token)"

echo "$APP_ID_VALUE" | grep -Eq '^[0-9]+$' ||
  fail "Generated Meta App ID is not numeric."
[ "$APP_ID_VALUE" != "123456789012345" ] || fail "Generated Meta App ID is the placeholder."
echo "$APP_ID_VALUE" | grep -Eq '^0+$' && fail "Generated Meta App ID is all zeroes."
[ -n "$TOKEN_PRESENT" ] || fail "Generated Meta client token is missing."
case "$(printf '%s' "$TOKEN_PRESENT" | tr '[:upper:]' '[:lower:]')" in
  *replace*|*placeholder*|*example*) fail "Generated Meta client token is a placeholder." ;;
esac
pass "Generated Meta App ID and client token are non-placeholder."

MANIFEST_REPORT="$(find_manifest_report)"
echo "Merged manifest permissions:"
PERMISSIONS="$(extract_permissions "$MERGED_MANIFEST")"
if [ -n "$PERMISSIONS" ]; then
  printf '%s\n' "$PERMISSIONS" | sed 's/^/  /'
else
  echo "  (none)"
fi

for permission in \
  'com.google.android.gms.permission.AD_ID' \
  'android.permission.ACCESS_ADSERVICES_ATTRIBUTION' \
  'android.permission.ACCESS_ADSERVICES_AD_ID' \
  'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE' \
  'android.permission.ACCESS_ADSERVICES_TOPICS'; do
  if printf '%s\n' "$PERMISSIONS" | grep -Fxq "$permission"; then
    echo "Permission present: $permission"
    echo "  Source: $(permission_source "$permission" "$MANIFEST_REPORT")"
  else
    echo "Permission absent: $permission"
  fi
done

APK_PATH="$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -type f -name "*.apk" | sort | tail -n 1)"
[ -n "$APK_PATH" ] && [ -f "$APK_PATH" ] || fail "Could not locate debug APK."
pass "Debug APK found: $APK_PATH"

APKANALYZER_BIN="$(find_android_tool apkanalyzer || true)"
AAPT_BIN="$(find_android_tool aapt || true)"
AAPT2_BIN="$(find_android_tool aapt2 || true)"

if [ -n "$APKANALYZER_BIN" ] && [ -x "$APKANALYZER_BIN" ]; then
  verify_apk_with_apkanalyzer "$APKANALYZER_BIN" "$APK_PATH"
elif [ -n "$AAPT_BIN" ] && [ -x "$AAPT_BIN" ]; then
  verify_apk_with_aapt "$AAPT_BIN" "$APK_PATH"
elif [ -n "$AAPT2_BIN" ] && [ -x "$AAPT2_BIN" ]; then
  verify_apk_with_aapt "$AAPT2_BIN" "$APK_PATH"
else
  echo "WARNING: apkanalyzer/aapt/aapt2 not found; APK manifest package verification skipped."
fi

scan_reports_for_token "$(get_configured_client_token)"
pass "Generated reports checked for complete Meta client token leakage."

cat <<EOF

Meta SDK Android verification passed.
Dependency: com.facebook.android:facebook-core:18.2.3
APK: $APK_PATH
Merged manifest: $MERGED_MANIFEST
Generated values: $GENERATED_VALUES_FILE
EOF
