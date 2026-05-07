# Android AdMob QA

Use this flow when the banner is not visible on a real phone.

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

Expected layout on the phone:

- the Google test banner sits at the physical bottom of the app WebView
- the GoodOne bottom tab bar sits directly above the banner
- the banner must not cover the Browse / Chat / Profile tabs
- the floating video popup must stay above both the bottom tab bar and the banner

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
- `Ad ID:`
- `LoadAdError`

If you see `No fill`, test again with the debug APK/demo IDs. If you see `Invalid request` or `App Id Missing`, check the manifest placeholder and app ID.

## Production APK/AAB

Only release builds should use:

- GoodOne Android AdMob app ID: `ca-app-pub-9859771616835832~9892448873`
- GoodOne Android banner ad unit: `ca-app-pub-9859771616835832/2509706314`

Build release only after the debug demo banner is visible on a phone.
