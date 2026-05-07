# Android release signing

Google Play requires the release Android App Bundle (`.aab`) to be signed with an upload key.
Do not commit the keystore file or `key.properties`.

## 1. Generate the upload keystore

Run this from `client/android`:

```bash
mkdir -p keystores
keytool -genkeypair   -v   -storetype JKS   -keystore keystores/goodone-upload-key.jks   -alias goodone-upload   -keyalg RSA   -keysize 2048   -validity 10000
```

Save the passwords somewhere safe. If you lose the upload key, Google Play updates become difficult until you reset the upload key in Play Console.

## 2. Create key.properties

Copy the template:

```bash
cp key.properties.example key.properties
```

Fill the real values:

```properties
storeFile=../keystores/goodone-upload-key.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=goodone-upload
keyPassword=YOUR_KEY_PASSWORD
```

## 3. Build and verify the release bundle

From `client`:

```bash
npm run build:android:release
npm run verify:android:release
```

The signed bundle is created at:

```text
client/android/app/build/outputs/bundle/release/app-release.aab
```
