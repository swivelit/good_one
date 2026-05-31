# Android AdMob QA

GoodOne uses `@capacitor-community/admob` through the native Capacitor Android app.

## Current Code Setup

- Plugin: `@capacitor-community/admob` `^7.2.0`
- Native Android AdMob app IDs:
  - Debug manifest placeholder: Google demo app ID
  - Release manifest placeholder: GoodOne production app ID
- Existing production banner ad unit was previously hardcoded in `client/src/services/admob.js`; production ad unit IDs now come from environment variables.
- Supported by the installed plugin: bottom banner, interstitial, rewarded, rewarded interstitial.
- Not exposed by the installed plugin: app-open ads, native feed ads inside the React WebView, direct Ad Inspector launcher.
- The floating GoodOne video is a local promo video. It is not AdMob inventory and does not earn AdMob revenue.

## Demo Ads

Use demo ads for debug and local QA:

```bash
cd client
REACT_APP_USE_ADMOB_TEST_ADS=true npm run build:android:debug
npm run install:android:debug
```

If `REACT_APP_USE_ADMOB_TEST_ADS` is not exactly `false`, the app uses Google demo ad units. Local and Jest/test builds also stay in test mode even if the env var is accidentally set to `false`.

Google demo Android units used by code:

- Banner: `ca-app-pub-3940256099942544/6300978111`
- App-open config placeholder: `ca-app-pub-3940256099942544/9257395921` (not shown because the plugin lacks app-open APIs)
- Interstitial: `ca-app-pub-3940256099942544/1033173712`
- Rewarded: `ca-app-pub-3940256099942544/5224354917`

Never click your own live ads. Use demo ads, test devices, and AdMob diagnostics instead.

## Production Release Env File

Release/prod mode only uses production ad units when:

```bash
REACT_APP_USE_ADMOB_TEST_ADS=false
```

The release build script loads production ad unit IDs from a private local file:

```bash
cp client/.env.admob.release.example client/.env.admob.release.local
```

Edit `client/.env.admob.release.local`:

```bash
REACT_APP_ADMOB_ANDROID_BANNER_ID=ca-app-pub-.../...
REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-.../...
# Optional only if implemented:
# REACT_APP_ADMOB_ANDROID_REWARDED_ID=
# REACT_APP_ADMOB_ANDROID_APP_OPEN_ID=
```

`client/.env.admob.release.local` is gitignored. Do not commit real production ad unit IDs.

Required release IDs:

- `REACT_APP_ADMOB_ANDROID_BANNER_ID`
- `REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID` while interstitial support is enabled in `client/src/services/admob.js`

Rewarded and app-open IDs are optional today. App-open is still skipped with the current plugin because there is no app-open API to call.

## Test Devices

For real-device QA with test mode, pass test device IDs through env:

```bash
export REACT_APP_ADMOB_TEST_DEVICE_IDS="DEVICE_ID_1,DEVICE_ID_2"
```

These IDs are only sent to the plugin when test ads are enabled. Do not hardcode personal device IDs into the repo.

To find and register a test device:

1. Install a debug build with demo/test mode.
2. Watch Android logs:

   ```bash
   cd client
   npm run logs:android:admob
   ```

3. Use the test-device ID shown by Google Mobile Ads logs.
4. Add the device in AdMob Console under test devices.

Debug builds use Google demo ad units and should not require live ads or production ad unit IDs for QA.

## Debug Panel

The internal AdMob debug panel is mounted by `client/src/components/AdMobDebugPanel.js`.

It appears only when one of these is true:

- `NODE_ENV === "development"`
- a production bundle is built with test ads enabled
- `localStorage.GOODONE_ADMOB_DEBUG === "true"`

The panel shows platform, test mode, masked ad unit config, last error, recent ad events, and buttons for:

- Initialize AdMob
- Show banner test
- Hide banner
- Load/show interstitial test
- Launch Ad Inspector if the plugin exposes an inspector launcher

The installed `@capacitor-community/admob` version does not expose an Ad Inspector launcher, so the button remains disabled. Use the normal AdMob test-device and logcat workflow until the plugin supports it or a native bridge is intentionally added.

## Expected Banner Layout

The bottom banner is a native Android overlay. React reserves space using `--goodone-admob-banner-height`, updates it from the AdMob `SizeChanged` event, and keeps the GoodOne bottom tabs above the banner.

Expected order from top to bottom:

1. GoodOne content
2. GoodOne bottom tabs
3. Google AdMob banner
4. Android gesture/navigation area

Useful logs:

```bash
cd client
npm run logs:android:admob
```

Look for `[AdMob] initialize requested`, `[AdMob] banner request`, `[AdMob] banner loaded`, `[AdMob] banner size changed`, and `LoadAdError`.

## Interstitial Policy

Interstitial support is code-ready but guarded:

- No interstitial on app launch.
- No interstitial on app exit.
- No interstitial on login, registration, product posting, or chat routes.
- Product-detail return trigger: after every 5th product detail view, when returning to browse.
- Vendor posting trigger: after successful listing creation when the vendor lands back on dashboard.
- Cooldown: at least 3 minutes.
- Daily cap: 3 interstitials per user per day.
- Failures do not block navigation.

## Rewarded Policy

Rewarded ads are available only as a service method. There is no user-facing rewarded UI yet because GoodOne does not currently have a backend-supported reward or ranking feature to grant.

Only add rewarded UI when the user knowingly opts in and the reward is real. Do not promise marketplace ranking boosts unless the backend implements them.

## App-Open Ads

The service includes app-open cooldown policy helpers, but the installed plugin does not expose app-open load/show APIs. Do not fake app-open ads with interstitials.

If a future plugin version adds app-open support, keep these rules:

- Cold start or resume after a long cooldown only.
- Default cooldown: 4 hours.
- Do not show during login, registration, product posting, chat, or sensitive flows.

## Inline/Feed Ads

The current plugin renders banners as native overlays, not inline React elements inside the WebView. Do not fake native ads with product-card-like UI. Inline feed ads should wait for a real supported native/inline ad format.

## Floating Local Video

`client/src/components/AppVideoManager.js` can show a small local GoodOne promo video only when explicitly enabled:

```js
localStorage.setItem("GOODONE_LOCAL_VIDEO_AD", "true")
```

or:

```bash
REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD=true
```

It is disabled by default to avoid confusing it with AdMob revenue or covering active marketplace tasks.

## Mediation Readiness

Code-side:

- The plugin uses Google Mobile Ads SDK and can work with AdMob mediation when adapters are present in the native project.
- No third-party mediation adapters are currently added in `client/android/app/build.gradle`.
- Do not add random ad network SDKs without confirmed network choices, app IDs, adapter versions, and credentials.

AdMob-console-side:

- Create mediation groups.
- Choose networks and configure credentials.
- Follow each network's adapter setup instructions.
- Add required adapter dependencies only after the mediation plan is known.
- Test through demo/test devices and logs.

## Manual AdMob Console Tasks

These are not solved in React/Capacitor code:

- Update sellers.json setting.
- Create mediation groups and add chosen ad networks.
- Add test devices in AdMob.
- Check Policy center.
- Check and publish app-ads.txt for the app domain.
- Link Firebase if not already linked.
- Review app readiness and ad serving limitations.

## Release Build

From repo root:

```bash
./scripts/build-android_release-apk.sh
```

The script loads `client/.env.admob.release.local`, then forces:

```bash
REACT_APP_USE_ADMOB_TEST_ADS=false
```

Confirm the banner and interstitial IDs are loaded by checking the script output. It prints masked values only, for example:

```text
REACT_APP_ADMOB_ANDROID_BANNER_ID=ca-app-pub-****1234/****5678
REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID=ca-app-pub-****1234/****9012
```

The release script fails before building if required production IDs are missing. Do not upload this AAB if required production AdMob IDs are missing. Never click your own live ads; use debug builds, test devices, and AdMob logs for QA.
