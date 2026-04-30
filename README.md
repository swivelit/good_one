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

The current Capacitor app id and Android package are `com.goodone.marketplace`. Finalize this before the first Play Store or App Store upload. If it needs to change, update `client/capacitor.config.json`, `client/android/app/build.gradle`, and the Xcode target Bundle Identifier.

## Android release signing

Do not commit Android keystores, `key.properties`, or signing passwords. Use `client/android/key.properties.example` as a local template for release signing values.

For Play Store release builds, open Android Studio and use `Build > Generate Signed Bundle / APK > Android App Bundle`. The Play Store needs a signed AAB, not just a debug APK.

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
npm ci
npm run build
npx cap sync android
npx cap open android
```

- In Android Studio, use `Build > Generate Signed Bundle / APK > Android App Bundle`.
- Output must be a signed AAB for the Play Store, not just a debug APK.

iOS:

```sh
cd client
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```

- In Xcode, use `Product > Archive > Distribute App`.

Store assets:

- App icon
- Splash screen
- Android screenshots
- iPhone screenshots
- Privacy policy URL
- Support email
- Reviewer test account
- Google Data Safety
- Apple App Privacy
- Content rating
- Account deletion URL

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
