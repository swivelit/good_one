# iOS signing setup

Codex reported: `Signing for "App" requires a development team.`

Fix this on the Mac that will create the archive:

1. Open `client/ios/App/App.xcworkspace` in Xcode.
2. Select the `App` project, then the `App` target.
3. Open **Signing & Capabilities**.
4. Select your Apple Developer **Team**.
5. Keep **Automatically manage signing** enabled unless you already use manual profiles.
6. Set the bundle identifier to the production bundle ID you want to use in App Store Connect.
7. Re-run the archive.

Command-line archive after signing is configured:

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
  archive
```
