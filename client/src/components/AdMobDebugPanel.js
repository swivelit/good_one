import React, { useEffect, useMemo, useState } from "react";
import {
  getAdMobDiagnostics,
  getAdMobFeatureSupport,
  getMaskedAdMobFormatConfig,
  hideAdMobBanner,
  initializeAdMob,
  isUsingAdMobTestAds,
  loadAdMobInterstitial,
  openAdMobAdInspector,
  showAdMobBanner,
  showAdMobInterstitial,
  subscribeAdMobDiagnostics,
} from "../services/admob";

export const ADMOB_DEBUG_STORAGE_KEY = "GOODONE_ADMOB_DEBUG";

const readDebugStorageFlag = () => {
  try {
    return window.localStorage?.getItem(ADMOB_DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const isAdMobDebugPanelEnabled = ({
  localStorageFlag = readDebugStorageFlag(),
  nodeEnv = process.env.NODE_ENV,
  useTestAds = isUsingAdMobTestAds(),
} = {}) => (
  Boolean(localStorageFlag) ||
  nodeEnv === "development" ||
  (nodeEnv === "production" && useTestAds)
);

const getButtonClassName = (variant = "outline-secondary") => (
  `btn btn-sm btn-${variant} d-inline-flex align-items-center gap-1`
);

export default function AdMobDebugPanel() {
  const [enabled, setEnabled] = useState(() => isAdMobDebugPanelEnabled());
  const [diagnostics, setDiagnostics] = useState(() => getAdMobDiagnostics());
  const [runtimeConfig, setRuntimeConfig] = useState(() => getMaskedAdMobFormatConfig());
  const [featureSupport, setFeatureSupport] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    setEnabled(isAdMobDebugPanelEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    setRuntimeConfig(getMaskedAdMobFormatConfig());
    const unsubscribe = subscribeAdMobDiagnostics(setDiagnostics);
    let cancelled = false;

    getAdMobFeatureSupport().then((support) => {
      if (!cancelled) setFeatureSupport(support);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enabled]);

  const configuredFormats = useMemo(() => (
    Object.entries(runtimeConfig.formats || {}).map(([format, config]) => ({
      configured: config.configured,
      format,
      id: config.adId,
      source: config.source,
    }))
  ), [runtimeConfig.formats]);

  const runAction = async (name, action) => {
    setBusyAction(name);
    try {
      await action();
      setRuntimeConfig(getMaskedAdMobFormatConfig());
      const support = await getAdMobFeatureSupport();
      setFeatureSupport(support);
    } finally {
      setBusyAction("");
    }
  };

  if (!enabled) return null;

  const lastErrorMessage = diagnostics.lastError?.details?.error?.message || "None";
  const recentEvents = diagnostics.events.slice(0, 6);

  return (
    <aside className="admob-debug-panel" data-testid="admob-debug-panel">
      <div className="admob-debug-panel__header">
        <strong>AdMob</strong>
        <span>{runtimeConfig.platform}</span>
      </div>

      <div className="admob-debug-panel__grid">
        <span>Test ads</span>
        <strong>{runtimeConfig.useTestAds ? "Enabled" : "Disabled"}</strong>
        <span>Native</span>
        <strong>{runtimeConfig.isNativePlatform ? "Yes" : "No"}</strong>
      </div>

      <div className="admob-debug-panel__formats">
        {configuredFormats.map((item) => (
          <div key={item.format} className="admob-debug-panel__format">
            <span>{item.format}</span>
            <code>{item.configured ? item.id : "missing"}</code>
          </div>
        ))}
      </div>

      <div className="admob-debug-panel__actions">
        <button
          type="button"
          className={getButtonClassName("outline-primary")}
          disabled={Boolean(busyAction)}
          onClick={() => runAction("init", initializeAdMob)}
        >
          <i className="bi bi-power" />
          Initialize
        </button>
        <button
          type="button"
          className={getButtonClassName()}
          disabled={Boolean(busyAction)}
          onClick={() => runAction("banner", () => showAdMobBanner({ force: true }))}
        >
          <i className="bi bi-badge-ad" />
          Show banner test
        </button>
        <button
          type="button"
          className={getButtonClassName()}
          disabled={Boolean(busyAction)}
          onClick={() => runAction("hide-banner", hideAdMobBanner)}
        >
          <i className="bi bi-eye-slash" />
          Hide banner
        </button>
        <button
          type="button"
          className={getButtonClassName()}
          disabled={Boolean(busyAction)}
          onClick={() => runAction("interstitial", async () => {
            await loadAdMobInterstitial();
            await showAdMobInterstitial({ currentPath: "/browse" });
          })}
        >
          <i className="bi bi-window-fullscreen" />
          Load/show interstitial test
        </button>
        <button
          type="button"
          className={getButtonClassName(featureSupport?.adInspector ? "outline-primary" : "outline-secondary")}
          disabled={Boolean(busyAction) || !featureSupport?.adInspector}
          onClick={() => runAction("ad-inspector", openAdMobAdInspector)}
        >
          <i className="bi bi-bug" />
          Launch Ad Inspector
        </button>
      </div>

      <div className="admob-debug-panel__meta">
        <strong>Last error</strong>
        <span>{lastErrorMessage}</span>
      </div>

      <div className="admob-debug-panel__events">
        {recentEvents.length === 0 ? (
          <span>No ad events yet</span>
        ) : (
          recentEvents.map((event) => (
            <div key={`${event.timestamp}-${event.message}`} className={`admob-debug-panel__event admob-debug-panel__event--${event.level}`}>
              <span>{event.message}</span>
              <small>{new Date(event.timestamp).toLocaleTimeString()}</small>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
