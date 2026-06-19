#!/usr/bin/env bash

java21_fail() {
  echo "ERROR: $*" >&2
  exit 1
}

java21_major_version() {
  local java_bin="$1"
  local version

  version="$("$java_bin" -version 2>&1 | sed -nE 's/.* version "([^"]+)".*/\1/p' | head -n 1)"
  [ -n "$version" ] || return 1

  case "$version" in
    1.*) printf '%s' "$(printf '%s' "$version" | cut -d. -f2)" ;;
    *) printf '%s' "$(printf '%s' "$version" | sed -E 's/^([0-9]+).*/\1/')" ;;
  esac
}

java21_use_home() {
  local java_home="$1"
  local java_bin="$java_home/bin/java"
  local major

  [ -x "$java_bin" ] || return 1
  major="$(java21_major_version "$java_bin")" || return 1
  [ "$major" = "21" ] || return 1

  export JAVA_HOME="$java_home"
  export PATH="$JAVA_HOME/bin:$PATH"
  echo "Using Java 21: $JAVA_HOME"
}

java21_use_bin() {
  local java_bin="$1"
  local major
  local java_dir

  [ -x "$java_bin" ] || return 1
  major="$(java21_major_version "$java_bin")" || return 1
  [ "$major" = "21" ] || return 1

  java_dir="$(cd "$(dirname "$java_bin")" && pwd)"
  export PATH="$java_dir:$PATH"
  echo "Using Java 21: $java_bin"
}

require_java21() {
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local mac_java_home
    mac_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [ -n "$mac_java_home" ] && java21_use_home "$mac_java_home"; then
      return 0
    fi
  fi

  if [ -n "${JAVA_HOME:-}" ] && java21_use_home "$JAVA_HOME"; then
    return 0
  fi

  local candidate_home
  for candidate_home in \
    /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /usr/local/Cellar/openjdk@21/*/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/Cellar/openjdk@21/*/libexec/openjdk.jdk/Contents/Home; do
    if [ -d "$candidate_home" ] && java21_use_home "$candidate_home"; then
      return 0
    fi
  done

  if command -v java >/dev/null 2>&1 && java21_use_bin "$(command -v java)"; then
    return 0
  fi

  java21_fail "JDK 21 is required for Capacitor Android builds. Install JDK 21 and set JAVA_HOME, or make java on PATH resolve to Java 21."
}
