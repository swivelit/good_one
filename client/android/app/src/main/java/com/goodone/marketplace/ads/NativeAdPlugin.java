package com.goodone.marketplace.ads;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.goodone.marketplace.R;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {
    private static final String EVENT_LOADED = "nativeAdLoaded";
    private static final String EVENT_FAILED_TO_LOAD = "nativeAdFailedToLoad";
    private static final String EVENT_SHOWN = "nativeAdShown";
    private static final String EVENT_HIDDEN = "nativeAdHidden";

    private final Map<String, NativeAdSlot> slots = new HashMap<>();

    @PluginMethod
    public void create(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        final String adId = getRequiredString(call, "adId");
        if (slotId == null || adId == null) return;

        runOnUiThread(() -> {
            try {
                destroySlot(slotId);

                FrameLayout overlayRoot = getOverlayRoot();
                if (overlayRoot == null) {
                    call.reject("Unable to find Android content root for native ad");
                    return;
                }

                NativeAdView adView = (NativeAdView) LayoutInflater
                    .from(getContext())
                    .inflate(R.layout.goodone_native_ad_view, overlayRoot, false);
                NativeAdSlot slot = new NativeAdSlot(slotId, adId, adView);
                applyFrameFromCall(slot, call);
                adView.setVisibility(View.INVISIBLE);
                overlayRoot.addView(adView, buildLayoutParams(slot));
                slots.put(slotId, slot);

                call.resolve(slotResult(slot));
            } catch (Exception error) {
                call.reject("Unable to create native ad slot", error);
            }
        });
    }

    @PluginMethod
    public void load(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        if (slotId == null) return;

        runOnUiThread(() -> {
            final NativeAdSlot slot = slots.get(slotId);
            if (slot == null) {
                call.reject("Native ad slot does not exist");
                return;
            }

            String adId = call.getString("adId", slot.adId);
            slot.adId = adId;

            AdLoader adLoader = new AdLoader.Builder(getContext(), adId)
                .forNativeAd(nativeAd -> runOnUiThread(() -> {
                    NativeAdSlot currentSlot = slots.get(slotId);
                    if (currentSlot != slot) {
                        nativeAd.destroy();
                        call.reject("Native ad slot was destroyed before load completed");
                        return;
                    }

                    if (currentSlot.nativeAd != null) {
                        currentSlot.nativeAd.destroy();
                    }

                    currentSlot.nativeAd = nativeAd;
                    currentSlot.loaded = true;
                    populateNativeAdView(currentSlot.adView, nativeAd);
                    updateVisibility(currentSlot);

                    JSObject result = slotResult(currentSlot);
                    notifyListeners(EVENT_LOADED, result);
                    call.resolve(result);
                }))
                .withNativeAdOptions(new NativeAdOptions.Builder()
                    .setAdChoicesPlacement(NativeAdOptions.ADCHOICES_TOP_RIGHT)
                    .build())
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                        runOnUiThread(() -> {
                            NativeAdSlot currentSlot = slots.get(slotId);
                            if (currentSlot != null) {
                                currentSlot.loaded = false;
                                currentSlot.showRequested = false;
                                updateVisibility(currentSlot);
                            }

                            JSObject data = new JSObject();
                            data.put("slotId", slotId);
                            data.put("code", loadAdError.getCode());
                            data.put("domain", loadAdError.getDomain());
                            data.put("message", loadAdError.getMessage());
                            notifyListeners(EVENT_FAILED_TO_LOAD, data);
                            call.reject("Native ad failed to load", String.valueOf(loadAdError.getCode()), data);
                        });
                    }
                })
                .build();

            adLoader.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void show(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        if (slotId == null) return;

        runOnUiThread(() -> {
            NativeAdSlot slot = slots.get(slotId);
            if (slot == null) {
                call.reject("Native ad slot does not exist");
                return;
            }

            applyFrameFromCall(slot, call);
            applyLayoutParams(slot);
            slot.showRequested = true;
            updateVisibility(slot);

            JSObject result = slotResult(slot);
            notifyListeners(EVENT_SHOWN, result);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void updatePosition(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        if (slotId == null) return;

        runOnUiThread(() -> {
            NativeAdSlot slot = slots.get(slotId);
            if (slot == null) {
                call.resolve();
                return;
            }

            applyFrameFromCall(slot, call);
            applyLayoutParams(slot);
            updateVisibility(slot);
            call.resolve(slotResult(slot));
        });
    }

    @PluginMethod
    public void hide(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        if (slotId == null) return;

        runOnUiThread(() -> {
            NativeAdSlot slot = slots.get(slotId);
            if (slot == null) {
                call.resolve();
                return;
            }

            slot.showRequested = false;
            updateVisibility(slot);
            JSObject result = slotResult(slot);
            notifyListeners(EVENT_HIDDEN, result);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void destroy(final PluginCall call) {
        final String slotId = getRequiredString(call, "slotId");
        if (slotId == null) return;

        runOnUiThread(() -> {
            destroySlot(slotId);
            JSObject result = new JSObject();
            result.put("slotId", slotId);
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnDestroy() {
        runOnUiThread(() -> {
            for (String slotId : slots.keySet().toArray(new String[0])) {
                destroySlot(slotId);
            }
        });
        super.handleOnDestroy();
    }

    private void populateNativeAdView(NativeAdView adView, NativeAd nativeAd) {
        MediaView mediaView = adView.findViewById(R.id.goodone_native_ad_media);
        TextView headlineView = adView.findViewById(R.id.goodone_native_ad_headline);
        TextView bodyView = adView.findViewById(R.id.goodone_native_ad_body);
        Button callToActionView = adView.findViewById(R.id.goodone_native_ad_call_to_action);
        ImageView iconView = adView.findViewById(R.id.goodone_native_ad_icon);
        TextView advertiserView = adView.findViewById(R.id.goodone_native_ad_advertiser);

        adView.setMediaView(mediaView);
        adView.setHeadlineView(headlineView);
        adView.setBodyView(bodyView);
        adView.setCallToActionView(callToActionView);
        adView.setIconView(iconView);
        adView.setAdvertiserView(advertiserView);

        headlineView.setText(nativeAd.getHeadline());

        if (nativeAd.getMediaContent() != null) {
            mediaView.setMediaContent(nativeAd.getMediaContent());
            mediaView.setVisibility(View.VISIBLE);
        } else {
            mediaView.setVisibility(View.INVISIBLE);
        }

        if (nativeAd.getBody() == null) {
            bodyView.setVisibility(View.INVISIBLE);
        } else {
            bodyView.setText(nativeAd.getBody());
            bodyView.setVisibility(View.VISIBLE);
        }

        if (nativeAd.getCallToAction() == null) {
            callToActionView.setVisibility(View.INVISIBLE);
        } else {
            callToActionView.setText(nativeAd.getCallToAction());
            callToActionView.setVisibility(View.VISIBLE);
        }

        NativeAd.Image icon = nativeAd.getIcon();
        if (icon == null) {
            iconView.setVisibility(View.GONE);
        } else {
            iconView.setImageDrawable(icon.getDrawable());
            iconView.setVisibility(View.VISIBLE);
        }

        if (nativeAd.getAdvertiser() == null) {
            advertiserView.setVisibility(View.GONE);
        } else {
            advertiserView.setText(nativeAd.getAdvertiser());
            advertiserView.setVisibility(View.VISIBLE);
        }

        adView.setNativeAd(nativeAd);
    }

    private void updateVisibility(NativeAdSlot slot) {
        slot.adView.setVisibility(
            slot.loaded && slot.showRequested && slot.viewportVisible
                ? View.VISIBLE
                : View.INVISIBLE
        );
    }

    private void applyFrameFromCall(NativeAdSlot slot, PluginCall call) {
        double scale = getDouble(call, "scale", slot.scale);
        slot.scale = scale > 0 ? scale : 1.0;
        slot.xPx = cssPxToPhysicalPx(getDouble(call, "x", slot.xPx / slot.scale), slot.scale);
        slot.yPx = cssPxToPhysicalPx(getDouble(call, "y", slot.yPx / slot.scale), slot.scale);
        slot.widthPx = Math.max(1, cssPxToPhysicalPx(getDouble(call, "width", slot.widthPx / slot.scale), slot.scale));
        slot.heightPx = Math.max(1, cssPxToPhysicalPx(getDouble(call, "height", slot.heightPx / slot.scale), slot.scale));

        Boolean visible = call.getBoolean("visible");
        if (visible != null) {
            slot.viewportVisible = visible;
        }
    }

    private FrameLayout.LayoutParams buildLayoutParams(NativeAdSlot slot) {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(slot.widthPx, slot.heightPx);
        params.leftMargin = slot.xPx;
        params.topMargin = slot.yPx;
        return params;
    }

    private void applyLayoutParams(NativeAdSlot slot) {
        ViewGroup.LayoutParams existingParams = slot.adView.getLayoutParams();
        FrameLayout.LayoutParams params = existingParams instanceof FrameLayout.LayoutParams
            ? (FrameLayout.LayoutParams) existingParams
            : buildLayoutParams(slot);

        params.width = slot.widthPx;
        params.height = slot.heightPx;
        params.leftMargin = slot.xPx;
        params.topMargin = slot.yPx;
        slot.adView.setLayoutParams(params);
    }

    private int cssPxToPhysicalPx(double cssPx, double scale) {
        return (int) Math.round(cssPx * scale);
    }

    private double getDouble(PluginCall call, String name, double defaultValue) {
        Double value = call.getDouble(name);
        return value == null ? defaultValue : value;
    }

    private String getRequiredString(PluginCall call, String name) {
        String value = call.getString(name);
        if (value == null || value.trim().isEmpty()) {
            call.reject(name + " is required");
            return null;
        }
        return value.trim();
    }

    private FrameLayout getOverlayRoot() {
        Activity activity = getActivity();
        if (activity == null) return null;

        View contentRoot = activity.findViewById(android.R.id.content);
        return contentRoot instanceof FrameLayout ? (FrameLayout) contentRoot : null;
    }

    private void destroySlot(String slotId) {
        NativeAdSlot slot = slots.remove(slotId);
        if (slot == null) return;

        if (slot.nativeAd != null) {
            slot.nativeAd.destroy();
            slot.nativeAd = null;
        }

        ViewGroup parent = (ViewGroup) slot.adView.getParent();
        if (parent != null) {
            parent.removeView(slot.adView);
        }
    }

    private JSObject slotResult(NativeAdSlot slot) {
        JSObject result = new JSObject();
        result.put("slotId", slot.slotId);
        result.put("loaded", slot.loaded);
        result.put("visible", slot.adView.getVisibility() == View.VISIBLE);
        result.put("x", slot.xPx);
        result.put("y", slot.yPx);
        result.put("width", slot.widthPx);
        result.put("height", slot.heightPx);
        return result;
    }

    private void runOnUiThread(Runnable runnable) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(runnable);
    }

    private static final class NativeAdSlot {
        private final String slotId;
        private final NativeAdView adView;
        private String adId;
        private NativeAd nativeAd;
        private boolean loaded = false;
        private boolean showRequested = false;
        private boolean viewportVisible = true;
        private double scale = 1.0;
        private int xPx = 0;
        private int yPx = 0;
        private int widthPx = 1;
        private int heightPx = 1;

        private NativeAdSlot(String slotId, String adId, NativeAdView adView) {
            this.slotId = slotId;
            this.adId = adId;
            this.adView = adView;
        }
    }
}
