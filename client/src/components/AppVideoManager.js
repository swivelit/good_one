import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "react-router-dom";
import {
  getAdMobBannerStatus,
  removeAdMobBanner,
  showAdMobBanner,
  syncAdMobBannerLayoutForViewport,
} from "../services/admob";

const POPUP_REPEAT_INTERVAL_MS = 5 * 60 * 1000;
const LOCAL_VIDEO_DURATION_MS = 10000;
const BANNER_ONLY_PHASE_MS = POPUP_REPEAT_INTERVAL_MS - LOCAL_VIDEO_DURATION_MS;
const POSITION_KEY = "goodone_floating_video_position";
export const LOCAL_FLOATING_VIDEO_STORAGE_KEY = "GOODONE_LOCAL_VIDEO_AD";
const EDGE_GAP = 12;
const DEFAULT_BOTTOM_AD_RESERVED_PX = 50;
const DRAG_THRESHOLD_PX = 7;
const ADMOB_BANNER_HEIGHT_CSS_VARIABLE = "--goodone-admob-banner-height";
const NATIVE_BOTTOM_NAV_HEIGHT_CSS_VARIABLE = "--goodone-native-bottom-nav-height";
const VIEWPORT_HEIGHT_CSS_VARIABLE = "--goodone-viewport-height";
const VIEWPORT_WIDTH_CSS_VARIABLE = "--goodone-viewport-width";
const ADMOB_LAYOUT_EVENT = "goodone:admob-banner-layout-change";
const NATIVE_SAFE_AREA_EVENT = "goodone:native-safe-area-change";
const VIDEO_SRC = "/media/goodone-intro.mp4";
const LOCAL_VIDEO_BLOCKED_ROUTE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/register",
  "/dashboard/add-product",
  "/chat",
];

export const isLocalFloatingVideoRouteAllowed = (pathname = "") => {
  const normalizedPath = String(pathname || "");
  return !LOCAL_VIDEO_BLOCKED_ROUTE_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
};

const getLocalFloatingVideoStorageOverride = () => {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage?.getItem(LOCAL_FLOATING_VIDEO_STORAGE_KEY);
    if (value === "true") return true;
    if (value === "false") return false;
  } catch {
    // Storage overrides are optional. The promo should never block app startup.
  }

  return null;
};

export const isLocalFloatingVideoAdEnabled = ({
  isNative = Capacitor.isNativePlatform(),
  platform = typeof Capacitor.getPlatform === "function" ? Capacitor.getPlatform() : "web",
} = {}) => {
  if (!isNative) return false;

  const storageOverride = getLocalFloatingVideoStorageOverride();
  if (storageOverride !== null) return storageOverride;

  if (process.env.REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD === "false") {
    return false;
  }

  if (process.env.REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD === "true") {
    return true;
  }

  return platform === "android";
};

const getWindowSize = () => ({
  width: window.visualViewport?.width || window.innerWidth,
  height: window.visualViewport?.height || window.innerHeight,
});

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

const removeRootCssValue = (name) => {
  if (typeof document === "undefined") return;

  document.documentElement.style.removeProperty(name);
};

export const syncNativeViewportCssVariables = () => {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  const width = window.visualViewport?.width || window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;

  setRootCssPixelValue(VIEWPORT_HEIGHT_CSS_VARIABLE, height);
  setRootCssPixelValue(VIEWPORT_WIDTH_CSS_VARIABLE, width);

  return { width, height };
};

const getSafeAreaCssPixelValue = (side) => (
  getCssPixelValue(
    `--goodone-safe-area-${side}`,
    getCssPixelValue(`--safe-area-inset-${side}`, 0)
  )
);

const getSafeAreaInsets = () => ({
  top: getSafeAreaCssPixelValue("top"),
  right: getSafeAreaCssPixelValue("right"),
  bottom: getSafeAreaCssPixelValue("bottom"),
  left: getSafeAreaCssPixelValue("left"),
});

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

const isAdMobBannerLayoutActive = () => (
  typeof document !== "undefined" &&
  Boolean(document.body?.classList?.contains("goodone-admob-banner-active"))
);

const getNativeBottomChromeReservedHeight = () => {
  const safeBottom = getSafeAreaInsets().bottom;
  const bannerHeight = isAdMobBannerLayoutActive() ? getAdMobBannerReservedHeight() : 0;
  const bottomNavHeight = getNativeBottomNavHeight();
  const bottomNavGap = getNativeBottomNavGap();

  if (bottomNavHeight > 0) {
    return bottomNavHeight + bannerHeight + bottomNavGap + (bannerHeight > 0 ? safeBottom : 0);
  }

  return safeBottom + bannerHeight;
};

export default function AppVideoManager() {
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();
  const platform = typeof Capacitor.getPlatform === "function" ? Capacitor.getPlatform() : "web";
  const isLocalFloatingVideoEnabled = isLocalFloatingVideoAdEnabled({ isNative, platform });
  const isLocalVideoRouteAllowed = isLocalFloatingVideoRouteAllowed(location.pathname);
  const [showFloating, setShowFloating] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLocalVideoDismissed, setIsLocalVideoDismissed] = useState(false);
  const cycleTimerRef = useRef(null);
  const showAdMobPhaseRef = useRef(() => {});
  const showLocalVideoPhaseRef = useRef(() => {});
  const isAdMobBannerVisibleRef = useRef(false);
  const adMobBannerRequestIdRef = useRef(0);
  const widgetRef = useRef(null);
  const floatingVideoRef = useRef(null);
  const dragRef = useRef(null);
  const wasLocalVideoRouteAllowedRef = useRef(isLocalVideoRouteAllowed);
  const canShowLocalFloatingVideo =
    isLocalFloatingVideoEnabled &&
    isLocalVideoRouteAllowed &&
    !isLocalVideoDismissed;

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
    const maxTop = Math.max(minTop, viewportHeight - height - EDGE_GAP - bottomReservedHeight);

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
      top: viewportHeight - height - bottomReservedHeight - EDGE_GAP,
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

    if (!canShowLocalFloatingVideo) return;

    cycleTimerRef.current = setTimeout(() => {
      cycleTimerRef.current = null;
      showLocalVideoPhaseRef.current();
    }, BANNER_ONLY_PHASE_MS);
  }, [
    clearCycleTimer,
    canShowLocalFloatingVideo,
    ensureBottomAdMobBanner,
    isNative,
    resetFloatingInteraction,
  ]);

  const showLocalVideoPhase = useCallback(() => {
    clearCycleTimer();
    if (
      !isNative ||
      !canShowLocalFloatingVideo ||
      document.visibilityState !== "visible"
    ) return;

    // This is a local GoodOne promo video. It is not an AdMob ad and does not earn AdMob revenue.
    resetFloatingInteraction();
    ensureBottomAdMobBanner();
    setFloatingPosition(loadPosition());
    setShowFloating(true);

    cycleTimerRef.current = setTimeout(() => {
      cycleTimerRef.current = null;
      setShowFloating(false);
      showAdMobPhaseRef.current();
    }, LOCAL_VIDEO_DURATION_MS);
  }, [
    clearCycleTimer,
    canShowLocalFloatingVideo,
    ensureBottomAdMobBanner,
    isNative,
    loadPosition,
    resetFloatingInteraction,
  ]);

  useEffect(() => {
    showAdMobPhaseRef.current = showAdMobPhase;
  }, [showAdMobPhase]);

  useEffect(() => {
    showLocalVideoPhaseRef.current = showLocalVideoPhase;
  }, [showLocalVideoPhase]);

  const stopNativeVideoCycle = useCallback(() => {
    clearCycleTimers();
    resetFloatingInteraction();
    setShowFloating(false);
    removeBottomAdMobBanner();
  }, [clearCycleTimers, removeBottomAdMobBanner, resetFloatingInteraction]);

  const handleDismissLocalVideo = useCallback((event) => {
    event.stopPropagation();
    clearCycleTimers();
    setIsLocalVideoDismissed(true);
    resetFloatingInteraction();
    setShowFloating(false);
    ensureBottomAdMobBanner();
  }, [clearCycleTimers, ensureBottomAdMobBanner, resetFloatingInteraction]);

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

    const syncNativeChromeLayout = ({ shouldSyncAdMob = false } = {}) => {
      const bottomNav = document.querySelector(".native-bottom-nav");
      syncNativeViewportCssVariables();
      if (shouldSyncAdMob) {
        syncAdMobBannerLayoutForViewport();
      }
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

    const syncNativeChromeForViewportChange = () => {
      syncNativeChromeLayout({ shouldSyncAdMob: true });
    };

    syncNativeChromeLayout({ shouldSyncAdMob: true });

    const mutationObserver = window.MutationObserver
      ? new MutationObserver(syncNativeChromeLayout)
      : null;

    mutationObserver?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", syncNativeChromeForViewportChange);
    window.addEventListener("orientationchange", syncNativeChromeForViewportChange);
    window.addEventListener(ADMOB_LAYOUT_EVENT, syncNativeChromeLayout);
    window.addEventListener(NATIVE_SAFE_AREA_EVENT, syncNativeChromeLayout);
    window.visualViewport?.addEventListener("resize", syncNativeChromeForViewportChange);
    window.visualViewport?.addEventListener("scroll", syncNativeChromeForViewportChange);

    return () => {
      document.body.classList.remove("goodone-native-shell-active", "goodone-admob-banner-active");
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncNativeChromeForViewportChange);
      window.removeEventListener("orientationchange", syncNativeChromeForViewportChange);
      window.removeEventListener(ADMOB_LAYOUT_EVENT, syncNativeChromeLayout);
      window.removeEventListener(NATIVE_SAFE_AREA_EVENT, syncNativeChromeLayout);
      window.visualViewport?.removeEventListener("resize", syncNativeChromeForViewportChange);
      window.visualViewport?.removeEventListener("scroll", syncNativeChromeForViewportChange);
      setRootCssPixelValue(NATIVE_BOTTOM_NAV_HEIGHT_CSS_VARIABLE, 0);
      setRootCssPixelValue(ADMOB_BANNER_HEIGHT_CSS_VARIABLE, 0);
      removeRootCssValue(VIEWPORT_HEIGHT_CSS_VARIABLE);
      removeRootCssValue(VIEWPORT_WIDTH_CSS_VARIABLE);
    };
  }, [clampPosition, isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    if (document.visibilityState !== "visible") return undefined;

    showAdMobPhaseRef.current();
    return clearCycleTimers;
  }, [clearCycleTimers, isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    const wasAllowed = wasLocalVideoRouteAllowedRef.current;
    wasLocalVideoRouteAllowedRef.current = isLocalVideoRouteAllowed;

    if (!isLocalVideoRouteAllowed) {
      clearCycleTimers();
      resetFloatingInteraction();
      setShowFloating(false);
      ensureBottomAdMobBanner();
      return undefined;
    }

    if (!wasAllowed && document.visibilityState === "visible") {
      showAdMobPhaseRef.current();
    }

    return undefined;
  }, [
    clearCycleTimers,
    ensureBottomAdMobBanner,
    isLocalVideoRouteAllowed,
    isNative,
    resetFloatingInteraction,
  ]);

  useEffect(() => {
    if (!isNative) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopNativeVideoCycle();
        return;
      }

      showAdMobPhaseRef.current();
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
      clearCycleTimers();
      setShowFloating(false);
      removeBottomAdMobBanner();
    };
  }, [clearCycleTimers, isNative, removeBottomAdMobBanner]);

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
    window.visualViewport?.addEventListener("scroll", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
    };
  }, [clampPosition, isNative, savePosition]);

  if (!isNative) return null;

  return (
    <>
      {showFloating && (
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
            <button
              type="button"
              className="floating-video-close"
              aria-label="Close local video promo"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={handleDismissLocalVideo}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}
