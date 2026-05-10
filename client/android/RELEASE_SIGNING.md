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
