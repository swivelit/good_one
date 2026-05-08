# Android AdMob QA

Use this flow when the banner is not visible or when it overlaps the app UI on a real phone.

## Build and install the debug APK with Google demo ads

```bash
cd client
npm run build:android:debug
npm run install:android:debug
```

The debug APK uses:

- Google demo AdMob app ID: `ca-app-pub-3940256099942544~3347511713`
- Google demo Android banner ad unit: `ca-app-pub-3940256099942544/6300978111`

Wait until the 10-second full-screen video finishes. The banner request starts after that.

## Expected layout

The native AdMob banner is an Android overlay, not a React element. The app now reserves space for the actual banner height and resizes the React WebView content area around it.

Expected order from top to bottom:

1. GoodOne app content inside a scrollable native app shell
2. GoodOne bottom tabs: Browse / Chat / Profile
3. Google test ad banner
4. Android gesture/navigation area

The page content should not scroll behind the GoodOne bottom tabs or the Google banner. If the banner height changes, the app updates the CSS variable `--goodone-admob-banner-height` from the AdMob `SizeChanged` event.

## Watch AdMob logs

In another terminal:

```bash
cd client
npm run logs:android:admob
```

Look for:

- `[AdMob] test banner request`
- `[AdMob] banner loaded`
- `[AdMob] banner load failed`
- `[AdMob] banner size changed`
- `Ad ID:`
- `LoadAdError`

If you see `No fill`, test again with the debug APK/demo IDs. If you see `Invalid request` or `App Id Missing`, check the manifest placeholder and app ID.

## Production APK/AAB

Only release builds should use:

- GoodOne Android AdMob app ID: `ca-app-pub-9859771616835832~9892448873`
- GoodOne Android banner ad unit: `ca-app-pub-9859771616835832/2509706314`

Build release only after the debug demo banner is visible on a phone and the tabs/content no longer overlap it.
