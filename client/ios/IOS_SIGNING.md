# iOS signing and build setup

Codex previously reported: `Signing for "App" requires a development team.`

Fix this on the Mac that will create the archive:

1. Open `client/ios/App/App.xcworkspace` in Xcode.
2. Select the `App` project, then the `App` target.
3. Open **Signing & Capabilities**.
4. Select your Apple Developer **Team**.
5. Keep **Automatically manage signing** enabled unless you already use manual profiles.
6. Set the bundle identifier to the production bundle ID you want to use in App Store Connect.
7. Re-run the archive.

## Scripted iOS archive

From the project root:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID ./scripts/build-ios-archive.sh
```

This will:

1. install frontend dependencies from the public npm registry,
2. build the React app,
3. sync Capacitor iOS,
4. run `pod install --repo-update`,
5. create an Xcode archive at `dist/ios/GoodOne.xcarchive`.

For local QA, keep test ads:

```bash
REACT_APP_USE_ADMOB_TEST_ADS=true IOS_TEAM_ID=YOUR_TEAM_ID ./scripts/build-ios-archive.sh
```

For production/TestFlight release builds, use live ads only when ready:

```bash
REACT_APP_USE_ADMOB_TEST_ADS=false IOS_TEAM_ID=YOUR_TEAM_ID ./scripts/build-ios-archive.sh
```

## Optional IPA export

If you have an export options plist, run:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_EXPORT_OPTIONS_PLIST=/absolute/path/to/ExportOptions.plist \
./scripts/build-ios-archive.sh
```

The IPA export folder will be `dist/ios/ipa`.

## Manual command-line archive

```bash
cd client
REACT_APP_USE_ADMOB_TEST_ADS=false npm run build
npx cap sync ios
cd ios/App
pod install --repo-update
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ../../../dist/ios/GoodOne.xcarchive \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  archive
```
