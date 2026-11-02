# Releasing the macOS app

Build on an Apple silicon Mac that has this repository, Node.js 20+, and pnpm 10. Partners do not need that checkout.

The `.dmg` is ad-hoc signed (`identity: "-"` in electron-builder). Release notes must tell users how to open an unsigned build (see below).

## If macOS says the app is damaged

Browsers attach a **quarantine** flag to downloaded files. With an unsigned app, macOS often shows **damaged and can’t be opened** instead of the normal Gatekeeper prompt.

After installing from the `.dmg`, run in Terminal (adjust the path if needed):

```bash
xattr -cr "/Applications/Oppvera Watch.app"
```

Then open the app from Applications or Spotlight.

**Right-click → Open** only helps when Gatekeeper shows an “unidentified developer” prompt. It does **not** fix the common **damaged and can’t be opened** message from quarantined browser downloads — use `xattr` for that.

To clear quarantine on the download before mounting:

```bash
xattr -cr ~/Downloads/OppveraWatch-arm64.dmg
```

Long term, a Developer ID certificate plus notarization removes this friction; until then, document the `xattr` step on the release and Oppvera download page.

See [Trusted distribution checklist](#trusted-distribution-checklist-developer-id--notarization) when you are ready to stop shipping ad-hoc builds.

## Trusted distribution checklist (Developer ID + notarization)

This is **not** Mac App Store submission. You keep shipping the same GitHub Release DMG. Apple does **not** review Oppvera Watch like an iPhone app. **Notarization** is an automated malware and signing check so Gatekeeper accepts the download.

### What changes vs today

| Today (`identity: "-"`) | After Developer ID + notarize |
| --- | --- |
| Ad-hoc sign in `apps/desktop/package.json` | Sign with **Developer ID Application** certificate |
| Partners often need `xattr` | Typical install: drag to Applications, open normally |
| `skipped macOS notarization` in build log | Upload to Apple, staple ticket to `.app` / DMG |

### Phase A — Join the Apple Developer Program (one-time)

Use a **Mac** and an **Apple ID** with **two-factor authentication** enabled.

1. Read Apple’s overview: [Apple Developer Program](https://developer.apple.com/programs/).
2. Start enrollment: [Enroll](https://developer.apple.com/programs/enroll/) (sign in with the Apple ID you will use for releases).
3. Choose account type:
   - **Individual** — You are the sole developer. Enrollment is usually the fastest path (often same day after payment). The seller name on the Mac App Store (if you ever use it) is your personal name unless you later move to an organization account.
   - **Organization** — For **Oppkey / Oppvera** as a company. Apple requires a **D-U-N-S Number** for the legal entity, authority to bind the organization, and a public website. Organization approval can take **several days** while Apple verifies the business.
4. Complete identity and agreement steps in the portal (legal name, address, contact email).
5. Pay the **annual membership fee** (priced in USD; Apple lists current pricing on the enroll page).
6. Wait for **Active** membership in [Account](https://developer.apple.com/account). Save the **Team ID** (10-character id) — you need it for certificates and notarization.

**Tips if you are not a member yet**

- Use an Apple ID you control long-term (not a shared inbox that someone might lose access to).
- Turn on 2FA before enrolling; Apple requires it.
- For **Organization**, look up or request a D-U-N-S number before starting: [D-U-N-S](https://developer.apple.com/support/D-U-N-S/).
- You do **not** need to create an App Store Connect app listing to notarize a direct-download DMG.

### Phase B — Certificates and notarization credentials (one-time)

On a **Mac that will run `pnpm dist:mac`** (or that exports certs into CI):

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list).
2. Create a **Developer ID Application** certificate (not “Apple Development” and not “Mac App Distribution” for App Store).
   - macOS **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority** to generate a CSR, upload it in the portal, download the `.cer`, double-click to install in Keychain.
3. Confirm in Keychain **login** keychain you see **Developer ID Application: … (Team ID)**.
4. Choose how **notarytool** will authenticate (pick one):
   - **App Store Connect API key** (recommended for CI): [Keys](https://appstoreconnect.apple.com/access/integrations/api) → generate key with at least notarization access; note **Issuer ID**, **Key ID**, download the `.p8` once.
   - **Apple ID + app-specific password** (fine for local-only releases): [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → **App-Specific Passwords**; store `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` securely (never commit).

### Phase C — Wire the repo (one-time engineering)

Track these in a secure password manager or GitHub Actions secrets — not in git.

- [ ] Replace `"identity": "-"` in [apps/desktop/package.json](../apps/desktop/package.json) `build.mac` with your **Developer ID Application** identity (exact name from Keychain or certificate SHA-1 hash).
- [ ] Enable **hardened runtime** and correct **entitlements** for Electron (electron-builder docs: `hardenedRuntime`, `entitlements`, `entitlementsInherit`). Oppvera Watch spawns Node/Camoufox children; notarization may fail until entitlements match what the app actually does.
- [ ] Configure electron-builder **notarization** (`afterSign` / `notarize` options for v26) so the DMG or `.app` is submitted to Apple and **stapled** after sign.
- [ ] Document required env vars for release machines, for example:
  - `CSC_LINK` / `CSC_KEY_PASSWORD` (exported `.p12` if using CI), or keychain signing on a local Mac
  - `APPLE_TEAM_ID`
  - For API key: `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  - Or for app-specific password: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`
- [ ] Optional: GitHub Actions workflow on tag that runs `pnpm dist:mac` on `macos-latest` with secrets above (Apple requires macOS for signing).

This repo does **not** yet ship Phase C config; releases today follow [Produce a DMG](#produce-a-dmg) with ad-hoc signing.

### Phase D — Every release (after Phase C is done)

- [ ] Bump `"version"` in [apps/desktop/package.json](../apps/desktop/package.json).
- [ ] Run `pnpm dist:mac` on a Mac with signing credentials available.
- [ ] Confirm build log shows **signing** with Developer ID (not `identityName=-`) and **notarization succeeded** (not `skipped macOS notarization`).
- [ ] Smoke-test the **downloaded** DMG on a clean Mac (or VM): install to `/Applications`, open **without** `xattr`, pair, one capture, sync.
- [ ] Tag, push tag to `oppvera`, `gh release create` with `OppveraWatch-arm64.dmg` (same URL partners already use).
- [ ] Shorten release notes: you can drop the `xattr` workaround once notarized builds are default; keep one line pointing here for old unsigned builds if needed.

### Phase E — Partner-facing copy (when notarized)

Update Oppvera Visibility download copy: remove “damaged / xattr” as the primary path; keep a troubleshooting link to this doc for corporate Macs that block all non-Store apps.

## Produce a DMG

1. Bump `"version"` in [apps/desktop/package.json](../apps/desktop/package.json). The footer and About panel show that number.
2. From the repo root:

```bash
pnpm install
pnpm dist:mac
```

3. The file is `apps/desktop/release/Oppvera Watch-<version>-arm64.dmg` (electron-builder may insert the product name and version exactly as in `package.json`).
4. App icon lives in `apps/desktop/build/icon.icns`. Regenerate with `pnpm --filter @oppvera/watch-desktop icon:mac` if you change the logo.
5. Install that `.dmg` somewhere that is not this git checkout and smoke-test pair, Camoufox setup, one provider, one query, and sync.
6. Do not commit `apps/desktop/release/` or `apps/desktop/.stage/`.

`pnpm dist:mac` builds the capture packages, runs `pnpm deploy` so the app has a real `node_modules`, then runs electron-builder for arm64.

## Publish the file

GitHub Releases on `oppvera/oppvera-watch` hold the bytes. Tag the commit you built. Push the tag to `oppvera`, never `oneglanse`.

Rename the asset to a stable name so Oppvera can link `releases/latest`:

```bash
cp "apps/desktop/release/Oppvera Watch-0.3.0-arm64.dmg" /tmp/OppveraWatch-arm64.dmg
gh release create v0.3.0 \
  --repo oppvera/oppvera-watch \
  --title "Oppvera Watch 0.3.0" \
  --notes "Unsigned arm64. After install, run: xattr -cr \"/Applications/Oppvera Watch.app\" (see releasing-macos.md). Pair from the Oppvera Visibility page. Python 3.10+ from python.org is required once." \
  /tmp/OppveraWatch-arm64.dmg
```

Latest download URL:

```text
https://github.com/oppvera/oppvera-watch/releases/latest/download/OppveraWatch-arm64.dmg
```

## Where partners download it

Partners already open Oppvera (hosted on Fly.io) to mint a pairing code. Put **Download Oppvera Watch (macOS Apple silicon)** on the campaign Visibility pairing card, next to the code.

Do not put the `.dmg` in the Fly image or a Fly volume. The image would grow by the size of the app, and every Watch bump would require an Oppvera deploy. Volumes are not a CDN.

Oppvera only links the GitHub Release. Optional Fly env `WATCH_DMG_URL` can override the URL without a code change. Default:

```text
https://github.com/oppvera/oppvera-watch/releases/latest/download/OppveraWatch-arm64.dmg
```

The Visibility card should also say: unsigned build, clear quarantine with `xattr` after install (see [If macOS says the app is damaged](#if-macos-says-the-app-is-damaged)), install Python from python.org, then paste the pairing code in the app. After notarized releases ship, switch that copy to the [Phase E](#phase-e--partner-facing-copy-when-notarized) guidance.

A later `https://oppvera.com/download/watch.dmg` can 302 to that asset, or to an object in Tigris or R2. Do not serve the file from the FastAPI process.

Email Watch nudges can use the same URL. That button lives in the Oppvera repo, not in this one.
