import React, { useEffect, useMemo, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useLocation } from "react-router-dom";
import {
  ADMOB_FORMATS,
  getAdMobAdUnitConfig,
  maskAdMobAdUnitId,
} from "../services/admob/config";

const INLINE_AD_HEIGHT_PX = 312;

let slotCounter = 0;
let registeredNativeAdPlugin = null;

try {
  registeredNativeAdPlugin = registerPlugin("NativeAd");
} catch {
  registeredNativeAdPlugin = null;
}

const getNativeAdPlugin = () => {
  try {
    const plugin = registeredNativeAdPlugin || Capacitor?.Plugins?.NativeAd;
    if (
      plugin &&
      typeof plugin.create === "function" &&
      typeof plugin.load === "function" &&
      typeof plugin.show === "function" &&
      typeof plugin.updatePosition === "function" &&
      typeof plugin.hide === "function" &&
      typeof plugin.destroy === "function"
    ) {
      return plugin;
    }
  } catch {
    /* no-op */
  }
  return null;
};

const isAndroidNative = () => {
  try {
    return Capacitor?.isNativePlatform?.() && Capacitor?.getPlatform?.() === "android";
  } catch {
    return false;
  }
};

const getFrameForElement = (element) => {
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
  const visible = (
    document.visibilityState !== "hidden" &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewportHeight &&
    rect.left < viewportWidth
  );

  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    scale: window.devicePixelRatio || 1,
    visible,
  };
};

const logNativeAdEvent = (message, details = {}) => {
  if (process.env.NODE_ENV === "production") return;
  console.info("[InlineProductAd]", message, details);
};

const warnNativeAdEvent = (message, error, details = {}) => {
  console.warn("[InlineProductAd]", message, {
    ...details,
    error: error?.message || error,
  });
};

export default function InlineProductAd({ index = 0 }) {
  const location = useLocation();
  const containerRef = useRef(null);
  const mountedRef = useRef(false);
  const rafRef = useRef(0);
  const slotId = useMemo(() => {
    slotCounter += 1;
    return `inline-product-ad-${index}-${slotCounter}`;
  }, [index]);

  useEffect(() => {
    mountedRef.current = true;
    const plugin = getNativeAdPlugin();
    const androidNative = isAndroidNative();

    if (!plugin || !androidNative) {
      return () => {
        mountedRef.current = false;
      };
    }

    const config = getAdMobAdUnitConfig(ADMOB_FORMATS.NATIVE, "android");
    const maskedAdId = maskAdMobAdUnitId(config.adId);

    if (!config.configured) {
      logNativeAdEvent("native ad skipped because no unit is configured", {
        source: config.source,
        useTestAds: config.useTestAds,
      });
      return () => {
        mountedRef.current = false;
      };
    }

    const frame = () => getFrameForElement(containerRef.current);
    const updateNativePosition = () => {
      if (!mountedRef.current) return;

      const nextFrame = frame();
      if (!nextFrame) return;

      plugin.updatePosition({
        slotId,
        ...nextFrame,
      }).catch((error) => {
        warnNativeAdEvent("native ad position update failed", error, { slotId, adId: maskedAdId });
      });
    };

    const requestPositionUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        updateNativePosition();
      });
    };

    let resizeObserver = null;
    let intersectionObserver = null;

    const attachPositionListeners = () => {
      window.addEventListener("scroll", requestPositionUpdate, true);
      window.addEventListener("resize", requestPositionUpdate);
      window.addEventListener("orientationchange", requestPositionUpdate);
      document.addEventListener("visibilitychange", requestPositionUpdate);
      window.visualViewport?.addEventListener?.("resize", requestPositionUpdate);
      window.visualViewport?.addEventListener?.("scroll", requestPositionUpdate);

      if ("ResizeObserver" in window && containerRef.current) {
        resizeObserver = new ResizeObserver(requestPositionUpdate);
        resizeObserver.observe(containerRef.current);
      }

      if ("IntersectionObserver" in window && containerRef.current) {
        intersectionObserver = new IntersectionObserver(requestPositionUpdate, {
          threshold: [0, 0.25, 0.5, 0.75, 1],
        });
        intersectionObserver.observe(containerRef.current);
      }
    };

    const detachPositionListeners = () => {
      window.removeEventListener("scroll", requestPositionUpdate, true);
      window.removeEventListener("resize", requestPositionUpdate);
      window.removeEventListener("orientationchange", requestPositionUpdate);
      document.removeEventListener("visibilitychange", requestPositionUpdate);
      window.visualViewport?.removeEventListener?.("resize", requestPositionUpdate);
      window.visualViewport?.removeEventListener?.("scroll", requestPositionUpdate);
      resizeObserver?.disconnect?.();
      intersectionObserver?.disconnect?.();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    attachPositionListeners();

    const loadNativeAd = async () => {
      const initialFrame = frame();
      if (!initialFrame) return;

      try {
        await plugin.create({
          slotId,
          adId: config.adId,
          source: config.source,
          useTestAds: config.useTestAds,
          ...initialFrame,
        });

        logNativeAdEvent("native ad load requested", {
          slotId,
          adId: maskedAdId,
          source: config.source,
          useTestAds: config.useTestAds,
        });

        await plugin.load({ slotId, adId: config.adId });
        if (!mountedRef.current) return;

        await plugin.show({
          slotId,
          ...frame(),
        });
        requestPositionUpdate();
      } catch (error) {
        warnNativeAdEvent("native ad load failed; keeping placeholder", error, {
          slotId,
          adId: maskedAdId,
          source: config.source,
          useTestAds: config.useTestAds,
        });
      }
    };

    void loadNativeAd();
    requestPositionUpdate();

    return () => {
      mountedRef.current = false;
      detachPositionListeners();
      plugin.hide({ slotId }).catch(() => {});
      plugin.destroy({ slotId }).catch(() => {});
    };
  }, [index, location.pathname, location.search, location.hash, slotId]);

  return (
    <div
      ref={containerRef}
      className="inline-product-ad inline-product-ad--placeholder card border-0 shadow-sm h-100"
      data-testid="inline-product-ad-placeholder"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        height: INLINE_AD_HEIGHT_PX,
        minHeight: INLINE_AD_HEIGHT_PX,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div className="card-body d-flex flex-column justify-content-center text-center py-4">
        <span
          className="badge align-self-center mb-2"
          style={{ background: "#FF6B35", fontSize: "0.6rem" }}
        >
          Sponsored
        </span>
        <i className="bi bi-badge-ad mb-2" style={{ fontSize: "1.6rem", color: "#FF6B35" }}></i>
        <h6 className="fw-bold mb-1" style={{ color: "#2C3E50" }}>
          Sponsored listing
        </h6>
        <p className="text-muted small mb-0 lh-sm">
          Native ad slot
        </p>
      </div>
    </div>
  );
}
