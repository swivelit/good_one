# iOS signing and build setup

GoodOne has three separate iOS build paths. Keep them separate so local
verification does not accidentally start a signed archive.

- Simulator Debug builds do not require Apple Developer Program payment, a Team
  ID, certificates, provisioning profiles, or code signing.
- Physical iPhone Debug builds must be signed. A free Apple Account can use an
  Xcode Personal Team for limited local device testing.
- TestFlight, App Store, IPA export, and archive distribution require Apple
  Developer Program membership and valid distribution signing.

Do not commit Apple Team IDs, provisioning profiles, certificates, Apple private
keys, `.p8` files, Xcode `xcuserdata`, or signing secrets. The committed bundle
identifier is `com.goodone.marketplace`; use `IOS_BUNDLE_ID` only as a local
override when a personal-device build needs a unique development identifier.

## Default build router

From the repository root:

```bash
./scripts/build-ios.sh
```

Behavior:

- `IOS_BUILD_MODE=simulator` runs `scripts/build-ios-simulator.sh`.
- `IOS_BUILD_MODE=device` runs `scripts/run-ios-device.sh`.
- `IOS_BUILD_MODE=archive` runs `scripts/build-ios-archive.sh`.
- When `IOS_BUILD_MODE` is omitted and `IOS_TEAM_ID` is not set, the script
  defaults to unsigned simulator verification.
- When `IOS_BUILD_MODE` is omitted and `IOS_TEAM_ID` is set, the script preserves
  the old signed archive behavior.

## Simulator verification

Use this for local iOS build verification without signing:

```bash
IOS_BUILD_MODE=simulator ./scripts/build-ios.sh
```

Equivalent npm command:

```bash
cd client
npm run build:ios:simulator
```

The simulator script installs frontend dependencies unless `SKIP_NPM_CI=true`,
builds React with `REACT_APP_USE_ADMOB_TEST_ADS=true` by default, syncs
Capacitor iOS, installs pods, and runs an iOS Simulator Debug build with
`CODE_SIGNING_ALLOWED=NO`. It defaults `GENERATE_SOURCEMAP=false` to avoid noisy
third-party source-map warnings; set `GENERATE_SOURCEMAP=true` if you need
source maps for debugging.

## Physical iPhone Debug testing

A physical iPhone cannot run an unsigned app. For local device testing, use a
free Apple Account and Xcode Personal Team signing, or provide `IOS_TEAM_ID`
from your environment:

```bash
IOS_BUILD_MODE=device ./scripts/build-ios.sh
```

Equivalent npm command:

```bash
cd client
npm run run:ios:device
```

Optional device/debug overrides:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_DEVICE_ID=YOUR_DEVICE_ID \
IOS_BUNDLE_ID=com.goodone.marketplace.dev.$USER \
./scripts/run-ios-device.sh
```

To configure a Personal Team:

1. Open `client/ios/App/App.xcworkspace` in Xcode.
2. Select the `App` target.
3. Open **Signing & Capabilities**.
4. Sign in with a free Apple Account and select your Personal Team.
5. Keep **Automatically manage signing** enabled.
6. If Xcode says the production bundle identifier is unavailable, rerun the
   script with a local `IOS_BUNDLE_ID` override.
7. Do not commit any `DEVELOPMENT_TEAM` or provisioning changes from
   `project.pbxproj`.

Personal Team provisioning is limited and temporary. It is suitable for local
device debugging, not TestFlight, App Store distribution, or production release
signing.

## Signed archive

Use archives only for real signed distribution work:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_BUILD_MODE=archive \
REACT_APP_USE_ADMOB_TEST_ADS=false \
./scripts/build-ios.sh
```

For local QA archives, keep test ads enabled:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_BUILD_MODE=archive \
REACT_APP_USE_ADMOB_TEST_ADS=true \
./scripts/build-ios.sh
```

If `IOS_TEAM_ID` is omitted, `scripts/build-ios-archive.sh` fails fast with a
signing explanation before running `xcodebuild archive`. If this Mac already has
local Xcode signing configured and you intentionally want the archive script to
use it without passing `IOS_TEAM_ID`, opt in explicitly:

```bash
IOS_ALLOW_LOCAL_SIGNING=true ./scripts/build-ios-archive.sh
```

Do not hard-code the Team ID in
`client/ios/App/App.xcodeproj/project.pbxproj`.

## Optional IPA export

If you have an export options plist, run:

```bash
IOS_TEAM_ID=YOUR_TEAM_ID \
IOS_EXPORT_OPTIONS_PLIST=/absolute/path/to/ExportOptions.plist \
./scripts/build-ios-archive.sh
```

The IPA export folder will be `dist/ios/ipa`. TestFlight and App Store exports
require Apple Developer Program membership.

## Capabilities

The repo does not commit push notification or Associated Domains entitlements.
Those capabilities require a signed iOS target, and some Apple capabilities may
require paid Apple Developer Program membership. Configure them deliberately in
Xcode for the signed target and keep generated signing data out of git.
