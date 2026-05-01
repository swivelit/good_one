import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

const INTRO_TIMEOUT_MS = 4000;
const POPUP_DELAY_MS = 120000;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const VIDEO_SRC = `${PUBLIC_URL}/media/goodone-intro.mp4`;

export default function AppVideoManager() {
  const isNative = Capacitor.isNativePlatform();
  const [showSplash, setShowSplash] = useState(isNative);
  const [showFloating, setShowFloating] = useState(false);
  const splashTimerRef = useRef(null);
  const popupTimerRef = useRef(null);

  const clearPopupTimer = useCallback(() => {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  const hideSplash = useCallback(() => {
    if (splashTimerRef.current) {
      clearTimeout(splashTimerRef.current);
      splashTimerRef.current = null;
    }
    setShowSplash(false);
  }, []);

  const scheduleFloatingPopup = useCallback(() => {
    clearPopupTimer();
    if (!isNative || showSplash || showFloating) return;
    if (document.visibilityState !== "visible") return;

    popupTimerRef.current = setTimeout(() => {
      popupTimerRef.current = null;
      if (document.visibilityState === "visible") {
        setShowFloating(true);
      }
    }, POPUP_DELAY_MS);
  }, [clearPopupTimer, isNative, showFloating, showSplash]);

  useEffect(() => {
    if (!isNative) return undefined;

    splashTimerRef.current = setTimeout(hideSplash, INTRO_TIMEOUT_MS);

    return () => {
      if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    };
  }, [hideSplash, isNative]);

  useEffect(() => {
    if (!isNative || showSplash || showFloating) return undefined;

    scheduleFloatingPopup();
    return clearPopupTimer;
  }, [clearPopupTimer, isNative, scheduleFloatingPopup, showFloating, showSplash]);

  useEffect(() => {
    if (!isNative) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearPopupTimer();
        setShowFloating(false);
        return;
      }

      if (!showSplash && !showFloating) {
        scheduleFloatingPopup();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearPopupTimer();
    };
  }, [clearPopupTimer, isNative, scheduleFloatingPopup, showFloating, showSplash]);

  if (!isNative) return null;

  return (
    <>
      {showSplash && (
        <div className="app-video-splash" role="presentation">
          <video
            src={VIDEO_SRC}
            autoPlay
            muted
            playsInline
            onEnded={hideSplash}
            onError={hideSplash}
          />
        </div>
      )}

      {!showSplash && showFloating && (
        <div className="floating-video-widget">
          <button
            type="button"
            className="floating-video-close"
            aria-label="Close video"
            onClick={() => setShowFloating(false)}
          >
            <i className="bi bi-x"></i>
          </button>
          <video src={VIDEO_SRC} autoPlay muted playsInline loop />
        </div>
      )}
    </>
  );
}
