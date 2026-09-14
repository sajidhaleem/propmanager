# Installing PropManager on Android

Two ways. The first needs nothing building and works today; the second produces
an `.apk` file you can copy to a phone or put on Play Store.

---

## 1. Install from Chrome (no build)

On the Android device, open **https://52apropmanager.netlify.app** in Chrome and
choose **Install app** from the ⋮ menu. It gets its own icon in the launcher and
opens without browser chrome — the manifest, the service worker and the icons
are all already served.

This is the same app the `.apk` below wraps. The only things the `.apk` adds are
a file you can hand around or sideload, and eligibility for Play Store.

---

## 2. Build an `.apk` (Trusted Web Activity)

`twa-manifest.json` in this folder is filled in and ready. What it needs is a
toolchain that is not in this repo: a JDK and the Android SDK. Bubblewrap will
offer to download both on first run (roughly 1.5 GB), so run this somewhere you
are happy for that to land.

```bash
npm install -g @bubblewrap/cli

cd twa
bubblewrap init --manifest=https://52apropmanager.netlify.app/manifest.json
# accept the values it reads back — they come from twa-manifest.json
bubblewrap build
```

`bubblewrap build` creates a signing keystore the first time and asks for a
password. **Keep that keystore and password.** Android identifies an app by its
signing key: lose it and you cannot ship an update to anyone who installed the
old one — they have to uninstall and reinstall.

Output is `app-release-signed.apk` (sideload this) and `app-release-bundle.aab`
(upload this to Play Store).

### The step that is easy to miss

A TWA only opens without a browser address bar if the site vouches for the app.
That is what `public/.well-known/assetlinks.json` is for, and it currently holds
a placeholder fingerprint, so **verification will fail until you replace it**.

After the first build:

```bash
bubblewrap fingerprint list
```

Copy the SHA-256 value into `public/.well-known/assetlinks.json`, replacing
`REPLACE_WITH_YOUR_SIGNING_CERTIFICATE_SHA256_FINGERPRINT`, then deploy. The
file must be live at
`https://52apropmanager.netlify.app/.well-known/assetlinks.json` before the app
is opened, or Android caches the failure and the app shows a URL bar across the
top.

If you upload to Play Store and let Google re-sign the app, the fingerprint you
need is the one Play shows under **Setup → App integrity**, not the local one.

### If the host changes

A custom domain means editing `host`, `webManifestUrl`, `startUrl` and every
`https://...` icon URL in `twa-manifest.json`, then rebuilding — and serving
`assetlinks.json` from the new domain too.

---

## What is deliberately not here

No `signing` block in `twa-manifest.json`. It used to carry placeholder
passwords, which is a keystore password living in a git repository waiting for
someone to fill it in and commit it. Bubblewrap asks for the password at build
time instead.
