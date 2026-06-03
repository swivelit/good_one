import { Capacitor } from '@capacitor/core';
import { attemptOpenInApp, canOpenInApp, PLAY_STORE_URL } from './openInApp';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
  },
}));

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

const setUserAgent = (ua) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  });
};

const originalLocation = window.location;

beforeEach(() => {
  jest.clearAllMocks();
  Capacitor.isNativePlatform.mockReturnValue(false);
  window.sessionStorage.clear();
  // Replace location with a writable stub so we can observe href assignments
  // without jsdom attempting a real navigation.
  delete window.location;
  window.location = { href: '' };
  setUserAgent(ANDROID_UA);
});

afterEach(() => {
  window.location = originalLocation;
});

test('builds an Android intent URL with the web page as the default fallback', () => {
  const result = attemptOpenInApp('/products/abc');

  const expectedFallback = encodeURIComponent('https://good-one-jlcu.onrender.com/products/abc');
  expect(result).toBe(true);
  expect(window.location.href).toBe(
    `intent://good-one-jlcu.onrender.com/products/abc#Intent;scheme=https;` +
      `package=com.goodone.marketplace;` +
      `S.browser_fallback_url=${expectedFallback};end`,
  );
});

test('uses a configurable fallback (e.g. the Play Store listing)', () => {
  attemptOpenInApp('/vendors/v1', { fallbackUrl: PLAY_STORE_URL });

  expect(window.location.href).toContain(
    `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};`,
  );
  expect(window.location.href).toContain('intent://good-one-jlcu.onrender.com/vendors/v1#');
});

test('only attempts the handoff once per page load (redirect-loop guard)', () => {
  expect(attemptOpenInApp('/products/loop')).toBe(true);
  expect(window.sessionStorage.getItem('goodone:open-in-app:/products/loop')).toBe('1');

  window.location.href = '';
  // Second mount for the same path (e.g. after the fallback reload) must no-op.
  expect(attemptOpenInApp('/products/loop')).toBe(false);
  expect(window.location.href).toBe('');
});

test('a forced (user-initiated) call re-fires even after the guard is set', () => {
  expect(attemptOpenInApp('/products/force')).toBe(true);
  window.location.href = '';

  expect(attemptOpenInApp('/products/force', { force: true })).toBe(true);
  expect(window.location.href).toContain('intent://good-one-jlcu.onrender.com/products/force#');
});

test('does nothing on non-Android web', () => {
  setUserAgent(IPHONE_UA);
  expect(attemptOpenInApp('/products/ios')).toBe(false);
  expect(window.location.href).toBe('');
});

test('does nothing inside the native app', () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  expect(attemptOpenInApp('/products/native')).toBe(false);
  expect(window.location.href).toBe('');
});

test('rejects unsafe or non-relative paths', () => {
  expect(attemptOpenInApp('//evil.example.com')).toBe(false);
  expect(attemptOpenInApp('products/no-leading-slash')).toBe(false);
  expect(attemptOpenInApp('')).toBe(false);
  expect(window.location.href).toBe('');
});

test('canOpenInApp reflects platform and user agent', () => {
  setUserAgent(ANDROID_UA);
  expect(canOpenInApp()).toBe(true);

  setUserAgent(IPHONE_UA);
  expect(canOpenInApp()).toBe(false);

  setUserAgent(ANDROID_UA);
  Capacitor.isNativePlatform.mockReturnValue(true);
  expect(canOpenInApp()).toBe(false);
});
