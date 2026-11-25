# Oppvera Watch desktop

Desktop capture client for hosted Oppvera, on macOS and Windows. Current version is **0.8.0** (`version` in `package.json`). The footer and About panel read that value.

Pair once per campaign from that campaign’s Visibility page. **Settings** stores every paired campaign under its company and lets you select **one**. Query bank and **Run** use that campaign. Paste another code on Settings to store another campaign. Open **Advanced settings** with the button on Settings when you want several campaigns to run on a schedule. Clicking the footer version label does not open Advanced settings. Provider logins are shared across campaigns. Pending captures sync with the token for the campaign they were captured under.

## One campaign at a time (Settings)

- One pairing code per campaign (from each campaign’s Visibility page in Oppvera).
- The list is grouped by company. The radio selects one campaign. **Query bank** and **Run → Run query bank** use that campaign only.
- Tokens live in `devices.json`. The selected campaign id and schedules live in `watch.json` under app support.
- **Query bank** lists buyer questions with checkboxes (**Select all** / **Deselect all**). Opening **Query bank** or **Run** loads the latest questions for the campaign selected in Settings. **Run** lists those questions under the run buttons.
- After a run, **Retry failed only** re-runs failed provider slots from the last manifest without re-capturing successes.

## Schedules (Advanced settings)

Open **Advanced settings** from the button on **Settings**. The footer version label does not open it.

Each company has one local weekday and hour. Check the campaigns to include, or use **Select all**. The questions for those campaigns appear below, collapsed by campaign. **Pause** grays that company and stops the automatic run until **Resume**. **Run now** still starts the checked campaigns. A campaign paired later stays unchecked until you add it and save. The radio that selects one campaign stays on Settings. **Custom schedule** runs several companies together on one day and hour, using the campaigns checked under each company. You can save more than one custom schedule, so Tuesday and Thursday can each have their own mix. There is no cap on how many campaigns run.

**Run now** under a company, or under a custom schedule, runs those campaigns one after another using the last Run providers, or ChatGPT and Claude when you have not run yet. Providers still run one at a time within each campaign. There is no parallel multi-campaign capture. If two schedules are due at the same hour, each campaign runs once.

Oppvera Watch must stay open (minimized is fine). Quitting the app stops the schedule. Each saved schedule runs at most once per ISO week. The main process checks the local clock every **5 minutes** (`SCHEDULE_POLL_INTERVAL_MS` in `src/watchSchedule.ts`). That loop does **not** call Oppvera; uploads happen only after capture + sync. Advanced settings shows `SCHEDULE_PRIVACY_NOTE`.

## Developer console

Capture logs print in Chromium DevTools (the **Console** tab).

**Open it in Oppvera Watch**

- Alpha builds open DevTools at the bottom of the window on launch.
- Menu: **View → Toggle Developer Tools**.
- Keyboard: Option-Command-I (⌥⌘I) on a Mac, or Ctrl+Shift+I on Windows.
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

Otherwise, if Gatekeeper shows an unidentified-developer dialog (not “damaged”), right-click **Open** once. See [releasing-macos.md](../../docs/runbooks/releasing-macos.md) for more detail.

## Develop from this repo

```bash
pnpm install
pnpm dev:desktop
```

Pair against `https://oppvera.com` or `http://127.0.0.1:8000`. First capture needs Python 3.10+ from python.org, then **Set up Camoufox Python**.

## Camoufox package pin

**Set up Camoufox Python** installs the exact wheel in `CAMOUFOX_PIP_SPEC` (`apps/desktop/src/python.ts`), then downloads the Firefox build stamped in that wheel (`browser-pin.json`). Those Firefox versions often end in `beta`; that label is the paired build, not a floating prerelease channel.

The pin does not update by itself. Before a desktop release, compare it with the latest [`camoufox` release on PyPI](https://pypi.org/project/camoufox/). In the Watch venv, `python -m camoufox version` shows the installed package and the browser on disk. If PyPI is newer, bump `CAMOUFOX_PIP_SPEC`, run setup again, and connect one provider. Leave the pin in place; do not switch setup to `official/stable`.

## Package a dmg

See [docs/runbooks/releasing-macos.md](../../docs/runbooks/releasing-macos.md). Short form:

```bash
pnpm dist:mac
```

The file lands in `apps/desktop/release/`. Do not commit it.
