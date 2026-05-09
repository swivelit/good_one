package com.goodone.marketplace;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final String GOODONE_SAFE_AREA_CHANGE_EVENT = "goodone:native-safe-area-change";
    private static final int STATUS_BAR_COLOR = Color.rgb(17, 24, 39);
    private static final int APP_WINDOW_BACKGROUND_COLOR = Color.WHITE;

    private Insets lastSafeAreaInsets = Insets.of(0, 0, 0, 0);
    private View adMobInsetGuardRoot;
    private ViewTreeObserver.OnGlobalLayoutListener adMobInsetGuardLayoutListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        configureEdgeToEdgeWindow();
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                configureWebView(webView);
                injectSafeAreaInsetsCss(webView, lastSafeAreaInsets);
            }
        });

        super.onCreate(savedInstanceState);

        configureEdgeToEdgeWindow();
        installSafeAreaInsetsBridge();
        installAdMobInsetGuard();
    }

    @Override
    public void onDestroy() {
        uninstallAdMobInsetGuard();
        super.onDestroy();
    }

    private void configureEdgeToEdgeWindow() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setBackgroundDrawable(new ColorDrawable(APP_WINDOW_BACKGROUND_COLOR));
        window.getDecorView().setBackgroundColor(APP_WINDOW_BACKGROUND_COLOR);
        window.setStatusBarColor(STATUS_BAR_COLOR);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.setNavigationBarDividerColor(Color.TRANSPARENT);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            window,
            window.getDecorView()
        );
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(true);
    }

    private void configureWebView(WebView webView) {
        if (webView == null) return;

        webView.setBackgroundColor(APP_WINDOW_BACKGROUND_COLOR);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            webView.getSettings().setForceDark(WebSettings.FORCE_DARK_OFF);
        }
    }

    private void installSafeAreaInsetsBridge() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;

        configureWebView(webView);

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            lastSafeAreaInsets = insets;
            injectSafeAreaInsetsCss(webView, insets);
            applyAdMobBannerBottomInset(insets.bottom);
            return windowInsets;
        });

        webView.post(() -> {
            WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(webView);
            if (rootInsets != null) {
                lastSafeAreaInsets = rootInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
            }
            injectSafeAreaInsetsCss(webView, lastSafeAreaInsets);
            applyAdMobBannerBottomInset(lastSafeAreaInsets.bottom);
            ViewCompat.requestApplyInsets(webView);
        });
    }

    private void injectSafeAreaInsetsCss(WebView webView, Insets insets) {
        if (webView == null) return;

        int rawTop = pxToCssPx(insets.top);
        int top = pxToCssPx(getUnconsumedTopInsetPx(webView, insets.top));
        int right = pxToCssPx(insets.right);
        int bottom = pxToCssPx(insets.bottom);
        int left = pxToCssPx(insets.left);

        String script = String.format(Locale.US,
            "(function(){var r=document.documentElement;if(!r)return;var s=r.style;" +
                "s.setProperty('--safe-area-inset-top','%1$dpx');" +
                "s.setProperty('--safe-area-inset-right','%2$dpx');" +
                "s.setProperty('--safe-area-inset-bottom','%3$dpx');" +
                "s.setProperty('--safe-area-inset-left','%4$dpx');" +
                "s.setProperty('--goodone-raw-safe-area-inset-top','%5$dpx');" +
                "window.dispatchEvent(new CustomEvent('%6$s',{detail:{top:%1$d,right:%2$d,bottom:%3$d,left:%4$d}}));" +
            "})();",
            top,
            right,
            bottom,
            left,
            rawTop,
            GOODONE_SAFE_AREA_CHANGE_EVENT
        );

        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private int getUnconsumedTopInsetPx(WebView webView, int rawTopInsetPx) {
        if (webView == null || rawTopInsetPx <= 0) return Math.max(0, rawTopInsetPx);

        int[] location = new int[2];
        webView.getLocationOnScreen(location);
        int webViewTopOnScreenPx = Math.max(0, location[1]);

        if (webViewTopOnScreenPx >= rawTopInsetPx - 2) {
            return 0;
        }

        return Math.max(0, rawTopInsetPx - webViewTopOnScreenPx);
    }

    private int pxToCssPx(int px) {
        float density = getResources().getDisplayMetrics().density;
        if (density <= 0) return px;
        return Math.max(0, Math.round(px / density));
    }

    private void installAdMobInsetGuard() {
        View contentRoot = findViewById(android.R.id.content);
        if (contentRoot == null) return;

        adMobInsetGuardRoot = contentRoot;
        adMobInsetGuardLayoutListener = () -> applyAdMobBannerBottomInset(lastSafeAreaInsets.bottom);
        contentRoot.getViewTreeObserver().addOnGlobalLayoutListener(adMobInsetGuardLayoutListener);
    }

    private void uninstallAdMobInsetGuard() {
        if (adMobInsetGuardRoot == null || adMobInsetGuardLayoutListener == null) return;

        ViewTreeObserver observer = adMobInsetGuardRoot.getViewTreeObserver();
        if (observer.isAlive()) {
            observer.removeOnGlobalLayoutListener(adMobInsetGuardLayoutListener);
        }
        adMobInsetGuardRoot = null;
        adMobInsetGuardLayoutListener = null;
    }

    private void applyAdMobBannerBottomInset(int bottomInsetPx) {
        View contentRoot = findViewById(android.R.id.content);
        if (contentRoot instanceof ViewGroup) {
            applyAdMobBannerBottomInset((ViewGroup) contentRoot, Math.max(0, bottomInsetPx));
        }
    }

    private void applyAdMobBannerBottomInset(ViewGroup group, int bottomInsetPx) {
        boolean hasDirectAdViewChild = false;

        for (int index = 0; index < group.getChildCount(); index += 1) {
            View child = group.getChildAt(index);
            if (isGoogleAdView(child)) {
                hasDirectAdViewChild = true;
            } else if (child instanceof ViewGroup) {
                applyAdMobBannerBottomInset((ViewGroup) child, bottomInsetPx);
            }
        }

        if (!hasDirectAdViewChild) return;

        ViewGroup.LayoutParams layoutParams = group.getLayoutParams();
        if (!(layoutParams instanceof ViewGroup.MarginLayoutParams)) return;

        ViewGroup.MarginLayoutParams marginLayoutParams = (ViewGroup.MarginLayoutParams) layoutParams;
        if (marginLayoutParams.bottomMargin == bottomInsetPx) return;

        marginLayoutParams.bottomMargin = bottomInsetPx;
        group.setLayoutParams(marginLayoutParams);
    }

    private boolean isGoogleAdView(View view) {
        return view != null && "com.google.android.gms.ads.AdView".equals(view.getClass().getName());
    }
}
