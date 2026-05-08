import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  getAdMobBannerStatus,
  removeAdMobBanner,
  showAdMobBanner,
} from "../services/admob";

const POPUP_REPEAT_INTERVAL_MS = 20000;
const LOCAL_VIDEO_DURATION_MS = 10000;
const INTRO_TIMEOUT_MS = LOCAL_VIDEO_DURATION_MS;
const GOOGLE_AD_DURATION_MS = POPUP_REPEAT_INTERVAL_MS - LOCAL_VIDEO_DURATION_MS;
const POSITION_KEY = "goodone_floating_video_position";
const EDGE_GAP = 12;
const DEFAULT_BOTTOM_AD_RESERVED_PX = 50;
const DRAG_THRESHOLD_PX = 7;
const ADMOB_BANNER_HEIGHT_CSS_VARIABLE = "--goodone-admob-banner-height";
const NATIVE_BOTTOM_NAV_HEIGHT_CSS_VARIABLE = "--goodone-native-bottom-nav-height";
const ADMOB_LAYOUT_EVENT = "goodone:admob-banner-layout-change";
const VIDEO_SRC = "/media/goodone-intro.mp4";

const getWindowSize = () => ({
  width: window.visualViewport?.width || window.innerWidth,
  height: window.visualViewport?.height || window.innerHeight,
});

const getSafeAreaInsets = () => {
  if (typeof document === "undefined") return { top: 0, right: 0, bottom: 0, left: 0 };

  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "visibility:hidden",
    "pointer-events:none",
    "padding-top:env(safe-area-inset-top)",
    "padding-right:env(safe-area-inset-right)",
    "padding-bottom:env(safe-area-inset-bottom)",
    "padding-left:env(safe-area-inset-left)",
  ].join(";");
  document.body.appendChild(probe);
  const styles = window.getComputedStyle(probe);
  const insets = {
    top: parseFloat(styles.paddingTop) || 0,
    right: parseFloat(styles.paddingRight) || 0,
    bottom: parseFloat(styles.paddingBottom) || 0,
    left: parseFloat(styles.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
};

const getCssPixelValue = (name, fallback = 0) => {
  if (typeof document === "undefined") return fallback;

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
  const numericValue = parseFloat(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
};

const setRootCssPixelValue = (name, value) => {
  if (typeof document === "undefined") return;

  const numericValue = Math.max(0, Math.ceil(Number(value) || 0));
  document.documentElement.style.setProperty(name, `${numericValue}px`);
};

const getAdMobBannerReservedHeight = () => (
  getCssPixelValue(ADMOB_BANNER_HEIGHT_CSS_VARIABLE, DEFAULT_BOTTOM_AD_RESERVED_PX)
);

const getNativeBottomNavHeight = () => {
  if (typeof document === "undefined") return 0;

  const bottomNav = document.querySelector(".native-bottom-nav");
  const bottomNavHeight = bottomNav?.getBoundingClientRect?.().height;
  return Number.isFinite(bottomNavHeight) && bottomNavHeight > 0 ? bottomNavHeight : 0;
};

const syncNativeBottomNavHeightCssVariable = () => {
  const bottomNavHeight = getNativeBottomNavHeight();
  setRootCssPixelValue(NATIVE_BOTTOM_NAV_HEIGHT_CSS_VARIABLE, bottomNavHeight);
  return bottomNavHeight;
};

const getNativeBottomNavGap = () => (
  getCssPixelValue("--goodone-native-bottom-nav-gap", 0)
);

const getNativeBottomChromeReservedHeight = () => (
  getAdMobBannerReservedHeight() + getNativeBottomNavGap() + getNativeBottomNavHeight()
);

export default function AppVideoManager() {
  const isNative = Capacitor.isNativePlatform();
  const [showSplash, setShowSplash] = useState(isNative);
  const [showFloating, setShowFloating] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const splashTimerRef = useRef(null);
  const cycleTimerRef = useRef(null);
  const showAdMobPhaseRef = useRef(() => {});
  const showLocalVideoPhaseRef = useRef(() => {});
  const isAdMobBannerVisibleRef = useRef(false);
  const adMobBannerRequestIdRef = useRef(0);
  const widgetRef = useRef(null);
  const floatingVideoRef = useRef(null);
  const dragRef = useRef(null);

  const getWidgetSize = useCallback(() => {
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect?.width && rect?.height) {
      return { width: rect.width, height: rect.height };
    }

    const { width } = getWindowSize();
    const widgetWidth = Math.min(Math.max(width * 0.18, 64), 110);
    return { width: widgetWidth, height: widgetWidth * (16 / 9) };
  }, []);

  const clampPosition = useCallback((position) => {
    const { width: viewportWidth, height: viewportHeight } = getWindowSize();
    const { width, height } = getWidgetSize();
    const safe = getSafeAreaInsets();
    const bottomReservedHeight = getNativeBottomChromeReservedHeight();

    const minLeft = EDGE_GAP + safe.left;
    const minTop = EDGE_GAP + safe.top;
    const maxLeft = Math.max(minLeft, viewportWidth - width - EDGE_GAP - safe.right);
    const maxTop = Math.max(minTop, viewportHeight - height - EDGE_GAP - safe.bottom - bottomReservedHeight);

    return {
      left: Math.min(Math.max(position.left, minLeft), maxLeft),
      top: Math.min(Math.max(position.top, minTop), maxTop),
    };
  }, [getWidgetSize]);

  const getDefaultPosition = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = getWindowSize();
    const { width, height } = getWidgetSize();
    const safe = getSafeAreaInsets();
    const bottomReservedHeight = getNativeBottomChromeReservedHeight();

    return clampPosition({
      left: viewportWidth - width - EDGE_GAP - safe.right,
      top: viewportHeight - height - bottomReservedHeight - EDGE_GAP - safe.bottom,
    });
  }, [clampPosition, getWidgetSize]);

  const savePosition = useCallback((position) => {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch (error) {
      // Ignore private-mode storage failures; the default position still works.
    }
  }, []);

  const loadPosition = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY));
      if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
        return clampPosition(saved);
      }
    } catch (error) {
      // Ignore malformed saved positions.
    }

    return getDefaultPosition();
  }, [clampPosition, getDefaultPosition]);

  const clearSplashTimer = useCallback(() => {
    if (splashTimerRef.current) {
      clearTimeout(splashTimerRef.current);
      splashTimerRef.current = null;
    }
  }, []);

  const clearCycleTimer = useCallback(() => {
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
  }, []);

  const clearCycleTimers = useCallback(() => {
    clearCycleTimer();
  }, [clearCycleTimer]);

  const muteFloatingAudio = useCallback(() => {
    const video = floatingVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
  }, []);

  const enableExpandedAudio = useCallback(() => {
    const video = floatingVideoRef.current;
    if (!video) return;

    video.muted = false;
    video.defaultMuted = false;
    try {
      const playPromise = video.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    } catch {
      // Some test/browser environments reject unmuted playback even after a tap.
    }
  }, []);

  const collapseFloatingVideo = useCallback(() => {
    muteFloatingAudio();
    setIsExpanded(false);
  }, [muteFloatingAudio]);

  const resetFloatingInteraction = useCallback(() => {
    muteFloatingAudio();
    setIsExpanded(false);
    setIsDragging(false);
    dragRef.current = null;
  }, [muteFloatingAudio]);

  const hideSplash = useCallback(() => {
    clearSplashTimer();
    setShowSplash(false);
  }, [clearSplashTimer]);

  const scheduleSplashTimeout = useCallback(() => {
    clearSplashTimer();
    if (!isNative || !showSplash || document.visibilityState !== "visible") return;

    splashTimerRef.current = setTimeout(hideSplash, INTRO_TIMEOUT_MS);
  }, [clearSplashTimer, hideSplash, isNative, showSplash]);

  const ensureBottomAdMobBanner = useCallback(() => {
    const status = getAdMobBannerStatus();
    if (status === "loading" || status === "loaded") return;

    const requestId = adMobBannerRequestIdRef.current + 1;
    adMobBannerRequestIdRef.current = requestId;

    void showAdMobBanner().then((requestStarted) => {
      if (adMobBannerRequestIdRef.current === requestId) {
        isAdMobBannerVisibleRef.current = Boolean(requestStarted);
      }
    });
  }, []);

  const removeBottomAdMobBanner = useCallback(() => {
    adMobBannerRequestIdRef.current += 1;
    isAdMobBannerVisibleRef.current = false;
    void removeAdMobBanner();
  }, []);

  const showAdMobPhase = useCallback(() => {
    clearCycleTimer();
    if (!isNative || document.visibilityState !== "visible") return;

    resetFloatingInteraction();
    setShowFloating(false);
    ensureBottomAdMobBanner();

    cycleTimerRef.current = setTimeout(() => {
      cycleTimerRef.current = null;
      showLocalVideoPhaseRef.current();
    }, GOOGLE_AD_DURATION_MS);
  }, [clearCycleTimer, ensureBottomAdMobBanner, isNative, resetFloatingInteraction]);

  const showLocalVideoPhase = useCallback(() => {
    clearCycleTimer();
    if (!isNative || document.visibilityState !== "visible") return;

    resetFloatingInteraction();
    ensureBottomAdMobBanner();
    setFloatingPosition(loadPosition());
    setShowFloating(true);

    cycleTimerRef.current = setTimeout(() => {
      cycleTimerRef.current = null;
      setShowFloating(false);
      showAdMobPhaseRef.current();
    }, LOCAL_VIDEO_DURATION_MS);
  }, [clearCycleTimer, ensureBottomAdMobBanner, isNative, loadPosition, resetFloatingInteraction]);

  useEffect(() => {
    showAdMobPhaseRef.current = showAdMobPhase;
  }, [showAdMobPhase]);

  useEffect(() => {
    showLocalVideoPhaseRef.current = showLocalVideoPhase;
  }, [showLocalVideoPhase]);

  const stopNativeVideoCycle = useCallback((resetSplash = false) => {
    clearSplashTimer();
    clearCycleTimers();
    resetFloatingInteraction();
    setShowFloating(false);
    if (resetSplash) {
      setShowSplash(false);
    }
    removeBottomAdMobBanner();
  }, [clearCycleTimers, clearSplashTimer, removeBottomAdMobBanner, resetFloatingInteraction]);

  const handlePointerDown = useCallback((event) => {
    if (isExpanded || !floatingPosition || event.button > 0) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: floatingPosition.left,
      startTop: floatingPosition.top,
      hasMoved: false,
    };
  }, [floatingPosition, isExpanded]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      return;
    }

    drag.hasMoved = true;
    setIsDragging(true);
    event.preventDefault();
    const nextPosition = clampPosition({
      left: drag.startLeft + deltaX,
      top: drag.startTop + deltaY,
    });
    setFloatingPosition(nextPosition);
  }, [clampPosition]);

  const finishDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);

    if (!drag.hasMoved) {
      setIsExpanded(true);
      enableExpandedAudio();
      return;
    }

    setFloatingPosition((current) => {
      const clamped = clampPosition(current || getDefaultPosition());
      savePosition(clamped);
      return clamped;
    });
  }, [clampPosition, enableExpandedAudio, getDefaultPosition, savePosition]);

  useEffect(() => {
    if (!isNative) return undefined;

    document.body.classList.add("goodone-native-shell-active");

    let observedBottomNav = null;
    let resizeObserver = null;

    const syncNativeChromeLayout = () => {
      const bottomNav = document.querySelector(".native-bottom-nav");
      syncNativeBottomNavHeightCssVariable();

      if (window.ResizeObserver && bottomNav && bottomNav !== observedBottomNav) {
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(() => {
          syncNativeBottomNavHeightCssVariable();
          setFloatingPosition((current) => (current ? clampPosition(current) : current));
        });
        resizeObserver.observe(bottomNav);
        observedBottomNav = bottomNav;
      }

      if (!bottomNav && observedBottomNav) {
        resizeObserver?.disconnect();
        resizeObserver = null;
        observedBottomNav = null;
      }

      setFloatingPosition((current) => (current ? clampPosition(current) : current));
    };

    syncNativeChromeLayout();

    const mutationObserver = window.MutationObserver
      ? new MutationObserver(syncNativeChromeLayout)
      : null;

    mutationObserver?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", syncNativeChromeLayout);
    window.addEventListener("orientationchange", syncNativeChromeLayout);
    window.addEventListener(ADMOB_LAYOUT_EVENT, syncNativeChromeLayout);
    window.visualViewport?.addEventListener("resize", syncNativeChromeLayout);

    return () => {
      document.body.classList.remove("goodone-native-shell-active", "goodone-admob-banner-active");
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncNativeChromeLayout);
      window.removeEventListener("orientationchange", syncNativeChromeLayout);
      window.removeEventListener(ADMOB_LAYOUT_EVENT, syncNativeChromeLayout);
      window.visualViewport?.removeEventListener("resize", syncNativeChromeLayout);
      setRootCssPixelValue(NATIVE_BOTTOM_NAV_HEIGHT_CSS_VARIABLE, 0);
      setRootCssPixelValue(ADMOB_BANNER_HEIGHT_CSS_VARIABLE, 0);
    };
  }, [clampPosition, isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    scheduleSplashTimeout();
    return clearSplashTimer;
  }, [clearSplashTimer, isNative, scheduleSplashTimeout]);

  useEffect(() => {
    if (!isNative || showSplash) return undefined;
    if (document.visibilityState !== "visible") return undefined;

    showAdMobPhaseRef.current();
    return clearCycleTimers;
  }, [clearCycleTimers, isNative, showSplash]);

  useEffect(() => {
    if (!isNative) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopNativeVideoCycle(true);
        return;
      }

      setShowSplash(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isNative,
    stopNativeVideoCycle,
  ]);

  useEffect(() => {
    if (!isNative) return undefined;

    return () => {
      clearSplashTimer();
      clearCycleTimers();
      setShowFloating(false);
      removeBottomAdMobBanner();
    };
  }, [clearCycleTimers, clearSplashTimer, isNative, removeBottomAdMobBanner]);

  useEffect(() => {
    if (!isNative) return undefined;

    const handleResize = () => {
      setFloatingPosition((current) => {
        if (!current) return current;
        const clamped = clampPosition(current);
        savePosition(clamped);
        return clamped;
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [clampPosition, isNative, savePosition]);

  if (!isNative) return null;

  return (
    <>
      {showSplash && (
        <div className="app-video-splash" role="presentation">
          <video
            src={VIDEO_SRC}
            autoPlay
            playsInline
            preload="auto"
            onEnded={hideSplash}
            onError={hideSplash}
          />
        </div>
      )}

      {!showSplash && showFloating && (
        <>
          {isExpanded && (
            <div
              className="floating-video-backdrop"
              role="presentation"
              onPointerDown={collapseFloatingVideo}
            />
          )}
          <div
            ref={widgetRef}
            className={`floating-video-widget ${isDragging ? "dragging" : ""} ${isExpanded ? "expanded" : ""}`}
            style={
              floatingPosition && !isExpanded
                ? { left: `${floatingPosition.left}px`, top: `${floatingPosition.top}px` }
                : undefined
            }
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <video
              ref={floatingVideoRef}
              src={VIDEO_SRC}
              autoPlay
              playsInline
              preload="auto"
              muted={!isExpanded}
            />
          </div>
        </>
      )}
    </>
  );
}
