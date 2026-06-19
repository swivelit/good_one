package com.goodone.marketplace;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Resources;
import android.os.Bundle;
import android.os.SystemClock;

import androidx.test.platform.app.InstrumentationRegistry;

import com.facebook.FacebookSdk;

import org.junit.Test;

import java.util.Locale;

public class MetaSdkInstrumentedTest {
    private static final String APPLICATION_ID_KEY = "com.facebook.sdk.ApplicationId";
    private static final String CLIENT_TOKEN_KEY = "com.facebook.sdk.ClientToken";
    private static final String AUTO_INIT_KEY = "com.facebook.sdk.AutoInitEnabled";
    private static final String AUTO_LOG_APP_EVENTS_KEY = "com.facebook.sdk.AutoLogAppEventsEnabled";
    private static final String ADVERTISER_ID_COLLECTION_KEY =
        "com.facebook.sdk.AdvertiserIDCollectionEnabled";

    @Test
    public void metaSdkManifestMetadataIsConfiguredAndSdkInitializes() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ApplicationInfo applicationInfo = context.getPackageManager().getApplicationInfo(
            context.getPackageName(),
            PackageManager.GET_META_DATA
        );
        Bundle metadata = applicationInfo.metaData;

        assertNotNull("Android manifest metadata should be available.", metadata);
        assertTrue("Meta ApplicationId metadata should exist.", metadata.containsKey(APPLICATION_ID_KEY));
        assertTrue("Meta ClientToken metadata should exist.", metadata.containsKey(CLIENT_TOKEN_KEY));

        String appId = resolveStringMetadata(context, metadata, APPLICATION_ID_KEY);
        assertTrue("Meta App ID should be numeric.", appId.matches("\\d+"));
        assertFalse("Meta App ID should not be the documented placeholder.",
            "123456789012345".equals(appId));
        assertFalse("Meta App ID should not be all zeroes.", appId.matches("0+"));

        String clientToken = resolveStringMetadata(context, metadata, CLIENT_TOKEN_KEY);
        assertFalse("Meta client token should be configured.", clientToken.isEmpty());
        assertFalse("Meta client token should not be a placeholder.",
            isPlaceholderValue(clientToken));

        assertTrue("Meta SDK automatic initialization should be enabled.",
            resolveBooleanMetadata(context, metadata, AUTO_INIT_KEY));
        assertEquals(
            "Meta automatic app event flag should match generated resources.",
            context.getResources().getBoolean(R.bool.facebook_auto_log_app_events_enabled),
            resolveBooleanMetadata(context, metadata, AUTO_LOG_APP_EVENTS_KEY)
        );
        assertEquals(
            "Meta advertiser-ID collection flag should match generated resources.",
            context.getResources().getBoolean(R.bool.facebook_advertiser_id_collection_enabled),
            resolveBooleanMetadata(context, metadata, ADVERTISER_ID_COLLECTION_KEY)
        );

        long deadline = SystemClock.uptimeMillis() + 5000L;
        while (!FacebookSdk.isInitialized() && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100L);
        }
        assertTrue("Meta SDK should initialize automatically after app startup.",
            FacebookSdk.isInitialized());
    }

    private static String resolveStringMetadata(Context context, Bundle metadata, String key) {
        Object rawValue = metadata.get(key);
        assertNotNull(key + " metadata should resolve to a value.", rawValue);

        if (rawValue instanceof Integer) {
            try {
                return context.getString((Integer) rawValue).trim();
            } catch (Resources.NotFoundException ignored) {
                return String.valueOf(rawValue).trim();
            }
        }

        return String.valueOf(rawValue).trim();
    }

    private static boolean resolveBooleanMetadata(Context context, Bundle metadata, String key) {
        Object rawValue = metadata.get(key);
        assertNotNull(key + " metadata should resolve to a value.", rawValue);

        if (rawValue instanceof Boolean) {
            return (Boolean) rawValue;
        }

        if (rawValue instanceof Integer) {
            try {
                return context.getResources().getBoolean((Integer) rawValue);
            } catch (Resources.NotFoundException ignored) {
                return ((Integer) rawValue) != 0;
            }
        }

        String normalized = String.valueOf(rawValue).trim().toLowerCase(Locale.ROOT);
        if ("true".equals(normalized)) return true;
        if ("false".equals(normalized)) return false;

        fail(key + " metadata should resolve to true or false.");
        return false;
    }

    private static boolean isPlaceholderValue(String value) {
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ||
            normalized.contains("replace") ||
            normalized.contains("placeholder") ||
            normalized.contains("example");
    }
}
