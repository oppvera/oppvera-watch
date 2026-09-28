# Oppvera Watch desktop

macOS capture client for hosted Oppvera. Current version is **0.4.0-alpha** (`version` in `package.json`). The footer and About panel read that value.

Pair once per campaign from that campaign’s Visibility page. **Settings** lists every paired campaign, lets you add or remove campaigns, and chooses the **active** one used by the query bank and the **Run** tab. Provider logins are shared across campaigns. Pending captures sync with the token for the campaign they were captured under.

## Multiple campaigns

- One pairing code per campaign (from each campaign’s Visibility page in Oppvera).
- Tokens live in `devices.json`; the active campaign id and max group size live in `watch.json` under app support.
- **Query bank** and **Run → Run query bank** always use the active campaign only.

## Advanced: sequential group runs

Group runs are **not** on the **Run** tab. Open the **Advanced** dialog from the footer:

- **Option-click** (⌥-click) the version label (`Oppvera Watch v…` at the bottom of the window), or
- **Click that label seven times** within about two seconds.

In Advanced you can set **Max campaigns in a group** (2–4), select campaigns and providers, then **Run selected campaigns**. Watch runs one campaign’s query bank to completion, then the next, using the same saved provider logins. Providers still run one at a time within each campaign. There is no parallel multi-campaign capture.

## Developer console

Capture logs print in Chromium DevTools (the **Console** tab).

**Open it in Oppvera Watch**

- Alpha builds open DevTools at the bottom of the window on launch.
- Menu: **View → Toggle Developer Tools**.
- Keyboard: Option-Command-I (⌥⌘I).
- **What we have tested** in the header also describes this.

**Environment overrides**

Prerelease versions whose semver includes `alpha` automatically:

- Open DevTools when the app starts.
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
