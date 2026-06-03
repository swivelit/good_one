import { PUBLIC_WEB_URL } from '../config';

const DEFAULT_APP_LINK_HOST = 'good-one-jlcu.onrender.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

const normalizeHostname = (hostname) => String(hostname || '').trim().toLowerCase();

const isLocalHostname = (hostname) => LOCAL_HOSTS.has(normalizeHostname(hostname));

const getRouteFromPathname = (pathname) => {
  const normalizedPath = String(pathname || '').replace(/\/+$/, '') || '/';
  const match = normalizedPath.match(/^\/(products|vendors)\/([^/]+)$/);

  if (!match) return null;

  const [, type, id] = match;
  if (!id || /%2f/i.test(id)) return null;

  return `/${type}/${id}`;
};

export const getAllowedAppLinkHosts = (publicWebUrl = PUBLIC_WEB_URL) => {
  const hosts = new Set([DEFAULT_APP_LINK_HOST]);

  try {
    const parsed = new URL(publicWebUrl);
    const hostname = normalizeHostname(parsed.hostname);

    if (parsed.protocol === 'https:' && hostname && !isLocalHostname(hostname)) {
      hosts.add(hostname);
    }
  } catch {
    // Keep the production app-link host even when env config is malformed.
  }

  return Array.from(hosts);
};

export const isSupportedDeepLinkPath = (path) => {
  if (typeof path !== 'string') return false;

  const value = path.trim();
  if (!value || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return false;

  try {
    const parsed = new URL(value, `https://${DEFAULT_APP_LINK_HOST}`);
    return parsed.origin === `https://${DEFAULT_APP_LINK_HOST}` && Boolean(getRouteFromPathname(parsed.pathname));
  } catch {
    return false;
  }
};

export const parseAppLinkUrl = (url) => {
  if (typeof url !== 'string') return null;

  const value = url.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    const hostname = normalizeHostname(parsed.hostname);

    if (
      parsed.protocol !== 'https:' ||
      isLocalHostname(hostname) ||
      !getAllowedAppLinkHosts().includes(hostname)
    ) {
      return null;
    }

    return getRouteFromPathname(parsed.pathname);
  } catch {
    return null;
  }
};
