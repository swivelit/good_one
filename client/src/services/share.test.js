import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import toast from 'react-hot-toast';
import { buildPublicUrl } from '../config';
import {
  buildProductShareData,
  buildVendorShareData,
  sharePayload,
} from './share';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
    isPluginAvailable: jest.fn(() => false),
  },
}));

jest.mock('@capacitor/share', () => ({
  Share: {
    share: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const setNavigatorMocks = ({ share, clipboard } = {}) => {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Capacitor.isNativePlatform.mockReturnValue(false);
  Capacitor.isPluginAvailable.mockReturnValue(false);
  setNavigatorMocks();
});

test('buildPublicUrl always uses the public web host', () => {
  expect(buildPublicUrl('/products/product-1')).toBe('https://good-one-jlcu.onrender.com/products/product-1');
  expect(buildPublicUrl('#/vendors/vendor-1')).toBe('https://good-one-jlcu.onrender.com/vendors/vendor-1');
  expect(buildPublicUrl('capacitor://localhost/#/products/product-2')).toBe('https://good-one-jlcu.onrender.com/products/product-2');
  expect(buildPublicUrl('http://localhost:3000/#/vendors/vendor-2')).toBe('https://good-one-jlcu.onrender.com/vendors/vendor-2');
});

test('PUBLIC_WEB_URL falls back when the env value is a local origin', () => {
  const originalPublicWebUrl = process.env.REACT_APP_PUBLIC_WEB_URL;

  jest.isolateModules(() => {
    process.env.REACT_APP_PUBLIC_WEB_URL = 'http://localhost:3000';
    const isolatedConfig = require('../config');
    expect(isolatedConfig.PUBLIC_WEB_URL).toBe('https://good-one-jlcu.onrender.com');
    expect(isolatedConfig.buildPublicUrl('/products/product-3')).toBe('https://good-one-jlcu.onrender.com/products/product-3');
  });

  if (originalPublicWebUrl === undefined) {
    delete process.env.REACT_APP_PUBLIC_WEB_URL;
  } else {
    process.env.REACT_APP_PUBLIC_WEB_URL = originalPublicWebUrl;
  }
});

test('buildProductShareData includes title, price, and public product URL', () => {
  const shareData = buildProductShareData({
    _id: 'product-1',
    title: 'Desk lamp',
    price: 1499,
  });

  expect(shareData).toMatchObject({
    title: 'GoodOne: Desk lamp',
    url: 'https://good-one-jlcu.onrender.com/products/product-1',
    dialogTitle: 'Share product',
  });
  expect(shareData.text).toContain('Desk lamp');
  expect(shareData.text).toContain('Price: ₹1,499');
  // The URL is delivered via the `url` field only, never inside `text`.
  expect(shareData.text).not.toContain('https://good-one-jlcu.onrender.com/products/product-1');
});

test('buildVendorShareData includes business name and public vendor URL', () => {
  const shareData = buildVendorShareData({
    id: 'vendor-1',
    businessName: 'Fresh Finds',
  });

  expect(shareData).toMatchObject({
    title: 'Fresh Finds',
    url: 'https://good-one-jlcu.onrender.com/vendors/vendor-1',
    dialogTitle: 'Share vendor profile',
  });
  expect(shareData.text).toContain('Fresh Finds on GoodOne');
  // The URL is delivered via the `url` field only, never inside `text`.
  expect(shareData.text).not.toContain('https://good-one-jlcu.onrender.com/vendors/vendor-1');
});

test('product share data carries the URL exactly once (no duplicate link in WhatsApp)', () => {
  const shareData = buildProductShareData({ _id: 'product-1', title: 'Desk lamp', price: 1499 });

  // `text` must not contain the URL; the link only lives in `url`.
  expect(shareData.url).toBe('https://good-one-jlcu.onrender.com/products/product-1');
  expect(shareData.text).not.toContain(shareData.url);

  // A share target that joins text + url sees the link a single time.
  const combined = `${shareData.text}\n${shareData.url}`;
  expect(combined.match(/good-one-jlcu\.onrender\.com\/products\/product-1/g)).toHaveLength(1);
});

test('vendor share data carries the URL exactly once (no duplicate link in WhatsApp)', () => {
  const shareData = buildVendorShareData({ id: 'vendor-1', businessName: 'Fresh Finds' });

  expect(shareData.url).toBe('https://good-one-jlcu.onrender.com/vendors/vendor-1');
  expect(shareData.text).not.toContain(shareData.url);

  const combined = `${shareData.text}\n${shareData.url}`;
  expect(combined.match(/good-one-jlcu\.onrender\.com\/vendors\/vendor-1/g)).toHaveLength(1);
});

test('sharePayload uses Capacitor Share on native platforms', async () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  Capacitor.isPluginAvailable.mockReturnValue(true);
  const webShare = jest.fn(() => Promise.resolve());
  setNavigatorMocks({ share: webShare });

  await expect(sharePayload({ title: 'Item', text: 'Item', url: 'https://example.test/item' })).resolves.toBe(true);

  expect(Share.share).toHaveBeenCalledWith({
    title: 'Item',
    text: 'Item',
    url: 'https://example.test/item',
  });
  expect(webShare).not.toHaveBeenCalled();
});

test('sharePayload falls back to navigator.share when native share is unavailable', async () => {
  const webShare = jest.fn(() => Promise.resolve());
  setNavigatorMocks({ share: webShare });

  await expect(sharePayload({ title: 'Item', text: 'Item text', url: 'https://example.test/item' })).resolves.toBe(true);

  expect(Share.share).not.toHaveBeenCalled();
  expect(webShare).toHaveBeenCalledWith({
    title: 'Item',
    text: 'Item text',
    url: 'https://example.test/item',
  });
});

test('sharePayload copies the URL when native and web share are unavailable', async () => {
  const writeText = jest.fn(() => Promise.resolve());
  setNavigatorMocks({ clipboard: { writeText } });

  await expect(sharePayload({ title: 'Item', text: 'Item text', url: 'https://example.test/item' })).resolves.toBe(true);

  expect(writeText).toHaveBeenCalledWith('https://example.test/item');
  expect(toast.success).toHaveBeenCalledWith('Share link copied');
});
