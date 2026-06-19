# Android release signing

The Play Store release AAB must be signed with your private upload key.

## 1. Generate the upload key

```bash
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

Keep the `.jks` file and passwords private.

## 2. Create key.properties

```bash
cp key.properties.example key.properties
```

Then edit `client/android/key.properties`:

```properties
storeFile=../keystores/goodone-upload-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=goodone-upload
keyPassword=YOUR_KEY_PASSWORD
```

## 3. Build and verify the release AAB/APK

From `client`:

```bash
cd client
npm run build:android:release:apk
```

Or from the repository root:

```bash
bash scripts/build-android_release-apk.sh
```

The outputs are:

```text
dist/goodone-release.aab
dist/goodone-release.apk
```

Upload `dist/goodone-release.aab` to Google Play. `dist/goodone-release.apk` is
for local QA only. Do not click live AdMob ads during testing; use debug builds
or configured test devices for ad testing.

Do not commit `.jks`, `.keystore`, `key.properties`, APK, AAB, or signing
secrets.

## 4. Meta configuration for release builds

Release builds also require Meta Android configuration. Supply these through CI
secrets or the ignored local file `client/android/meta.properties`:

```properties
META_APP_ID=123456789012345
META_CLIENT_TOKEN=replace_with_meta_client_token
META_AUTO_LOG_APP_EVENTS_ENABLED=true
META_ADVERTISER_ID_COLLECTION_ENABLED=false
```

Environment variables override `meta.properties`. Never commit Meta
configuration files, signing files, keystores, or generated APK/AAB artifacts.

## 5. Internal Testing and Meta confirmation

After `bash scripts/build-android_release-apk.sh` passes, upload
`dist/goodone-release.aab` to Google Play Internal Testing and install GoodOne
from Play. Use that Play-signed install for final App Links and Events Manager
confirmation.

Debug, upload, and Google Play app-signing certificates are different. Register
all relevant key hashes in the Meta dashboard, and use the Play app-signing
certificate for Play-delivered runtime checks.

Events Manager receipt, Business Portfolio connection, ad-account assignment,
and Play Console Data Safety submission require dashboard or Play Console owner
access and are not proven by local release signing alone.
