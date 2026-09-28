# Releasing the macOS app

Build on an Apple silicon Mac that has this repository, Node.js 20+, and pnpm 10. Partners do not need that checkout.

The `.dmg` is ad-hoc signed (`identity: "-"` in electron-builder). Release notes must tell users how to open an unsigned build (see below).

### If macOS says the app is “damaged”

Browsers attach a **quarantine** flag to downloaded files. With an unsigned app, macOS often shows **damaged and can’t be opened** instead of the normal Gatekeeper prompt.

After installing from the `.dmg`, run in Terminal (adjust the path if needed):

```bash
xattr -cr "/Applications/Oppvera Watch.app"
```

Then open the app normally, or right-click → **Open** once if macOS still asks.

To clear quarantine on the download before mounting:

```bash
xattr -cr ~/Downloads/OppveraWatch-arm64.dmg
```

Long term, a Developer ID certificate plus notarization removes this friction; until then, document the `xattr` step on the release and Oppvera download page.

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
  --notes "Unsigned arm64. Right-click Open the first time. Pair from the Oppvera Visibility page. Python 3.10+ from python.org is required once." \
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

The Visibility card should also say: unsigned build, right-click Open, install Python from python.org, then paste the pairing code in the app.

A later `https://oppvera.com/download/watch.dmg` can 302 to that asset, or to an object in Tigris or R2. Do not serve the file from the FastAPI process.

Email Watch nudges can use the same URL. That button lives in the Oppvera repo, not in this one.
