import React, { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

const INTRO_TIMEOUT_MS = 4000;
const POPUP_DELAY_MS = 5000;
const POSITION_KEY = "goodone_floating_video_position";
const EDGE_GAP = 12;
const DEFAULT_BOTTOM_OFFSET = 90;
const DRAG_THRESHOLD_PX = 7;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const VIDEO_SRC = `${PUBLIC_URL}/media/goodone-intro.mp4`;

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

export default function AppVideoManager() {
  const isNative = Capacitor.isNativePlatform();
  const [showSplash, setShowSplash] = useState(isNative);
  const [showFloating, setShowFloating] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const splashTimerRef = useRef(null);
  const popupTimerRef = useRef(null);
  const widgetRef = useRef(null);
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

    const minLeft = EDGE_GAP + safe.left;
    const minTop = EDGE_GAP + safe.top;
    const maxLeft = Math.max(minLeft, viewportWidth - width - EDGE_GAP - safe.right);
    const maxTop = Math.max(minTop, viewportHeight - height - EDGE_GAP - safe.bottom);

    return {
      left: Math.min(Math.max(position.left, minLeft), maxLeft),
      top: Math.min(Math.max(position.top, minTop), maxTop),
    };
  }, [getWidgetSize]);

  const getDefaultPosition = useCallback(() => {
    const { width: viewportWidth, height: viewportHeight } = getWindowSize();
    const { width, height } = getWidgetSize();
    const safe = getSafeAreaInsets();

    return clampPosition({
      left: viewportWidth - width - EDGE_GAP - safe.right,
      top: viewportHeight - height - DEFAULT_BOTTOM_OFFSET - safe.bottom,
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
        setFloatingPosition(loadPosition());
        setShowFloating(true);
      }
    }, POPUP_DELAY_MS);
  }, [clearPopupTimer, isNative, loadPosition, showFloating, showSplash]);

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
      return;
    }

    setFloatingPosition((current) => {
      const clamped = clampPosition(current || getDefaultPosition());
      savePosition(clamped);
      return clamped;
    });
  }, [clampPosition, getDefaultPosition, savePosition]);

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
        setIsExpanded(false);
        setIsDragging(false);
        dragRef.current = null;
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
            muted
            playsInline
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
              onPointerDown={() => setIsExpanded(false)}
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
            <video src={VIDEO_SRC} autoPlay muted playsInline loop />
          </div>
        </>
      )}
    </>
  );
}
