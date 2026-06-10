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

AdMob test ads stay enabled by default for local debug, simulator, and device testing with `REACT_APP_USE_ADMOB_TEST_ADS=true`. For approved production release builds only, set `REACT_APP_USE_ADMOB_TEST_ADS=false` and provide the platform-specific production unit IDs, for example `REACT_APP_ADMOB_ANDROID_BANNER_ID` and `REACT_APP_ADMOB_IOS_BANNER_ID`. Local test builds do not require production AdMob IDs.

## Render backend deployment

- Root directory: `Backend`
- Build command: `npm ci && npx prisma generate`
- Pre-deploy command: `npx prisma migrate deploy`
- Start command: `npm start`
- Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE`, `CLIENT_URLS`, `EMAIL_USER`, and `EMAIL_PASS`.
- Chat push notifications require `FIREBASE_SERVICE_ACCOUNT_JSON` in Render/local backend env, or a valid `GOOGLE_APPLICATION_CREDENTIALS` path. Do not commit Firebase service account JSON.
- Set `CLIENT_URLS=https://good-one-jlcu.onrender.com,capacitor://localhost,ionic://localhost,http://localhost,https://localhost` for the Render backend. Also include the real final frontend domain if it is different.

## Admin access

There is a single built-in admin login that can view every vendor (including phone numbers and profile details). It is driven entirely by environment variables — there is **no admin user in the database** and no migration is required.

- `ADMIN_USERNAME` — the admin login id. Default: `admin`
- `ADMIN_PASSWORD` — the admin password. Default: `GoodOne@Admin2026`

These defaults are committed in `Backend/.env.example` purely as placeholders. **The committed value is only a default — set the real credentials via the Render backend environment variables** (`ADMIN_USERNAME` and `ADMIN_PASSWORD`) under the service's *Environment* tab. Never ship the default password to production.

How it works:

- The admin signs in on the **normal login screen** (`/login`) using `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- A successful admin login returns a user with `role: 'admin'` and a token whose payload is `{ id: 'admin', role: 'admin' }` (no DB lookup is performed for admin requests).
- After logging in, the admin is redirected to **`/admin/vendors`**, which lists every vendor with business name, owner name, email, phone number, and profile details.
- The admin endpoint is `GET /api/vendors/admin/all` (protected by `protect` + `adminOnly`). Non-admin users receive `403` from both the route and the `/admin/vendors` page.

## Capacitor mobile apps

Android already exists at `client/android` and Capacitor Android 7 requires JDK 21 for Gradle builds. If your terminal still uses Java 17, switch `JAVA_HOME` to a JDK 21 install before running Gradle. iOS is generated when needed. Simulator builds require macOS, Xcode 26 or newer, and CocoaPods, but do not require Apple Developer Program payment or signing. Physical iPhone Debug builds require Xcode signing and can use a free Apple Account with a Personal Team for limited local testing. TestFlight, App Store, IPA export, and archive distribution require Apple Developer Program membership. Before iOS sync/build/archive, make sure `xcode-select` points to the full Xcode app and the Xcode license has been accepted.

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

If that URL returns `text/html` or the React app shell, deploy the current frontend build and make sure the static `.well-known/assetlinks.json` file is served before the catch-all `/* -> /index.html` rewrite. Android cannot verify the domain while this URL returns `index.html`.

Existing Play Store users need an app update containing the AndroidManifest App Link intent filters before shared product and vendor links can open the installed app.

For local debug APK testing, Android automatic verification also needs the debug APK signing fingerprint in the live `assetlinks.json`, or the test device needs the domain manually approved. The production file should include the Play App Signing fingerprint for Play builds; do not guess it.

Run the local Android App Links check after installing a debug APK:

```sh
scripts/test-android-app-links.sh
```

### iOS Universal Links

iOS Universal Links are not fully configured yet. `client/ios/App/App/AppDelegate.swift` already forwards `continue userActivity` to Capacitor, but the repo currently has no active `client/public/.well-known/apple-app-site-association` file and no active `client/ios/App/App/App.entitlements` file.

Templates are included at `client/public/.well-known/apple-app-site-association.example.json` and `client/ios/App/App/App.entitlements.example`. To enable iOS Universal Links, replace `TEAM_ID` with the Apple Developer Team ID, publish the AASA file without a `.json` extension at `https://good-one-jlcu.onrender.com/.well-known/apple-app-site-association`, and enable the Associated Domains entitlement in the signed iOS target. Associated Domains and push notification entitlements require signing, and some Apple capabilities may require paid Apple Developer Program membership; do not commit generated signing data.

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
IOS_BUILD_MODE=simulator ./scripts/build-ios.sh
```

Equivalent npm command:

```sh
cd client
npm run build:ios:simulator
```

`./scripts/build-ios.sh` is a mode router:

- `IOS_BUILD_MODE=simulator` runs unsigned simulator verification.
- `IOS_BUILD_MODE=device` runs signed physical-device Debug build flow.
- `IOS_BUILD_MODE=archive` runs signed archive flow.
- If no mode and no `IOS_TEAM_ID` are set, it defaults to simulator verification.
- If no mode is set but `IOS_TEAM_ID` is present, it preserves the existing archive behavior.

For physical iPhone Debug testing, use Xcode signing. A free Apple Account with Xcode Personal Team can be used for limited local device testing, but Personal Team provisioning is limited and temporary:

```sh
IOS_BUILD_MODE=device ./scripts/build-ios.sh
```

Optional device/debug overrides:

```sh
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_DEVICE_ID=YOUR_DEVICE_ID \
IOS_BUNDLE_ID=com.goodone.marketplace.dev.$USER \
./scripts/run-ios-device.sh
```

To configure Personal Team signing, open `client/ios/App/App.xcworkspace` in Xcode, select the `App` target, open **Signing & Capabilities**, sign in with a free Apple Account, select your Personal Team, and keep automatic signing enabled. Do not commit `DEVELOPMENT_TEAM` or provisioning changes from `project.pbxproj`.

For signed release, TestFlight, or App Store archive builds, provide your own Apple Team ID from the repository root:

```sh
IOS_TEAM_ID=YOUR_TEAM_ID IOS_BUILD_MODE=archive REACT_APP_USE_ADMOB_TEST_ADS=false ./scripts/build-ios.sh
```

Do not commit Apple Team IDs, certificates, provisioning profiles, private keys, `.p8` files, Xcode `xcuserdata`, or Apple accounts. Apple signing and Developer Program payment requirements are Apple platform requirements, not GoodOne code issues. If `IOS_TEAM_ID` is missing, `scripts/build-ios-archive.sh` fails fast before `xcodebuild archive`; simulator verification remains available without signing.

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
npm run build:ios
```

- Local simulator verification uses no Apple Developer Program payment and no signing.
- Physical iPhone Debug testing requires Xcode signing with a free Apple Account Personal Team or `IOS_TEAM_ID`; run `IOS_BUILD_MODE=device ./scripts/build-ios.sh`.
- For TestFlight/App Store, run `IOS_TEAM_ID=YOUR_TEAM_ID IOS_BUILD_MODE=archive REACT_APP_USE_ADMOB_TEST_ADS=false ./scripts/build-ios.sh` from the repository root, then distribute the signed archive from Xcode.

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
