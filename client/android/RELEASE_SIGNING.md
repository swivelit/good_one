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

## 3. Build and verify the release AAB

```bash
cd client
npm run build:android:release
npm run verify:android:release
```

The output is:

```text
client/android/app/build/outputs/bundle/release/app-release.aab
```

Do not use the debug APK for Play Store production.
