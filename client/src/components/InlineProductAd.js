import React, { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getAdMobAdUnitConfig, ADMOB_FORMATS } from "../services/admob/config";

// Self-contained inline (in-feed) ad slot rendered between product cards.
//
// AdMob in-feed ads require NATIVE ads, which @capacitor-community/admob does
// not support. The native path needs a custom Capacitor plugin (registered as
// "NativeAd") that loads a GADNativeAd / NativeAd and returns its asset fields.
// Until that plugin is present AND fills a real native ad, this component
// renders a clearly-labeled in-house placeholder so the feed layout is correct
// and nothing is broken. If/when the plugin is added, this component will use
// it automatically with no further wiring.
//
// Expected (future) plugin contract:
//   const NativeAd = registerPlugin('NativeAd');
//   const ad = await NativeAd.load({ adId });
//   // ad: { headline, body, callToAction, iconUrl, imageUrl, advertiser }
//   await NativeAd.registerView({ adId, ... }); // for impression/click tracking

const getNativeAdPlugin = () => {
  try {
    const plugins = Capacitor?.Plugins || {};
    const plugin = plugins.NativeAd;
    if (plugin && typeof plugin.load === "function") return plugin;
  } catch {
    /* no-op */
  }
  return null;
};

export default function InlineProductAd({ index = 0 }) {
  const [nativeAd, setNativeAd] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const plugin = getNativeAdPlugin();

    // No native plugin available (current state) → keep the placeholder.
    if (!plugin || !Capacitor?.isNativePlatform?.()) {
      return () => {
        mountedRef.current = false;
      };
    }

    const { adId } = getAdMobAdUnitConfig(ADMOB_FORMATS.NATIVE);
    if (!adId) {
      return () => {
        mountedRef.current = false;
      };
    }

    plugin
      .load({ adId })
      .then((ad) => {
        // Only render a native ad if the unit actually FILLED.
        if (mountedRef.current && ad && (ad.headline || ad.body)) {
          setNativeAd(ad);
        }
      })
      .catch((error) => {
        // Fill failure / no-fill → silently keep the placeholder.
        console.warn("[InlineProductAd] native ad load failed", error?.message || error);
      });

    return () => {
      mountedRef.current = false;
    };
  }, [index]);

  if (nativeAd) {
    return (
      <div
        className="inline-product-ad card border-0 shadow-sm h-100"
        data-testid="inline-product-ad-native"
        style={{ borderRadius: 14, overflow: "hidden" }}
      >
        <div className="d-flex align-items-center justify-content-between px-3 pt-2">
          <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: "0.6rem" }}>
            Ad
          </span>
          {nativeAd.advertiser && (
            <small className="text-muted text-truncate" style={{ maxWidth: "60%" }}>
              {nativeAd.advertiser}
            </small>
          )}
        </div>
        {nativeAd.imageUrl && (
          <img
            src={nativeAd.imageUrl}
            alt={nativeAd.headline || "Sponsored"}
            className="w-100"
            style={{ height: 160, objectFit: "cover" }}
          />
        )}
        <div className="card-body">
          <div className="d-flex align-items-center gap-2 mb-1">
            {nativeAd.iconUrl && (
              <img
                src={nativeAd.iconUrl}
                alt=""
                style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
              />
            )}
            <h6 className="fw-bold mb-0 text-truncate">{nativeAd.headline}</h6>
          </div>
          {nativeAd.body && <p className="text-muted small mb-2 lh-sm">{nativeAd.body}</p>}
          {nativeAd.callToAction && (
            <span className="btn btn-sm btn-primary-custom w-100">{nativeAd.callToAction}</span>
          )}
        </div>
      </div>
    );
  }

  // In-house labeled placeholder (default, non-breaking) slot.
  return (
    <div
      className="inline-product-ad inline-product-ad--placeholder card border-0 shadow-sm h-100"
      data-testid="inline-product-ad-placeholder"
      style={{
        borderRadius: 14,
        background: "linear-gradient(135deg,#FFF8F4,#FFFFFF)",
        border: "1px dashed #FFD2BB",
      }}
    >
      <div className="card-body d-flex flex-column justify-content-center text-center py-4">
        <span
          className="badge align-self-center mb-2"
          style={{ background: "#FF6B35", fontSize: "0.6rem" }}
        >
          Sponsored
        </span>
        <i className="bi bi-megaphone-fill mb-2" style={{ fontSize: "1.6rem", color: "#FF6B35" }}></i>
        <h6 className="fw-bold mb-1" style={{ color: "#2C3E50" }}>
          Your ad could be here
        </h6>
        <p className="text-muted small mb-0 lh-sm">
          In-feed ad slot · advertise with GoodOne
        </p>
      </div>
    </div>
  );
}
