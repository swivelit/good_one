#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/client/android"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
MAIN_ACTIVITY="$ANDROID_DIR/app/src/main/java/com/goodone/marketplace/MainActivity.java"
JAVA_HELPER="$ROOT_DIR/scripts/lib/java21.sh"
VARIANT="debug"
SKIP_BUILD="false"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

warn() {
  echo "WARNING: $*"
}

skipped() {
  echo "SKIPPED: $*"
}

usage() {
  cat <<'EOF'
Usage:
  ./scripts/verify-meta-sdk-android.sh [--variant debug|release] [--skip-build]

Supported:
  ./scripts/verify-meta-sdk-android.sh --variant debug
  ./scripts/verify-meta-sdk-android.sh --variant release
  ./scripts/verify-meta-sdk-android.sh --variant release --skip-build
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --variant)
      [ "$#" -ge 2 ] || { usage >&2; fail "--variant requires debug or release."; }
      VARIANT="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown argument: $1"
      ;;
  esac
done

case "$VARIANT" in
  debug|release) ;;
  *) usage >&2; fail "Unknown variant: $VARIANT" ;;
esac

if [ "$SKIP_BUILD" = "true" ] && [ "$VARIANT" != "release" ]; then
  fail "--skip-build is supported only with --variant release."
fi

VARIANT_CAP="$(printf '%s' "$VARIANT" | awk '{ print toupper(substr($0,1,1)) substr($0,2) }')"
RUNTIME_CONFIG="${VARIANT}RuntimeClasspath"
DEPENDENCY_LOG="$ROOT_DIR/dist/meta-sdk-${RUNTIME_CONFIG}.txt"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/$VARIANT/app-${VARIANT}.apk"
AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
MERGED_MANIFEST="$ANDROID_DIR/app/build/intermediates/merged_manifest/$VARIANT/process${VARIANT_CAP}MainManifest/AndroidManifest.xml"
MANIFEST_REPORT="$ANDROID_DIR/app/build/intermediates/manifest_merge_blame_file/$VARIANT/process${VARIANT_CAP}MainManifest/manifest-merger-blame-${VARIANT}-report.txt"
GENERATED_VALUES_FILE="$ANDROID_DIR/app/build/generated/res/resValues/$VARIANT/values/gradleResValues.xml"

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

is_runnable_bundletool() {
  local candidate="$1"

  case "$candidate" in
    *.jar) java -jar "$candidate" version >/dev/null 2>&1 ;;
    *) "$candidate" version >/dev/null 2>&1 ;;
  esac
}

find_bundletool() {
  local candidate

  if command -v bundletool >/dev/null 2>&1; then
    candidate="$(command -v bundletool)"
    if is_runnable_bundletool "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  fi

  local sdk_dir="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  for root in "$sdk_dir" "$HOME/.gradle/caches/modules-2/files-2.1/com.android.tools.build/bundletool"; do
    [ -d "$root" ] || continue
    while IFS= read -r candidate; do
      if is_runnable_bundletool "$candidate"; then
        printf '%s' "$candidate"
        return 0
      fi
    done < <(find "$root" -type f \( -name 'bundletool-all*.jar' -o -name 'bundletool*.jar' \) 2>/dev/null | sort -r)
  done
}

parse_gradle_value() {
  local pattern="$1"
  local label="$2"
  local value

  value="$(sed -nE "$pattern" "$APP_GRADLE" | head -n 1)"
  [ -n "$value" ] || fail "Could not parse $label from $APP_GRADLE."
  printf '%s' "$value"
}

xml_string_value() {
  local file_path="$1"
  local resource_name="$2"
  sed -nE "s/.*<(string|item)[^>]*name=\"${resource_name}\"[^>]*>([^<]*)<\\/(string|item)>.*/\\2/p" "$file_path" |
    sed -E 's/^"//; s/"$//; s/^&quot;//; s/&quot;$//' |
    head -n 1
}

xml_bool_value() {
  local file_path="$1"
  local resource_name="$2"
  sed -nE "s/.*<(bool|item)[^>]*name=\"${resource_name}\"[^>]*>([^<]*)<\\/(bool|item)>.*/\\2/p" "$file_path" |
    sed -E 's/^[[:space:]]+|[[:space:]]+$//g' |
    head -n 1
}

find_generated_values_file() {
  if [ -f "$GENERATED_VALUES_FILE" ]; then
    printf '%s' "$GENERATED_VALUES_FILE"
    return 0
  fi

  local generated_file=""
  while IFS= read -r candidate; do
    if grep -Fq 'name="facebook_app_id"' "$candidate" &&
      grep -Fq 'name="facebook_client_token"' "$candidate"; then
      generated_file="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build/generated/res" -type f -path "*${VARIANT}*" -name "*.xml" 2>/dev/null | sort)

  printf '%s' "$generated_file"
}

find_merged_manifest() {
  if [ -f "$MERGED_MANIFEST" ]; then
    printf '%s' "$MERGED_MANIFEST"
    return 0
  fi

  local merged_manifest=""
  while IFS= read -r candidate; do
    if grep -Fq 'com.facebook.sdk.ApplicationId' "$candidate"; then
      merged_manifest="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build/intermediates" -type f -name AndroidManifest.xml -path "*${VARIANT}*" 2>/dev/null | sort)

  printf '%s' "$merged_manifest"
}

find_manifest_report() {
  if [ -f "$MANIFEST_REPORT" ]; then
    printf '%s' "$MANIFEST_REPORT"
    return 0
  fi

  local report=""
  while IFS= read -r candidate; do
    if grep -Fq 'uses-permission' "$candidate"; then
      report="$candidate"
      break
    fi
  done < <(find "$ANDROID_DIR/app/build" -type f \( -name "*manifest*report*.txt" -o -name "manifest-merger-*.txt" \) -path "*${VARIANT}*" 2>/dev/null | sort)

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

scan_reports_for_token() {
  local token="$1"
  [ -n "$token" ] || return 0

  local paths=(
    "$DEPENDENCY_LOG"
    "$ROOT_DIR/dist"
    "$ANDROID_DIR/app/build/reports"
    "$ANDROID_DIR/app/build/test-results"
    "$ANDROID_DIR/app/build/outputs/logs"
  )

  local path
  local file
  for path in "${paths[@]}"; do
    [ -e "$path" ] || continue
    while IFS= read -r -d '' file; do
      if grep -qsF "$token" "$file"; then
        fail "A generated text report or diagnostic file contains the complete Meta client token under: $path"
      fi
    done < <(find "$path" -type f \
      -size -5M \
      \( -name '*.txt' -o -name '*.log' -o -name '*.html' -o -name '*.xml' -o -name '*.json' -o -name '*.properties' -o -name '*.csv' \) \
      -print0 2>/dev/null)
  done
}

verify_no_placeholder_in_artifact() {
  local artifact="$1"
  if grep -aFq '123456789012345' "$artifact" ||
    grep -aFq 'replace_with_meta_client_token' "$artifact"; then
    fail "Release artifact contains placeholder Meta values: $artifact"
  fi
}

ensure_fresh_enough() {
  local output="$1"
  shift
  require_file "$output"

  local source
  for source in "$@"; do
    [ -e "$source" ] || continue
    if [ "$output" -ot "$source" ]; then
      fail "Required release output looks stale: $output is older than $source"
    fi
  done
}

run_gradle_checks() {
  mkdir -p "$ROOT_DIR/dist"

  echo "Running Gradle dependency check for $RUNTIME_CONFIG..."
  (
    cd "$ANDROID_DIR"
    ./gradlew :app:dependencies --configuration "$RUNTIME_CONFIG"
  ) | tee "$DEPENDENCY_LOG" >/dev/null

  grep -Fq 'com.facebook.android:facebook-core:18.2.3' "$DEPENDENCY_LOG" ||
    fail "$RUNTIME_CONFIG did not resolve com.facebook.android:facebook-core:18.2.3."
  if grep -Fq 'com.facebook.android:facebook-android-sdk' "$DEPENDENCY_LOG"; then
    fail "$RUNTIME_CONFIG resolved the umbrella facebook-android-sdk artifact."
  fi
  pass "Resolved dependency tree includes facebook-core 18.2.3 and excludes facebook-android-sdk."

  if [ "$SKIP_BUILD" = "true" ]; then
    skipped "Release Gradle build tasks skipped by request."
    return 0
  fi

  echo "Running Gradle $VARIANT verification tasks..."
  if [ "$VARIANT" = "debug" ]; then
    (
      cd "$ANDROID_DIR"
      ./gradlew :app:processDebugMainManifest
      ./gradlew :app:lintDebug
      ./gradlew :app:testDebugUnitTest
      ./gradlew :app:assembleDebug
    )
  else
    (
      cd "$ANDROID_DIR"
      ./gradlew :app:processReleaseMainManifest
      ./gradlew :app:lintRelease
      ./gradlew :app:testReleaseUnitTest
      ./gradlew :app:assembleRelease
      ./gradlew :app:bundleRelease
    )
  fi
}

verify_manifest_and_values() {
  local merged_manifest
  local generated_values
  local app_id_value
  local token_value
  local auto_log_value
  local ad_id_value

  merged_manifest="$(find_merged_manifest)"
  [ -n "$merged_manifest" ] || fail "Could not locate merged $VARIANT manifest containing Meta metadata."
  pass "Merged $VARIANT manifest found: $merged_manifest"

  for metadata_name in \
    'com.facebook.sdk.ApplicationId' \
    'com.facebook.sdk.ClientToken' \
    'com.facebook.sdk.AutoInitEnabled' \
    'com.facebook.sdk.AutoLogAppEventsEnabled' \
    'com.facebook.sdk.AdvertiserIDCollectionEnabled'; do
    grep -Fq "$metadata_name" "$merged_manifest" ||
      fail "Merged manifest missing metadata: $metadata_name"
  done
  grep -Fq 'android:name="com.facebook.sdk.AutoInitEnabled"' "$merged_manifest" ||
    fail "Merged manifest missing AutoInitEnabled name."
  grep -Fq 'android:value="true"' "$merged_manifest" ||
    fail "Merged manifest should resolve AutoInitEnabled to true."
  pass "Merged manifest contains all required Meta metadata entries."

  generated_values="$(find_generated_values_file)"
  [ -n "$generated_values" ] || fail "Could not locate generated resource values for Meta SDK."

  app_id_value="$(xml_string_value "$generated_values" facebook_app_id)"
  token_value="$(xml_string_value "$generated_values" facebook_client_token)"
  auto_log_value="$(xml_bool_value "$generated_values" facebook_auto_log_app_events_enabled)"
  ad_id_value="$(xml_bool_value "$generated_values" facebook_advertiser_id_collection_enabled)"

  printf '%s' "$app_id_value" | grep -Eq '^[0-9]+$' ||
    fail "Generated Meta App ID is not numeric."
  [ "$app_id_value" != "123456789012345" ] || fail "Generated Meta App ID is the placeholder."
  printf '%s' "$app_id_value" | grep -Eq '^0+$' && fail "Generated Meta App ID is all zeroes."
  [ -n "$token_value" ] || fail "Generated Meta client token is missing."
  case "$(printf '%s' "$token_value" | tr '[:upper:]' '[:lower:]')" in
    *replace*|*placeholder*|*example*) fail "Generated Meta client token is a placeholder." ;;
  esac
  case "$auto_log_value" in true|false) ;; *) fail "Generated automatic-event flag is not true/false." ;; esac
  case "$ad_id_value" in true|false) ;; *) fail "Generated advertiser-ID flag is not true/false." ;; esac
  grep -Fq '@bool/facebook_auto_log_app_events_enabled' "$merged_manifest" ||
    fail "Merged manifest AutoLogAppEventsEnabled does not reference generated resource."
  grep -Fq '@bool/facebook_advertiser_id_collection_enabled' "$merged_manifest" ||
    fail "Merged manifest AdvertiserIDCollectionEnabled does not reference generated resource."
  pass "Generated Meta App ID/client token and boolean flags are valid."

  echo "Meta flags:"
  echo "  AutoInitEnabled=true"
  echo "  AutoLogAppEventsEnabled=$auto_log_value"
  echo "  AdvertiserIDCollectionEnabled=$ad_id_value"

  MANIFEST_FOR_PERMISSIONS="$merged_manifest"
  GENERATED_VALUES_FOR_OUTPUT="$generated_values"
}

verify_permissions() {
  local report
  local permissions
  report="$(find_manifest_report)"
  permissions="$(extract_permissions "$MANIFEST_FOR_PERMISSIONS")"

  echo "Merged $VARIANT manifest permissions:"
  if [ -n "$permissions" ]; then
    printf '%s\n' "$permissions" | sed 's/^/  /'
  else
    echo "  (none)"
  fi

  for permission in \
    'com.google.android.gms.permission.AD_ID' \
    'android.permission.ACCESS_ADSERVICES_ATTRIBUTION' \
    'android.permission.ACCESS_ADSERVICES_AD_ID' \
    'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE' \
    'android.permission.ACCESS_ADSERVICES_TOPICS'; do
    if printf '%s\n' "$permissions" | grep -Fxq "$permission"; then
      echo "Permission present: $permission"
      echo "  Source: $(permission_source "$permission" "$report")"
    else
      echo "Permission absent: $permission"
    fi
  done
}

dump_apk_manifest() {
  local apk_path="$1"
  local dump_path="$2"
  local apkanalyzer_bin="$3"
  local aapt_bin="$4"

  if [ -n "$apkanalyzer_bin" ] && [ -x "$apkanalyzer_bin" ]; then
    "$apkanalyzer_bin" manifest print "$apk_path" > "$dump_path"
    return 0
  fi

  if [ -n "$aapt_bin" ] && [ -x "$aapt_bin" ]; then
    "$aapt_bin" dump xmltree "$apk_path" AndroidManifest.xml > "$dump_path"
    return 0
  fi

  return 1
}

verify_apk_identity() {
  local apk_path="$1"
  local label="$2"
  local manifest_dump="$ROOT_DIR/dist/meta-sdk-${label}-apk-manifest.txt"
  local apkanalyzer_bin
  local aapt_bin
  local actual_app_id
  local actual_version_code
  local actual_version_name

  require_file "$apk_path"
  apkanalyzer_bin="$(find_android_tool apkanalyzer || true)"
  aapt_bin="$(find_android_tool aapt || true)"

  if [ -n "$apkanalyzer_bin" ] && [ -x "$apkanalyzer_bin" ]; then
    actual_app_id="$("$apkanalyzer_bin" manifest application-id "$apk_path")"
    actual_version_code="$("$apkanalyzer_bin" manifest version-code "$apk_path")"
    actual_version_name="$("$apkanalyzer_bin" manifest version-name "$apk_path")"
  elif [ -n "$aapt_bin" ] && [ -x "$aapt_bin" ]; then
    local badging_dump="$ROOT_DIR/dist/meta-sdk-${label}-apk-badging.txt"
    "$aapt_bin" dump badging "$apk_path" > "$badging_dump"
    local package_line
    package_line="$(sed -n "s/^package: //p" "$badging_dump" | head -n 1)"
    actual_app_id="$(printf '%s' "$package_line" | sed -nE "s/.*name='([^']+)'.*/\\1/p")"
    actual_version_code="$(printf '%s' "$package_line" | sed -nE "s/.*versionCode='([^']+)'.*/\\1/p")"
    actual_version_name="$(printf '%s' "$package_line" | sed -nE "s/.*versionName='([^']+)'.*/\\1/p")"
  else
    fail "Neither apkanalyzer nor aapt is available for APK identity verification."
  fi

  [ "$actual_app_id" = "$APP_ID" ] || fail "$label APK package is $actual_app_id, expected $APP_ID."
  [ "$actual_version_code" = "$VERSION_CODE" ] ||
    fail "$label APK versionCode is $actual_version_code, expected $VERSION_CODE."
  [ "$actual_version_name" = "$VERSION_NAME" ] ||
    fail "$label APK versionName is $actual_version_name, expected $VERSION_NAME."

  dump_apk_manifest "$apk_path" "$manifest_dump" "$apkanalyzer_bin" "$aapt_bin" ||
    fail "Could not dump $label APK manifest."
  grep -Fq 'com.facebook.sdk.ApplicationId' "$manifest_dump" ||
    fail "$label APK manifest is missing Meta ApplicationId metadata."
  grep -Fq 'com.facebook.sdk.ClientToken' "$manifest_dump" ||
    fail "$label APK manifest is missing Meta ClientToken metadata."

  if [ "$label" = "release" ]; then
    if grep -Eiq 'android:debuggable=("true"|true)|debuggable.*0xffffffff|debuggable.*true' "$manifest_dump"; then
      fail "Release APK is debuggable."
    fi
    pass "Release APK is non-debuggable."
  fi

  pass "$label APK package/version/Meta metadata verified."
}

verify_release_signatures() {
  local apksigner_bin

  apksigner_bin="$(find_android_tool apksigner || true)"
  [ -n "$apksigner_bin" ] && [ -x "$apksigner_bin" ] ||
    fail "apksigner is required to verify the release APK signature."
  "$apksigner_bin" verify --verbose "$APK_PATH" >/dev/null
  pass "Release APK signature verified with apksigner."

  require_tool jarsigner
  jarsigner -verify "$AAB_PATH" >/dev/null
  pass "Release AAB signature verified with jarsigner."
}

verify_aab_manifest() {
  local bundletool_bin
  local aab_manifest_dump="$ROOT_DIR/dist/meta-sdk-release-aab-manifest.txt"

  bundletool_bin="$(find_bundletool || true)"
  if [ -z "$bundletool_bin" ]; then
    warn "bundletool was not found; AAB base manifest inspection was not performed."
    return 0
  fi

  if [ -x "$bundletool_bin" ] && [ "${bundletool_bin%.jar}" = "$bundletool_bin" ]; then
    "$bundletool_bin" dump manifest --bundle "$AAB_PATH" --module base > "$aab_manifest_dump"
  else
    java -jar "$bundletool_bin" dump manifest --bundle "$AAB_PATH" --module base > "$aab_manifest_dump"
  fi

  grep -Fq "package=\"$APP_ID\"" "$aab_manifest_dump" ||
    fail "AAB base manifest package does not match $APP_ID."
  grep -Fq "android:versionCode=\"$VERSION_CODE\"" "$aab_manifest_dump" ||
    fail "AAB base manifest versionCode does not match $VERSION_CODE."
  grep -Fq "android:versionName=\"$VERSION_NAME\"" "$aab_manifest_dump" ||
    fail "AAB base manifest versionName does not match $VERSION_NAME."

  for metadata_name in \
    'com.facebook.sdk.ApplicationId' \
    'com.facebook.sdk.ClientToken' \
    'com.facebook.sdk.AutoInitEnabled' \
    'com.facebook.sdk.AutoLogAppEventsEnabled' \
    'com.facebook.sdk.AdvertiserIDCollectionEnabled'; do
    grep -Fq "$metadata_name" "$aab_manifest_dump" ||
      fail "AAB base manifest missing metadata: $metadata_name"
  done
  pass "AAB base manifest contains package/version and Meta metadata."
}

verify_release_outputs() {
  ensure_fresh_enough "$APK_PATH" "$APP_GRADLE" "$MAIN_ACTIVITY" "$ANDROID_DIR/app/src/main/AndroidManifest.xml"
  ensure_fresh_enough "$AAB_PATH" "$APP_GRADLE" "$MAIN_ACTIVITY" "$ANDROID_DIR/app/src/main/AndroidManifest.xml"
  ensure_fresh_enough "$MANIFEST_FOR_PERMISSIONS" "$APP_GRADLE" "$ANDROID_DIR/app/src/main/AndroidManifest.xml"
  ensure_fresh_enough "$GENERATED_VALUES_FOR_OUTPUT" "$APP_GRADLE" "$ANDROID_DIR/meta.properties"

  pass "Release APK and AAB outputs are present and not stale-looking."
  verify_apk_identity "$APK_PATH" "release"
  verify_release_signatures
  verify_aab_manifest
  verify_no_placeholder_in_artifact "$APK_PATH"
  verify_no_placeholder_in_artifact "$AAB_PATH"
  pass "Release artifacts do not contain placeholder Meta values."
}

verify_main_activity_logging() {
  grep -Fq 'ApplicationInfo.FLAG_DEBUGGABLE' "$MAIN_ACTIVITY" ||
    fail "MainActivity Meta diagnostics are not gated by the debuggable flag."
  grep -Fq 'LoggingBehavior.APP_EVENTS' "$MAIN_ACTIVITY" ||
    fail "MainActivity does not enable APP_EVENTS diagnostics in debug builds."
  if grep -RIn 'LoggingBehavior.REQUESTS' "$MAIN_ACTIVITY" "$ANDROID_DIR/app/src" >/dev/null 2>&1; then
    fail "REQUESTS logging must not be enabled."
  fi
  pass "Meta diagnostics are debug-gated and REQUESTS logging is absent."
}

verify_git_and_secret_checks() {
  local forbidden_diff_pattern
  local project_secret_pattern
  forbidden_diff_pattern='META_APP_SEC''RET|facebook_app_sec''ret|client_sec''ret|BEGIN (RSA |EC )?PRIVATE KEY|storePass''word|keyPass''word'
  project_secret_pattern='META_APP_SEC''RET|facebook_app_sec''ret|client_sec''ret[[:space:]]*[=:]'

  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if ! git check-ignore -q client/android/meta.properties; then
      fail "client/android/meta.properties is not ignored by Git."
    fi
    pass "client/android/meta.properties is ignored by Git."

    if git ls-files --error-unmatch client/android/meta.properties >/dev/null 2>&1; then
      fail "client/android/meta.properties is tracked. Remove it from Git."
    fi
    pass "client/android/meta.properties is not tracked."

    if git diff -- . ':!client/android/meta.properties' |
      grep -Eiq "$forbidden_diff_pattern"; then
      fail "Forbidden secret-like material found in tracked changes."
    fi
    pass "No forbidden secret-like material found in tracked changes."
  else
    warn "Not running in a Git worktree; ignored/tracked status and tracked diff checks cannot be proven."
  fi

  if grep -RInE "$project_secret_pattern" "$ANDROID_DIR" "$ROOT_DIR/client/src" "$ROOT_DIR/scripts" "$ROOT_DIR/launch-debug_apk.sh" >/dev/null 2>&1; then
    fail "Forbidden Meta server-secret-like setting found in project files."
  fi
  pass "No Meta server-secret-like project setting was introduced."
}

mkdir -p "$ROOT_DIR/dist"

require_tool grep
require_tool sed
require_tool awk
require_tool find
require_tool sort
require_file "$APP_GRADLE"
require_file "$ANDROID_DIR/gradlew"
require_file "$JAVA_HELPER"

# shellcheck source=scripts/lib/java21.sh
. "$JAVA_HELPER"
require_java21

cd "$ROOT_DIR"

APP_ID="$(parse_gradle_value 's/^[[:space:]]*applicationId[[:space:]]+"([^"]+)".*/\1/p' applicationId)"
VERSION_CODE="$(parse_gradle_value 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' versionCode)"
VERSION_NAME="$(parse_gradle_value 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/p' versionName)"

[ "$APP_ID" = "com.goodone.marketplace" ] ||
  fail "applicationId is $APP_ID, expected com.goodone.marketplace."

verify_git_and_secret_checks

grep -Fq "implementation 'com.facebook.android:facebook-core:18.2.3'" "$APP_GRADLE" ||
  fail "Exact facebook-core 18.2.3 dependency is missing from app/build.gradle."
pass "Exact facebook-core 18.2.3 dependency is declared."

if grep -RInE 'facebook-android-sdk|latest\.release' "$ANDROID_DIR/app" "$ANDROID_DIR/build.gradle" >/dev/null 2>&1; then
  fail "Rejected dependency pattern found: facebook-android-sdk or latest.release."
fi
pass "Umbrella facebook-android-sdk and latest.release are absent."

run_gradle_checks
verify_manifest_and_values
verify_permissions
verify_apk_identity "$APK_PATH" "$VARIANT"

if [ "$VARIANT" = "release" ]; then
  verify_release_outputs
fi

verify_main_activity_logging
scan_reports_for_token "$(get_configured_client_token)"
pass "Generated text reports checked for complete Meta client token leakage."

cat <<EOF

Meta SDK Android verification passed.
Variant: $VARIANT
Dependency: com.facebook.android:facebook-core:18.2.3
Package: $APP_ID
versionCode: $VERSION_CODE
versionName: $VERSION_NAME
APK: $APK_PATH
Merged manifest: $MANIFEST_FOR_PERMISSIONS
Generated values: $GENERATED_VALUES_FOR_OUTPUT
EOF

if [ "$VARIANT" = "release" ]; then
  echo "AAB: $AAB_PATH"
fi
