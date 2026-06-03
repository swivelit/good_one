# Android App Links — `assetlinks.json`

This file is the Digital Asset Links statement Android uses to verify that
`https://good-one-jlcu.onrender.com` is allowed to open the app
`com.goodone.marketplace` directly (autoVerify App Links).

It must be served at exactly:

    https://good-one-jlcu.onrender.com/.well-known/assetlinks.json

as `application/json`, with **no redirect** and **no SPA rewrite** to `index.html`.

> Note: `assetlinks.json` cannot contain comments (it is strict JSON) and the
> validator (`npm run app-links:validate`) rejects the words
> `PASTE / REPLACE / TODO / EXAMPLE / PLACEHOLDER` and any malformed fingerprint.
> That is why these instructions live here instead of inside the JSON.

## Current `sha256_cert_fingerprints` entries

The array in `assetlinks.json` currently holds three certificates. An app link
verifies if the installed build was signed by **any** listed certificate, so it
is safe (and recommended) to list every signing identity:

| # | Fingerprint (first/last bytes) | Source |
|---|--------------------------------|--------|
| 1 | `97:05:CF:A7:…:A8:FF:E4` | Pre-existing entry. Provenance not verified locally — it is **neither** the current debug **nor** the current upload keystore. It may already be your Play App Signing cert (see below). |
| 2 | `E3:C8:38:24:…:9C:10:95` | **Upload key** — `client/android/keystores/goodone-upload-key.jks`, alias `goodone-upload`. This is the key you sign the AAB with before uploading to Play. |
| 3 | `56:1A:76:9F:…:46:77:FF:7A` | **Local debug keystore** — `~/.android/debug.keystore`, alias `androiddebugkey`. Lets App Links work for debug/QA installs (`assembleDebug`). |

## 👉 ACTION REQUIRED: add your Google Play App Signing SHA-256

When you upload an AAB, Google re-signs it with the **Play App Signing** key.
Installs from the Play Store are signed with **that** cert — not your upload key —
so its SHA-256 **must** be in this list or App Links will fail for store users.

1. Open **Play Console → (your app) → Test and release → App integrity →
   App signing**.
2. Copy the value under **“SHA-256 certificate fingerprint”** (the *App signing
   key certificate* section, not the upload key).
3. Open `assetlinks.json` (this folder) and add it as a **new string** in the
   `sha256_cert_fingerprints` array. Paste it here (replace the example bytes
   with your real value — keep it uppercase, colon-separated, 32 bytes):

   ```jsonc
   "sha256_cert_fingerprints": [
     "97:05:CF:A7:05:38:70:DA:54:79:85:D8:84:23:69:CC:4F:8F:40:77:12:51:8D:15:59:26:BF:77:5C:A8:FF:E4",
     "E3:C8:38:24:AC:51:E7:7E:DB:82:83:6B:0B:C4:7D:41:92:E9:01:86:31:10:22:00:25:45:CB:28:E1:9C:10:95",
     "56:1A:76:9F:E0:6E:2D:B3:13:39:A9:63:B8:96:EE:0E:3F:25:68:F3:DC:CB:DB:12:D8:57:EA:3A:46:77:FF:7A",
     "<-- ADD PLAY APP SIGNING SHA-256 ON A NEW LINE HERE -->"
   ]
   ```

   > If entry #1 (`97:05:…:FF:E4`) already equals your Play App Signing SHA-256,
   > you don't need to add another — just confirm it matches. Extra valid
   > entries are harmless.

4. Validate, then redeploy the web so Render serves the updated file:

   ```bash
   cd client
   npm run app-links:validate
   ```

## How these fingerprints were extracted (for reference)

```bash
# Upload key (entry #2)
keytool -list -v \
  -keystore client/android/keystores/goodone-upload-key.jks \
  -alias goodone-upload | grep 'SHA256:'

# Local debug keystore (entry #3)
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey -storepass android | grep 'SHA256:'
```
