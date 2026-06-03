# good_one

GoodOne marketplace.

## Frontend production environment

`client/.env.production` is ignored by git, so do not rely on it being committed. Before final mobile builds, create it locally from `client/.env.production.example`, or set the same variables in the Render frontend environment:

```sh
REACT_APP_BACKEND_URL=https://good-one-api.onrender.com
REACT_APP_API_URL=https://good-one-api.onrender.com/api
REACT_APP_PUBLIC_WEB_URL=https://good-one-jlcu.onrender.com
REACT_APP_SUPPORT_EMAIL=goodone@swivelit.in
```

Replace `https://good-one-api.onrender.com` before production builds if the real Render backend URL is different. Do not put secrets in React environment files because they are bundled into the app.

React environment variables are public. `client/src/config.js` already falls back to `https://good-one-api.onrender.com` for production backend builds and `https://good-one-jlcu.onrender.com` for public share links when these values are not set.

## Render backend deployment

- Root directory: `Backend`
- Build command: `npm ci && npx prisma generate`
- Pre-deploy command: `npx prisma migrate deploy`
- Start command: `npm start`
- Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `CLIENT_URLS`, `EMAIL_USER`, and `EMAIL_PASS`.
- Chat push notifications require `FIREBASE_SERVICE_ACCOUNT_JSON` in Render/local backend env, or a valid `GOOGLE_APPLICATION_CREDENTIALS` path. Do not commit Firebase service account JSON.
- Set `CLIENT_URLS=https://good-one-jlcu.onrender.com,capacitor://localhost,ionic://localhost,http://localhost,https://localhost` for the Render backend. Also include the real final frontend domain if it is different.

## Capacitor mobile apps

Android already exists at `client/android` and Capacitor Android 7 requires JDK 21 for Gradle builds. If your terminal still uses Java 17, switch `JAVA_HOME` to a JDK 21 install before running Gradle. iOS is generated when needed. Simulator builds require macOS, Xcode 26 or newer, and CocoaPods, but do not require Apple Developer Program payment or signing. Signed iOS device/archive builds require Apple signing; TestFlight and App Store distribution require Apple Developer Program membership. Before iOS sync/build/archive, make sure `xcode-select` points to the full Xcode app and the Xcode license has been accepted.

The current Capacitor app id and Android package are `com.goodone.marketplace`. Finalize this before the first Play Store or App Store upload. If it needs to change, update `client/capacitor.config.json`, `client/android/app/build.gradle`, `client/android/app/src/main/res/values/strings.xml`, and the Xcode target Bundle Identifier.

Android push notifications require `client/android/app/google-services.json` from Firebase for package `com.goodone.marketplace`. Without that file and backend Firebase credentials, the app and server still build and run, but real device push notifications cannot be delivered.

### Android App Links

Product and vendor sharing must stay on normal HTTPS URLs, for example `https://good-one-jlcu.onrender.com/products/<id>` and `https://good-one-jlcu.onrender.com/vendors/<id>`. Android App Links let those same HTTPS links open the installed GoodOne Android app; when the app is not installed, the website fallback is expected.

The Digital Asset Links file is committed at `client/public/.well-known/assetlinks.json` and must be publicly available after frontend deploy at:

```sh
https://good-one-jlcu.onrender.com/.well-known/assetlinks.json
```

For Play Store builds, use the Play App Signing SHA-256 fingerprint from Play Console, not only the local upload key fingerprint. SHA-256 certificate fingerprints are public identifiers, not secrets. Validate the committed file with:

```sh
cd client
npm run app-links:validate
```

After deploying the frontend, verify the URL returns JSON and not the React `index.html` fallback:

```sh
curl -i https://good-one-jlcu.onrender.com/.well-known/assetlinks.json
```

Existing Play Store users need an app update containing the AndroidManifest App Link intent filters before shared product and vendor links can open the installed app.

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

For local iOS build verification without Apple Developer Program payment or signing, use the simulator build:

```sh
cd client
npm run build:ios:simulator
```

For signed release, TestFlight, or App Store archive builds, provide your own Apple Team ID from the repository root:

```sh
IOS_TEAM_ID=YOUR_TEAM_ID REACT_APP_USE_ADMOB_TEST_ADS=false ./scripts/build-ios-archive.sh
```

Do not commit Apple Team IDs, certificates, provisioning profiles, private keys, or Apple accounts. Apple signing and Developer Program payment requirements are Apple platform requirements, not GoodOne code issues. A free Apple Account with Xcode Personal Team can be used for limited personal device testing, but not for TestFlight or App Store distribution.

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
npm run build:ios:simulator
```

- Local simulator verification uses no Apple Developer Program payment and no signing.
- For TestFlight/App Store, run `IOS_TEAM_ID=YOUR_TEAM_ID REACT_APP_USE_ADMOB_TEST_ADS=false ./scripts/build-ios-archive.sh` from the repository root, then distribute the signed archive from Xcode.

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
