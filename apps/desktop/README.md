# Oppvera Watch desktop

macOS capture client for hosted Oppvera. Current version is **0.3.1-alpha** (`version` in `package.json`). The footer and About panel read that value.

## Debugging during alpha

Prerelease versions whose semver includes `alpha` automatically:

- Open Chromium DevTools when the app starts (capture logs appear in the Console tab).
- Set `DEBUG_ENABLED=1` for the Camoufox capture child (verbose agent `logger.debug` output).

You can force the same behavior on any build:

- `WATCH_OPEN_DEVTOOLS=1` — open DevTools in a packaged app.
- `WATCH_DEBUG_LOGS=1` or `DEBUG_ENABLED=1` — verbose agent logs (forwarded to DevTools via `watch:log`).

Run failures also surface `lastError` in the footer error line, including per-query metadata when the capture engine throws `BaseError`.

Scores stay on Oppvera. This app never asks for an analysis API key.

## Install a built app

Download the `.dmg` from the Oppvera Visibility page or [GitHub Releases](https://github.com/oppvera/oppvera-watch/releases/latest). Drag it to Applications.

If macOS says the app is **damaged** (common after a browser download), clear the quarantine flag:

```bash
xattr -cr "/Applications/Oppvera Watch.app"
```

Otherwise right-click **Open** the first time if Gatekeeper blocks an unsigned build. See [releasing-macos.md](../../docs/releasing-macos.md) for more detail.

## Develop from this repo

```bash
pnpm install
pnpm dev:desktop
```

Pair against `https://oppvera.com` or `http://127.0.0.1:8000`. First capture needs Python 3.10+ from python.org, then **Set up Camoufox Python**.

## Package a dmg

See [docs/releasing-macos.md](../../docs/releasing-macos.md). Short form:

```bash
pnpm dist:mac
```

The file lands in `apps/desktop/release/`. Do not commit it.
