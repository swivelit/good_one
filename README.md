# good_one

GoodOne marketplace.

## Frontend production environment

`client/.env.production` is ignored by git, so do not rely on it being committed. Before final mobile builds, create it locally from `client/.env.production.example`, or set the same variables in the Render frontend environment:

```sh
REACT_APP_BACKEND_URL=https://good-one-api.onrender.com
REACT_APP_API_URL=https://good-one-api.onrender.com/api
REACT_APP_SUPPORT_EMAIL=goodone@swivelit.in
```

Replace `https://good-one-api.onrender.com` before production builds if the real Render backend URL is different. Do not put secrets in React environment files because they are bundled into the app.

React environment variables are public. `client/src/config.js` already falls back to `https://good-one-api.onrender.com` for production builds when these values are not set.

## Render backend deployment

- Root directory: `Backend`
- Build command: `npm ci && npx prisma generate`
- Pre-deploy command: `npx prisma migrate deploy`
- Start command: `npm start`
- Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `CLIENT_URLS`, `EMAIL_USER`, and `EMAIL_PASS`.
- Set `CLIENT_URLS=https://good-one-jlcu.onrender.com,capacitor://localhost,ionic://localhost,http://localhost,https://localhost` for the Render backend. Also include the real final frontend domain if it is different.

## Capacitor mobile apps

Android already exists at `client/android` and Capacitor Android 7 requires JDK 21 for Gradle builds. If your terminal still uses Java 17, switch `JAVA_HOME` to a JDK 21 install before running Gradle. iOS is generated when needed and requires a Mac, an Apple Developer account, and Xcode 26 or newer. Before iOS sync/archive, make sure `xcode-select` points to the full Xcode app and the Xcode license has been accepted.

The current Capacitor app id and Android package are `com.goodone.marketplace`. Finalize this before the first Play Store or App Store upload. If it needs to change, update `client/capacitor.config.json`, `client/android/app/build.gradle`, `client/android/app/src/main/res/values/strings.xml`, and the Xcode target Bundle Identifier.

Public policy routes are available without login:

- `/privacy`
- `/terms`
- `/account-deletion`

`client/public/app-ads.txt` is included for AdMob seller verification. This only
works if the deployed frontend domain is also set as the Google Play developer
website, because `app-ads.txt` must be available at the domain root.

### App icon assets

Web/PWA icons are declared in `client/public/manifest.json` and served from `client/public` assets. Native Android/iOS launcher icons are not read directly from `client/public/logo.png`; run `cd client && npm run assets:generate` to rebuild `client/resources/icon.png` from `public/logo.png` and then generate the Android `mipmap-*` launcher icons and iOS `AppIcon` assets.

## Android release signing

Do not commit Android keystores, `key.properties`, or signing passwords. Use `client/android/key.properties.example` as a local template for release signing values. The Android Gradle release signing config reads local `client/android/key.properties` only when that file exists.

Generate an upload key locally:

```sh
cd client/android
mkdir -p keystores
keytool -genkeypair \
  -v \
  -storetype JKS \
  -keystore keystores/goodone-upload-key.jks \
  -alias goodone-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Create `client/android/key.properties` from `client/android/key.properties.example`
and point it at the local upload key. Never commit `.jks`, `.keystore`,
`key.properties`, APK, AAB, or signing secrets.

Build signed release artifacts:

```sh
cd client
npm run build:android:release:apk
```

Or from the repository root:

```sh
bash scripts/build-android_release-apk.sh
```

Upload `dist/goodone-release.aab` to Google Play. Use
`dist/goodone-release.apk` for local QA only. Do not click live AdMob ads during
testing; use debug builds or configured test devices for ad testing.

Android is currently `versionCode 1` and `versionName 1.0`. Every future Play Store upload must increment `versionCode`.

## iOS release setup

iOS is currently `MARKETING_VERSION 1.0` and `CURRENT_PROJECT_VERSION 1`. Every future App Store upload must increment the iOS build number.

If this Mac is still pointed at Command Line Tools, run:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
cd client
npm run build
npx cap sync ios
npx cap open ios
```

To generate and open iOS:

```sh
cd client
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```

After `npx cap add ios`, add these permission descriptions to `client/ios/App/App/Info.plist`:

- `NSCameraUsageDescription`: `GoodOne needs camera access for vendor live photo verification.`
- `NSPhotoLibraryUsageDescription`: `GoodOne needs photo library access so vendors can upload product images.`

## Mobile release checklist

Android:

```sh
cd client
npm run build:android:release:apk
```

- Play upload artifact: `dist/goodone-release.aab`
- Local QA artifact: `dist/goodone-release.apk`

iOS:

```sh
cd client
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```

- In Xcode, use `Product > Archive > Distribute App`.

Store submission checklist:

- Signed Android AAB
- Apple archive uploaded from Xcode
- App icon
- Splash screen
- Screenshots
- Privacy policy URL
- Account deletion URL
- Support email
- Reviewer test account
- Google Data Safety
- Apple App Privacy
- Content rating
- Demo notes for reviewer

## Final Production Checklist

### Backend Render

- Root Directory: `Backend`
- Build Command: `npm ci && npx prisma generate`
- Pre-Deploy Command: `npx prisma migrate deploy`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Disk mount path: `/var/data`
- `UPLOAD_DIR=/var/data/uploads`

### Frontend Render

- Root Directory: `client`
- Build Command: `npm ci && npm run build`
- Publish Directory: `build`
- Rewrite: `/* -> /index.html`

### Testing

- Use `ENABLE_TEST_OTP=true` and `OTP_BYPASS_CODE=111111` only for temporary testing.
- Production must keep `ENABLE_TEST_OTP=false` and `OTP_BYPASS_CODE` blank/removed.
- Production smoke command:

```sh
CUSTOMER_EMAIL=<email> CUSTOMER_PASSWORD=<password> VENDOR_EMAIL=<email> VENDOR_PASSWORD=<password> API_BASE_URL=https://good-one-api.onrender.com/api FRONTEND_URL=https://good-one-jlcu.onrender.com npm run test:prod-smoke
```
