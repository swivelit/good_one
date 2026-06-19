# Meta SDK Android Setup

## Architecture And Scope

GoodOne uses the Meta SDK on Android for App Events measurement only. This integration does not add Facebook Login, sharing, gaming services, Messenger, FacebookActivity, a Facebook content provider, or custom marketplace/purchase funnel events.

## Android Dependency

The Android app pins the narrow core SDK artifact:

```gradle
implementation 'com.facebook.android:facebook-core:18.2.3'
```

Do not replace it with `com.facebook.android:facebook-android-sdk`.

## App Identity

- Package: `com.goodone.marketplace`
- Default activity: `com.goodone.marketplace.MainActivity`

## Meta App Credentials

Obtain the Meta App ID and Android client token from the Meta developer dashboard for the GoodOne app. Never place the server-side secret value for the Meta app in a mobile app, repository, CI log, support ticket, or APK build script.

## Local Configuration

Create `client/android/meta.properties` from `client/android/meta.properties.example`:

```properties
META_APP_ID=123456789012345
META_CLIENT_TOKEN=replace_with_meta_client_token
META_AUTO_LOG_APP_EVENTS_ENABLED=true
META_ADVERTISER_ID_COLLECTION_ENABLED=false
```

`client/android/meta.properties` is intentionally ignored by Git.

## CI Configuration

CI may set the same values as environment variables. Environment variables have priority over `meta.properties`:

```sh
META_APP_ID=123456789012345
META_CLIENT_TOKEN=replace_with_meta_client_token
META_AUTO_LOG_APP_EVENTS_ENABLED=true
META_ADVERTISER_ID_COLLECTION_ENABLED=false
```

## Key Hashes

Debug key hash:

```sh
keytool -exportcert \
  -alias androiddebugkey \
  -keystore "$HOME/.android/debug.keystore" \
  -storepass android \
  -keypass android \
  | openssl sha1 -binary \
  | openssl base64
```

Upload-key hash:

```sh
keytool -exportcert \
  -alias YOUR_UPLOAD_KEY_ALIAS \
  -keystore /absolute/path/to/upload-key.jks \
  | openssl sha1 -binary \
  | openssl base64
```

Google Play app-signing certificate hash:

```sh
openssl sha1 -binary < deployment_cert.der | openssl base64
```

Debug, upload, and Play app-signing hashes are different. Register every hash that can sign an installed GoodOne build.

## Meta Dashboard Values

- Android package name: `com.goodone.marketplace`
- Class name: `com.goodone.marketplace.MainActivity`
- SSO: disabled because Facebook Login is not implemented
- Privacy policy URL: `https://good-one-jlcu.onrender.com/privacy`
- User data deletion URL: `https://good-one-jlcu.onrender.com/account-deletion`

## Events Manager Test Events

1. Build and install a fresh debug app with `META_FRESH_INSTALL=true`.
2. Open Meta Events Manager for the configured app.
3. Go to Test Events.
4. Start a fresh install/open of GoodOne on the test device.
5. Confirm Meta shows app activation or install/open activity for the test device.

Do not enable `LoggingBehavior.REQUESTS`; it can expose request credentials or identifiers.

## Play Console Reminders

Review Play Console Data Safety and the advertising-ID declaration after changing SDK configuration. GoodOne already uses AdMob, so preserve required advertising permissions and accurately describe app measurement and ad-related SDK usage.

## Inspect The Merged Manifest

Run:

```sh
cd client/android
./gradlew :app:processDebugMainManifest
find app/build/intermediates -name AndroidManifest.xml -path '*debug*merged*' -print
```

The manifest should contain Meta metadata for `ApplicationId`, `ClientToken`, `AutoInitEnabled`, `AutoLogAppEventsEnabled`, and `AdvertiserIDCollectionEnabled`.

## Common Errors

- Missing client token: add `META_CLIENT_TOKEN` to `meta.properties` or CI secrets.
- Invalid App ID: use the numeric Meta App ID, not the example placeholder.
- Invalid key hash: register the debug, upload, and Play app-signing hashes that match the installed build.
- Debug works but Play release fails: register the Play app-signing certificate hash and verify release dashboard settings.
- SDK not initialized: confirm `AutoInitEnabled=true`, the content provider from `facebook-core` is merged, and manifest metadata resolves.
- No event in Test Events: fresh install/open the app, verify network access, and confirm the dashboard app matches the configured App ID.
- Device offline/network blocked: connect the device and allow Meta endpoint access.

Custom funnel events are intentionally outside this commit.

## Debug And Release Verification

Use JDK 21 for every Android build and verification command.

Debug verification:

```sh
./scripts/verify-meta-sdk-android.sh --variant debug
```

Release verification after signed artifacts exist:

```sh
./scripts/verify-meta-sdk-android.sh --variant release --skip-build
```

Release build with verification:

```sh
./scripts/build-android_release-apk.sh
```

The release verifier checks the signed APK and AAB, confirms the release APK is
not debuggable, verifies APK/AAB signatures, inspects the merged manifest, and
uses bundletool for AAB base-manifest inspection when bundletool is available.

## Current Runtime Flags

GoodOne currently builds with:

```properties
META_AUTO_LOG_APP_EVENTS_ENABLED=true
META_ADVERTISER_ID_COLLECTION_ENABLED=false
```

Changing either flag requires privacy-policy, Play Data Safety, and consent-flow
review. In jurisdictions or contexts that require prior consent, automatic
logging may need to be delayed until that consent exists. The existing Google
UMP flow must not be treated as automatic consent for Meta.

## Event Evidence Limits

Android logs can prove local SDK initialization, automatic install/activation
event generation, and local flush success. They do not prove Meta Events Manager
received, attributed, or made the event available for campaign optimization.
Dashboard confirmation still requires authenticated Meta access.

Debug fresh-install evidence command:

```sh
REQUIRE_ADB=true \
META_FRESH_INSTALL=true \
META_REQUIRE_EVENT_EVIDENCE=true \
META_LAUNCH_WAIT_SECONDS=15 \
META_EVENT_WAIT_SECONDS=45 \
SKIP_NPM_CI=true \
./launch-debug_apk.sh
```

## Google Play Internal Testing

For release validation, upload `dist/goodone-release.aab` to an Internal Testing
track and install the Play-signed build from Google Play. This is the
authoritative runtime path for the Google Play app-signing certificate. Local
release APKs are signed by the upload key, so do not force local App Links
expectations onto that APK when the live Digital Asset Links file contains only
the Play app-signing certificate.

## Meta Events Manager Workflow

1. Confirm the Meta app dashboard Android package is `com.goodone.marketplace`.
2. Confirm the default activity is `com.goodone.marketplace.MainActivity`.
3. Confirm every relevant key hash is registered: debug, upload, and Google
   Play app-signing.
4. Install a fresh debug or Internal Testing build.
5. Open Events Manager -> Test Events.
6. Open GoodOne and confirm automatic install/activation events appear.

## Business And Marketing Handoff

Before campaign rollout, confirm:

- Meta Business Portfolio owns or has access to the Meta app.
- The ad account is connected to the app and has the right partner/agency
  access.
- Marketing has the App ID, package name, main activity, Play Store listing,
  and current event status.
- Marketing does not receive the App Secret, client token, signing keys,
  keystore passwords, or release artifacts outside the approved release process.

## Custom Events Not Implemented

Automatic install and activation events are present. GoodOne does not currently
send custom Meta events for completed registration, product/content view, search,
seller contact, listing creation, or vendor registration.

Add custom events only after a written event specification covers event names,
parameters, consent timing, retention, Data Safety impact, and prohibited data.
Do not send names, emails, phone numbers, chat contents, listing descriptions,
or other user-entered personal data as Meta event names or parameters.
