import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { appConfigAPI } from '../api';

const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.goodone.marketplace';

const isNativeAndroid = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

const getVersionCode = async () => {
  let versionCode = process.env.REACT_APP_ANDROID_VERSION_CODE || '';

  try {
    const appInfo = await App.getInfo();
    if (appInfo?.build) {
      versionCode = appInfo.build;
    }
  } catch (error) {
    console.warn('Unable to read native app info for update check', error);
  }

  return versionCode;
};

const openPlayStore = (playStoreUrl) => {
  try {
    const openedWindow = window.open(playStoreUrl, '_system');
    if (openedWindow) return;
  } catch (error) {
    console.warn('Unable to open Play Store with window.open', error);
  }

  window.location.href = playStoreUrl;
};

export default function ForceUpdateGate() {
  const [updatePayload, setUpdatePayload] = useState(null);

  useEffect(() => {
    if (!isNativeAndroid()) return undefined;

    let isMounted = true;
    const showUpdateRequired = (payload = {}) => {
      if (!isMounted) return;
      setUpdatePayload({
        playStoreUrl: payload.playStoreUrl || DEFAULT_PLAY_STORE_URL,
      });
    };

    const handleUpdateRequired = (event) => {
      showUpdateRequired(event.detail);
    };

    window.addEventListener('goodone:update-required', handleUpdateRequired);

    const checkAppConfig = async () => {
      const versionCode = await getVersionCode();

      try {
        const { data } = await appConfigAPI.get({
          platform: 'android',
          ...(versionCode ? { versionCode } : {}),
        });

        if (data?.android?.updateRequired) {
          showUpdateRequired(data);
        }
      } catch (error) {
        if (error?.response?.status === 426 && error?.response?.data?.code === 'UPDATE_REQUIRED') {
          showUpdateRequired(error.response.data);
          return;
        }

        console.warn('Unable to load app update config', error);
      }
    };

    void checkAppConfig();

    return () => {
      isMounted = false;
      window.removeEventListener('goodone:update-required', handleUpdateRequired);
    };
  }, []);

  if (!isNativeAndroid() || !updatePayload) return null;

  const playStoreUrl = updatePayload.playStoreUrl || DEFAULT_PLAY_STORE_URL;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'rgba(17, 24, 39, 0.92)',
      }}
    >
      <div
        style={{
          width: 'min(100%, 420px)',
          borderRadius: 8,
          background: '#fff',
          color: '#111827',
          padding: 24,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
          textAlign: 'center',
        }}
      >
        <h1 id="force-update-title" style={{ fontSize: 24, margin: '0 0 12px' }}>
          Update required
        </h1>
        <p style={{ margin: '0 0 20px', color: '#4b5563' }}>
          A newer version of GoodOne is required to continue.
        </p>
        <button
          type="button"
          className="btn btn-primary-custom w-100"
          onClick={() => openPlayStore(playStoreUrl)}
        >
          Update now
        </button>
      </div>
    </div>
  );
}
