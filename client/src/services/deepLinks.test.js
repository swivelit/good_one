import {
  getAllowedAppLinkHosts,
  isSupportedDeepLinkPath,
  parseAppLinkUrl,
} from './deepLinks';

test('getAllowedAppLinkHosts includes the production share domain', () => {
  expect(getAllowedAppLinkHosts()).toContain('good-one-jlcu.onrender.com');
});

test('parseAppLinkUrl accepts valid product links', () => {
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/products/product-1')).toBe('/products/product-1');
});

test('parseAppLinkUrl accepts valid vendor links', () => {
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/vendors/vendor-1')).toBe('/vendors/vendor-1');
});

test('parseAppLinkUrl normalizes trailing slashes', () => {
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/products/product-1/')).toBe('/products/product-1');
});

test('parseAppLinkUrl ignores query strings for product and vendor routes', () => {
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/products/product-1?utm_source=share')).toBe('/products/product-1');
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/vendors/vendor-1?ref=chat')).toBe('/vendors/vendor-1');
});

test('parseAppLinkUrl rejects unknown domains', () => {
  expect(parseAppLinkUrl('https://example.com/products/product-1')).toBeNull();
});

test('parseAppLinkUrl rejects localhost and native local origins', () => {
  expect(parseAppLinkUrl('http://localhost:3000/products/product-1')).toBeNull();
  expect(parseAppLinkUrl('https://localhost/products/product-1')).toBeNull();
  expect(parseAppLinkUrl('capacitor://localhost/#/products/product-1')).toBeNull();
  expect(parseAppLinkUrl('ionic://localhost/#/vendors/vendor-1')).toBeNull();
});

test('parseAppLinkUrl rejects unsupported paths', () => {
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/privacy')).toBeNull();
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/products/product-1/reviews')).toBeNull();
  expect(parseAppLinkUrl('https://good-one-jlcu.onrender.com/products')).toBeNull();
});

test('parseAppLinkUrl rejects invalid and unsafe URL values', () => {
  expect(parseAppLinkUrl('')).toBeNull();
  expect(parseAppLinkUrl('not a url')).toBeNull();
  expect(parseAppLinkUrl('javascript:alert(1)')).toBeNull();
});

test('isSupportedDeepLinkPath accepts only product and vendor detail paths', () => {
  expect(isSupportedDeepLinkPath('/products/product-1')).toBe(true);
  expect(isSupportedDeepLinkPath('/vendors/vendor-1/')).toBe(true);
  expect(isSupportedDeepLinkPath('/products/product-1?utm_source=share')).toBe(true);
  expect(isSupportedDeepLinkPath('/privacy')).toBe(false);
  expect(isSupportedDeepLinkPath('javascript:alert(1)')).toBe(false);
});
