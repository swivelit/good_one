import { Capacitor } from '@capacitor/core';

// Web-side "Open in app" handoff.
//
// Android App Links normally open the installed app automatically, but WhatsApp's
// in-app browser (and a few others) bypass that flow, so a shared https link only
// ever opens the website. To recover the native experience we fire an Android
// `intent://` URL that explicitly targets the app package. If the app is not
// installed, Chrome/WebView honours `S.browser_fallback_url` and keeps the user on
// the web page (or sends them to the Play Store), so there is no dead end.

const APP_LINK_HOST = 'good-one-jlcu.onrender.com';
const ANDROID_PACKAGE = 'com.goodone.marketplace';

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

const SESSION_FLAG_PREFIX = 'goodone:open-in-app:';

// In-memory guard. Protects against React's double-invoked effects (StrictMode)
// and against environments where sessionStorage is unavailable.
const attemptedPaths = new Set();

const isNativePlatform = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const isAndroidWeb = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

// Only allow site-relative, single-slash paths so we can never build an intent
// that points at a different origin.
const sanitizePath = (path) => {
  const value = String(path || '').trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

const readSessionFlag = (key) => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeSessionFlag = (key) => {
  try {
    window.sessionStorage?.setItem(key, '1');
  } catch {
    // Private mode / disabled storage. The in-memory guard still applies for
    // this page load, which is enough to avoid a same-tick double fire.
  }
};

/**
 * Returns true when an "Open in app" handoff makes sense for the current
 * environment (web, not native, Android user agent). Pages use this to decide
 * whether to render the manual fallback button.
 */
export const canOpenInApp = () =>
  !isNativePlatform() && typeof window !== 'undefined' && isAndroidWeb();

/**
 * Attempt to open the installed Android app at the given site-relative path.
 *
 * @param {string} path - e.g. `/products/123` or `/vendors/456`.
 * @param {object} [options]
 * @param {string} [options.fallbackUrl] - Where to send users when the app is not
 *   installed. Defaults to the canonical web URL for `path`; pass `PLAY_STORE_URL`
 *   to route them to the store listing instead.
 * @param {boolean} [options.force] - Bypass the once-per-page-load guard. Used by
 *   the manual "Open in the GoodOne app" button so a deliberate tap always retries.
 * @returns {boolean} true if a handoff was triggered, false otherwise.
 */
export function attemptOpenInApp(path, { fallbackUrl, force = false } = {}) {
  // Native already routes deep links via AppLinkListener — do nothing.
  if (isNativePlatform()) return false;
  if (typeof window === 'undefined') return false;
  if (!isAndroidWeb()) return false;

  const safePath = sanitizePath(path);
  if (!safePath) return false;

  const flagKey = `${SESSION_FLAG_PREFIX}${safePath}`;

  // Redirect-loop guard: if the app is not installed, Chrome loads
  // browser_fallback_url (often this same page), which would re-mount the
  // component and fire again. The sessionStorage flag survives that reload and
  // breaks the loop. A forced (user-initiated) tap ignores the guard.
  if (!force && (attemptedPaths.has(safePath) || readSessionFlag(flagKey))) {
    return false;
  }

  // Mark as attempted *before* navigating so the flag is already persisted by
  // the time any fallback reload happens.
  attemptedPaths.add(safePath);
  writeSessionFlag(flagKey);

  const webUrl = `https://${APP_LINK_HOST}${safePath}`;
  const resolvedFallback = fallbackUrl || webUrl;
  const intentUrl =
    `intent://${APP_LINK_HOST}${safePath}#Intent;scheme=https;` +
    `package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(resolvedFallback)};end`;

  try {
    window.location.href = intentUrl;
    return true;
  } catch {
    // Some embedded browsers reject the intent scheme outright; fall back to the
    // configured URL so the user still lands somewhere sensible.
    try {
      window.location.href = resolvedFallback;
    } catch {
      /* nothing else we can do */
    }
    return false;
  }
}

export default attemptOpenInApp;
