# Releasing the Windows app

Build on **Windows 11** (x64) with this repository, **Node.js 20+**, and **pnpm 10**. Partners install from a **GitHub Release** installer; they do not need Git or Node.

macOS shipping today is documented in [releasing-macos.md](releasing-macos.md). Windows is **desktop v2** in [02-watch-desktop-electron.md](../plans/02-watch-desktop-electron.md): same Electron app and capture stack, different packaging and a few platform-specific code paths.

## Where we are today

| Area | macOS (shipped) | Windows (this runbook) |
| --- | --- | --- |
| Packaged target | `pnpm dist:mac` → arm64 `.dmg` | **Not wired yet** — no `dist:win` script or `electron-builder` `win` block |
| App data paths | `~/Library/Application Support/Oppvera Watch/` | `%APPDATA%\Oppvera Watch\` (already in [paths.ts](../../apps/desktop/src/paths.ts)) |
| Camoufox / fonts | macOS font probes | Windows uses PowerShell font listing ([camoufox.ts](../../apps/agent/src/lib/browser/camoufox.ts)) |
| Child process cleanup | `SIGTERM` / process group | `taskkill` ([main.ts](../../apps/desktop/src/main.ts)) |
| Python discovery / venv | macOS paths + `venv/bin/python` | **Needs work** — [python.ts](../../apps/desktop/src/python.ts) is macOS-oriented |
| Child `PATH` / Node binary | Homebrew paths, `:` delimiter | **Needs work** — [childEnv](../../apps/desktop/src/main.ts) and [childNodeBin](../../apps/desktop/src/main.ts) assume Unix |

Treat the sections below as the **maintainer checklist** to go from “Windows 11 machine available” to a signed or unsigned installer on GitHub Releases.

## One-time setup on your Windows 11 machine

Do this on the PC that will run `pnpm dist:win` and smoke tests.

### Tools

1. **Git for Windows** — [git-scm.com](https://git-scm.com/download/win). Use Git Bash or PowerShell; both work with pnpm.
2. **Node.js 20 LTS** — [nodejs.org](https://nodejs.org/). Confirm:

   ```powershell
   node -v
   ```

3. **pnpm 10.16.0** (matches the repo):

   ```powershell
   corepack enable
   corepack prepare pnpm@10.16.0 --activate
   pnpm -v
   ```

4. **Python 3.12** — [python.org downloads](https://www.python.org/downloads/windows/). During install:

   - Check **Add python.exe to PATH** (or “Add Python to environment variables”).
   - Prefer **Install for all users** on a shared build VM if you use one.

5. **Disable the Microsoft Store `python` alias** (common blocker): **Settings → Apps → Advanced app settings → App execution aliases** → turn off **python.exe** and **python3.exe** so `python` resolves to python.org.

6. Confirm Python before cloning the repo:

   ```powershell
   py -3.12 -V
   py -3.12 -c "import sys; print(sys.version_info[:2])"
   ```

### Clone and install dependencies

```powershell
git clone https://github.com/oppvera/oppvera-watch.git
cd oppvera-watch
pnpm install
```

`electron` and native add-ons download Windows binaries on first install. Allow network through any corporate firewall.

### Optional: Visual C++ runtime

Electron ships its own runtime; partners need the **Microsoft Visual C++ Redistributable** only if a dependency doc calls for it. If the packaged app fails to start with a DLL error, install the latest [VC++ redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) on the test machine.

## Repository work before the first Windows installer

Complete these on a branch, merge to `main`, then follow [Produce an installer](#produce-an-installer) on Windows.

### 1. Windows Python paths (`apps/desktop/src/python.ts`)

- **Discover Python** using Windows-friendly candidates, for example:
  - `py -3.12`, `py -3.11`, `py -3.10` (Windows launcher)
  - `%LocalAppData%\Programs\Python\Python312\python.exe`
  - `C:\Program Files\Python312\python.exe`
  - `python3`, `python` on `PATH` after the Store alias is off
- **Virtualenv interpreter**: use `Scripts\python.exe` under the app venv, not `bin/python`:

  ```text
  %APPDATA%\Oppvera Watch\python-venv\Scripts\python.exe
  ```

- Keep the same UX: first-run message points to python.org; **Set up Camoufox Python** runs `venv` → `pip install camoufox` → `camoufox fetch` (same as macOS, longer on first run).

### 2. Child process environment (`apps/desktop/src/main.ts`)

- **`childNodeBin()`**: when not packaged, resolve `node.exe` from `process.execPath`’s directory, `npm_node_execpath`, or `where node` — do not rely on `/opt/homebrew/bin/node`.
- **`childEnv()`**: join `PATH` with `;` on `win32`, not `:`. Omit mac-only PATH entries on Windows.

### 3. Packaging script (mirror macOS)

Add `apps/desktop/scripts/stage-win.mjs` parallel to [stage-mac.mjs](../../apps/desktop/scripts/stage-mac.mjs):

1. `pnpm` build workspace packages and `@oppvera/watch-desktop`.
2. `pnpm deploy --prod` into `apps/desktop/.stage`.
3. Copy `apps/desktop/build` into the stage tree (icons).
4. Run `electron-builder --projectDir .stage --win --x64` with output `apps/desktop/release`.

Add root and desktop scripts:

- Root [package.json](../../package.json): `"dist:win": "pnpm --filter @oppvera/watch-desktop dist:win"`
- [apps/desktop/package.json](../../apps/desktop/package.json): `"dist:win": "node scripts/stage-win.mjs"`

### 4. `electron-builder` Windows config

In `apps/desktop/package.json` → `"build"`, add a `win` section, for example:

```json
"win": {
  "icon": "build/icon.ico",
  "target": [
    {
      "target": "nsis",
      "arch": ["x64"]
    }
  ]
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "installerIcon": "build/icon.ico",
  "uninstallerIcon": "build/icon.ico"
}
```

- **Icon**: create `apps/desktop/build/icon.ico` (256×256 multi-size). Source art is `build/icon.png`; convert with ImageMagick, GIMP, or an online `.ico` generator. Document regeneration in [apps/desktop/build/README.md](../../apps/desktop/build/README.md).
- **Architecture**: ship **x64** first on Windows 11. Arm64 Windows is optional later.

### 5. CI (optional)

Extend [.github/workflows/build.yml](../../.github/workflows/build.yml) with a `windows-latest` job running `pnpm typecheck` and `pnpm test` so regressions surface before you build on a physical PC. **Packaging** still belongs on a Windows host (or a self-hosted runner) because that is where you sign and smoke-test the installer.

## Develop and smoke-test on Windows

Before cutting an installer, prove the unpackaged app on the same machine.

```powershell
pnpm install
pnpm dev:desktop
```

Checklist:

- [ ] Pair against `https://oppvera.com` or local Oppvera (`http://127.0.0.1:8000`).
- [ ] **Set up Camoufox Python** completes and a provider **Connect** opens Camoufox/Firefox.
- [ ] Run one query on one provider; capture file appears under `%APPDATA%\Oppvera Watch\captures\`.
- [ ] **Sync** uploads to Oppvera; no cookies or `storageState` in the payload (same as macOS).
- [ ] Quit mid-run; child Firefox exits (no orphan `firefox.exe` in Task Manager).

**Developer tools** (same env vars as macOS — see [apps/desktop/README.md](../../apps/desktop/README.md)):

- `WATCH_OPEN_DEVTOOLS=1`
- `WATCH_DEBUG_LOGS=1` or `DEBUG_ENABLED=1`

Keyboard shortcut for DevTools on Windows is **Ctrl+Shift+I** (not Option-Command-I).

### Data on disk (partner machines)

```text
%APPDATA%\Oppvera Watch\
  auth\sessions\{provider}\{provider}-auth.json
  auth\status\{provider}.json
  captures\{client_capture_id}.json
  devices.json
  watch.json
  python-venv\
```

Camoufox caches its Firefox build under the user profile (Camoufox default; not overridden in this repo). Session JSON is secret — never log or upload it.

## Code signing (recommended before external partners)

Unsigned Windows builds often trigger **Microsoft Defender SmartScreen** (“Windows protected your PC”). For a smoother install:

| Approach | When to use |
| --- | --- |
| **Unsigned** | Internal Oppkey testing only; click **More info → Run anyway** on SmartScreen |
| **Standard code signing** (Authenticode) | Design partners and customers; reduces SmartScreen friction over time as reputation builds |
| **EV code signing** | Faster SmartScreen trust; hardware token or HSM; org verification |

Typical **electron-builder** env vars on the build machine (store in a private script, never commit):

```text
CSC_LINK=path\to\certificate.pfx
CSC_KEY_PASSWORD=***
```

Or use a certificate in the Windows certificate store and set `certificateSubjectName` in the `win` block to match the publisher in the cert.

This is **not** the Microsoft Store. You keep publishing the same GitHub Release installer URL pattern as macOS, with a Windows asset name (see below).

Signing does not replace functional testing: run the **installed** `.exe` from `%LocalAppData%\Programs\` or the path chosen in the NSIS wizard, not only the unpacked dev app.

## Produce an installer

After [repository work](#repository-work-before-the-first-windows-installer) is on `main`:

1. Bump `"version"` in [apps/desktop/package.json](../../apps/desktop/package.json). The footer and About panel show that number.
2. From the repo root in PowerShell or Git Bash:

   ```powershell
   pnpm install
   pnpm dist:win
   ```

3. Artifact location (exact name follows `productName` and version):

   ```text
   apps\desktop\release\Oppvera Watch Setup <version>.exe
   ```

   NSIS may also emit an unpacked dir under `release\win-unpacked\` for debugging.

4. Copy the installer **outside** this git checkout and smoke-test on a clean Windows profile if possible:

   - Install, launch, pair, Camoufox setup, one provider, one query, sync.
   - Uninstall from **Settings → Apps** and confirm user data under `%APPDATA%\Oppvera Watch\` is left in place (expected — partners may reinstall).

5. Do **not** commit `apps/desktop/release/` or `apps/desktop/.stage/`.

`pnpm dist:win` should mirror `pnpm dist:mac`: build capture packages, `pnpm deploy` for a real `node_modules`, then electron-builder.

## Publish the file

GitHub Releases on `oppvera/oppvera-watch` hold the bytes. Tag the commit you built. Push the tag to **`oppvera`**, never `oneglanse`.

Use a **stable download filename** so hosted Oppvera can link `releases/latest` (parallel to the Mac DMG):

```powershell
Copy-Item "apps\desktop\release\Oppvera Watch Setup 0.8.0.exe" $env:TEMP\OppveraWatch-x64-setup.exe
gh release create v0.8.0 `
  --repo oppvera/oppvera-watch `
  --title "Oppvera Watch 0.8.0" `
  --notes "Windows x64 NSIS installer. Pair from the Oppvera Visibility page. Python 3.10+ from python.org is required once." `
  $env:TEMP\OppveraWatch-x64-setup.exe
```

Suggested latest download URL (add when the first Windows release ships):

```text
https://github.com/oppvera/oppvera-watch/releases/latest/download/OppveraWatch-x64-setup.exe
```

You can attach **both** Mac and Windows assets to one release tag (e.g. `v0.8.0`) or ship Windows on its own tag until versioning aligns — prefer **one tag per semver** with both platforms when both are ready.

### Hosted Oppvera download button

Today the Visibility page points at the Mac DMG. When Windows is ready, add **Download Oppvera Watch (Windows)** in the Oppvera repo with the URL above (or env override such as `WATCH_WINDOWS_SETUP_URL` — naming is a product choice in that repo). Do not bundle the installer in the Fly.io image; link GitHub Releases only (same rationale as [releasing-macos.md](releasing-macos.md)).

## Troubleshooting

### SmartScreen or “Unknown publisher”

Expected for unsigned builds. Sign the installer or use an internal distribution channel until reputation builds.

### `python` opens the Store or is not found

Turn off App execution aliases; reinstall Python from python.org with PATH enabled; reopen the terminal.

### Camoufox fetch fails (firewall, proxy)

`camoufox fetch` downloads Firefox bits. Corporate proxies may need explicit proxy env vars. Surface stderr in the UI; do not fall back to stock Chromium for provider capture.

### Provider window does not appear

Check DevTools console and verbose logs (`WATCH_DEBUG_LOGS=1`). Confirm Windows display scaling does not push the Camoufox window off-screen.

### Sync works on Mac but not Windows

Usually pairing token or campaign id — not OS-specific. Confirm `%APPDATA%\Oppvera Watch\devices.json` has the expected campaign and that HTTPS to Oppvera is allowed.

## Every release (after the first installer)

- [ ] Bump `apps/desktop/package.json` version (single semver across Mac and Windows when both ship from the same tag).
- [ ] Run `pnpm dist:win` on Windows with signing secrets loaded if you sign.
- [ ] Confirm the log shows signing (or a deliberate unsigned internal build).
- [ ] Smoke-test the **downloaded** installer: install, open without SmartScreen workarounds if signed, pair, capture, sync.
- [ ] Tag, push to `oppvera`, `gh release create` with `OppveraWatch-x64-setup.exe` (and Mac DMG if same version).
- [ ] Update release notes: Python one-time setup, pairing per campaign, link to this doc for maintainers.

## Related docs

- [releasing-macos.md](releasing-macos.md) — Mac build, notarization, `OppveraWatch-arm64.dmg`
- [02-watch-desktop-electron.md](../plans/02-watch-desktop-electron.md) — product scope and platform roadmap
- [apps/desktop/README.md](../../apps/desktop/README.md) — UI behavior and dev env vars