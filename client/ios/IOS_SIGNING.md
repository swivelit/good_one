# iOS signing and build setup

GoodOne supports two different iOS build paths:

- iOS Simulator Debug builds do not require Apple Developer Program payment, a Team ID, certificates, or provisioning profiles.
- Signed iOS device/archive builds require Apple signing configured in Xcode or a developer-provided `IOS_TEAM_ID`.
- TestFlight, App Store, and other release archive distribution require Apple Developer Program membership.
- A free Apple Account with Xcode Personal Team can be used for limited personal device testing, but it is not enough for TestFlight or App Store distribution.
- Team IDs are local signing configuration and must not be committed to git.

Keep the Xcode target on automatic signing unless you intentionally manage profiles yourself. The committed bundle identifier is `com.goodone.marketplace`.

## Simulator build without paid signing

Use this for local iOS build verification when you do not need a signed device build:

```bash
cd client
npm run build:ios:simulator
```

The simulator script installs frontend dependencies unless `SKIP_NPM_CI=true`, builds the React app with `REACT_APP_USE_ADMOB_TEST_ADS=true` by default, syncs Capacitor iOS, installs pods, and runs an iOS Simulator Debug build with `CODE_SIGNING_ALLOWED=NO`.

## Signed iOS archive

Use this only when a developer provides their own Apple Team ID:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID REACT_APP_USE_ADMOB_TEST_ADS=false ./scripts/build-ios-archive.sh
```

For local QA archives, keep test ads enabled:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID REACT_APP_USE_ADMOB_TEST_ADS=true ./scripts/build-ios-archive.sh
```

If `IOS_TEAM_ID` is omitted, the archive script will still run so local Xcode signing configuration can be used, but unsigned or unconfigured archive builds should be expected to fail. Do not hard-code the Team ID in `client/ios/App/App.xcodeproj/project.pbxproj`.

## Xcode signing setup

On the Mac that will create a signed archive:

1. Open `client/ios/App/App.xcworkspace` in Xcode.
2. Select the `App` project, then the `App` target.
3. Open **Signing & Capabilities**.
4. Select your own Apple Developer Team or Personal Team.
5. Keep **Automatically manage signing** enabled unless you already use manual profiles.
6. Keep the bundle identifier as `com.goodone.marketplace` unless the production App Store Connect app uses a different identifier.
7. Re-run the signed archive command.

## Optional IPA export

If you have an export options plist, run:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_EXPORT_OPTIONS_PLIST=/absolute/path/to/ExportOptions.plist \
./scripts/build-ios-archive.sh
```

The IPA export folder will be `dist/ios/ipa`.
