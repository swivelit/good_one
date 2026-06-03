import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { parseAppLinkUrl } from '../services/deepLinks';

const isNativePlatform = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export default function AppLinkListener() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!isNativePlatform()) return undefined;

    let listenerHandle = null;
    let cleanupRequested = false;

    const openSupportedUrl = (url) => {
      const route = parseAppLinkUrl(url);
      if (!route) return;

      navigateRef.current(route);
      console.info('[GoodOne] Deep link opened:', route);
    };

    const registerAppLinks = async () => {
      try {
        const launchUrl = await CapacitorApp.getLaunchUrl?.();
        openSupportedUrl(launchUrl?.url);
      } catch (error) {
        console.warn('Unable to read native launch URL', error);
      }

      try {
        listenerHandle = await CapacitorApp.addListener('appUrlOpen', (event) => {
          openSupportedUrl(event?.url);
        });

        if (cleanupRequested) {
          await listenerHandle?.remove?.();
        }
      } catch (error) {
        console.warn('Unable to register native app-link listener', error);
      }
    };

    void registerAppLinks();

    return () => {
      cleanupRequested = true;
      if (listenerHandle?.remove) {
        void listenerHandle.remove();
      }
    };
  }, []);

  return null;
}
