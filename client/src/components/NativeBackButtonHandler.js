import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { requestTopOverlayDismiss } from '../services/nativeBackDismiss';

const ROOT_PATHS = new Set(['/', '/browse', '/dashboard']);

export const isSafeInternalPath = (path) => {
  if (typeof path !== 'string') return false;

  const value = path.trim();
  if (!value || !value.startsWith('/') || value.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;

  try {
    const parsed = new URL(value, 'https://goodone.local');
    return parsed.origin === 'https://goodone.local' && parsed.pathname.startsWith('/');
  } catch {
    return false;
  }
};

export const getNativeBackTarget = ({
  pathname = '/',
  state = null,
  canGoBack = false,
  historyLength = 0,
  userRole = null,
} = {}) => {
  const safeFrom = isSafeInternalPath(state?.from) ? state.from.trim() : null;

  if (pathname.startsWith('/products/')) {
    return {
      action: 'navigate',
      to: safeFrom || '/browse',
      replace: true,
    };
  }

  if (pathname.startsWith('/vendors/')) {
    return {
      action: 'navigate',
      to: safeFrom || '/browse',
      replace: true,
    };
  }

  if (ROOT_PATHS.has(pathname)) {
    return { action: 'minimize' };
  }

  if (canGoBack || historyLength > 1) {
    return { action: 'back' };
  }

  return {
    action: 'navigate',
    to: userRole === 'vendor' || pathname.startsWith('/dashboard') ? '/dashboard' : '/browse',
    replace: true,
  };
};

const isNativeAndroid = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

export default function NativeBackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const locationRef = useRef(location);
  const userRoleRef = useRef(user?.role);

  locationRef.current = location;
  userRoleRef.current = user?.role;

  useEffect(() => {
    if (!isNativeAndroid()) return undefined;

    let listenerHandle = null;
    let cleanupRequested = false;

    const handleBackButton = (event = {}) => {
      if (requestTopOverlayDismiss()) return;

      const currentLocation = locationRef.current;
      const target = getNativeBackTarget({
        pathname: currentLocation.pathname,
        state: currentLocation.state,
        canGoBack: Boolean(event.canGoBack),
        historyLength: window.history?.length || 0,
        userRole: userRoleRef.current,
      });

      if (target.action === 'minimize') {
        const result = App.minimizeApp?.();
        if (result?.catch) {
          result.catch((error) => console.warn('Unable to minimize app', error));
        }
        return;
      }

      if (target.action === 'back') {
        navigate(-1);
        return;
      }

      navigate(target.to, { replace: target.replace !== false });
    };

    const registerBackButtonListener = async () => {
      try {
        listenerHandle = await App.addListener('backButton', handleBackButton);
        if (cleanupRequested) {
          await listenerHandle?.remove?.();
        }
      } catch (error) {
        console.warn('Unable to register native back button handler', error);
      }
    };

    void registerBackButtonListener();

    return () => {
      cleanupRequested = true;
      if (listenerHandle?.remove) {
        void listenerHandle.remove();
      }
    };
  }, [navigate]);

  return null;
}
