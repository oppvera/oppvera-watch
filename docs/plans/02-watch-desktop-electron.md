# Oppvera Watch desktop (macOS, Electron)

## Recommendation

Use **Electron** for v1. Do not start with Tauri.

The capture engine is already Node plus Python Camoufox plus Firefox (`apps/agent/src/lib/browser/camoufox.ts`). Installer size is dominated by that browser, not by the shell. Electron keeps the agent in TypeScript, runs it as a child process, and packages a `.dmg` with electron-builder. Tauri would still need the same Node or Python sidecar and adds Rust for a team that is not maintaining Rust.

Tauri 2 can be revisited later for a thinner native window on either OS.

## Platform roadmap

| Phase | Platform | Scope |
| --- | --- | --- |
| **Desktop v1** | **macOS** (Apple silicon first; Intel optional) | Ship `.dmg`, prove capture + Oppvera sync |
| **Desktop v2** | **Windows** | Same Electron app and capture code; add Windows installer (e.g. NSIS via electron-builder) and Camoufox/Python packaging for Windows |
| **Not planned** | Linux desktop | No target date; would need separate Camoufox support validation |

macOS is the **first** desktop release, not the only one. Do not block v1 design choices that would prevent a later Windows build.

## Electron and future Windows

**Electron does not lock you out of Windows.** It is the common path for one codebase on macOS and Windows (VS Code, Slack, etc.). The same main process, renderer, and child capture runner can ship on both; electron-builder supports `.dmg` and `.exe`/MSI.

What is **platform-specific** (for every shell, including Tauri):

- **Camoufox + Python + Firefox** install paths and first-run setup (today macOS-focused in `camoufox.ts`)
- **Session storage** location (Application Support vs `%APPDATA%`)
- **Code signing / notarization** (Apple) vs Authenticode (Windows)
- Provider login flows may behave differently on Windows (still consumer UIs, not API)

Choosing Electron for macOS v1 **helps** Windows v2: you keep one TypeScript UI and one Node capture process. The extra work for Windows is mostly **packaging and testing Camoufox on Windows**, not rewriting the app in another desktop framework.

Avoid macOS-only APIs in the capture path without an abstraction (keychain vs credential file is fine for v1 with a Windows equivalent later).

Start this work **after** hosted Oppvera passes Phase A in [README.md](README.md): Probe persists, analytics scores, and the campaign visibility UI work in the Oppvera repo alone. The desktop app only adds `source=watch` rows and pairing; it is not required to validate Probe or GEO dashboards.

## Product surface

The desktop app is a capture client. It is not the current Next.js product.

### Screens

1. **Pair** — Oppvera base URL (default `https://oppvera.com`, overridable for local `http://127.0.0.1:8000`) and a pairing code. On success, store the device token in the macOS keychain (or, for v1, an app-scoped file outside the repo with mode `0600`). Show organization, company, and campaign name returned by the API.
2. **Query bank** — read-only list from `GET /api/probe/campaigns/{id}/query-bank`. The user does not author prompts in Watch. If the bank is empty, explain that they add questions in Oppvera.
3. **Providers** — connect or reset `chatgpt`, `claude`, `gemini`, `perplexity`, and Google (covers Gemini and AI Overview, matching today's auth groups). Opens a visible Camoufox window for interactive login. Status is local only.
4. **Run** — user picks which connected providers to run, then starts. Sequential, one provider at a time (today's worker concurrency is already 1). Progress per prompt: pending, running, captured, failed.
5. **Sync** — uploads unsynced captures. Shows last success, retry, and a count waiting offline.

No dashboard, no scores, no workspace admin, no email/password account local to Watch.

## What to keep from this repo

Reuse, do not rewrite, unless a dependency on Docker or Redis forces a cut:

- `apps/agent/src/core/providers/**` — DOM automation per product
- `apps/agent/src/core/prompt-runner/**` — type, wait, extract markdown and sources
- `apps/agent/src/lib/browser/**` — Camoufox launch
- `apps/agent/src/auth/cli.ts` — interactive login, retargeted at the Electron "Connect" button
- `packages/types` `AskPromptResult` and `Source` — map these to the ingest body in [03-oppvera-probe-ingest-api.md](03-oppvera-probe-ingest-api.md)

Session files stay on the Mac under an app support directory, replacing `.oneglanse-storage`:

```text
~/Library/Application Support/Oppvera Watch/
  auth/sessions/{provider}/{provider}-auth.json
  auth/status/{provider}.json
  captures/{client_capture_id}.json
  sync-queue.json
```

`storageState` JSON is a secret. Do not log it, do not upload it, do not put it in the pairing token file.

## What to remove from the desktop product

Do not ship or start:

- `docker-compose.yml` services (Postgres, Redis, ClickHouse, web, migrate, agent-worker)
- BullMQ and Redis. Run prompts in-process.
- `packages/services/src/analysis/**` and any `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` requirement
- Next.js routes for dashboard, sources, people, Better Auth, and onboarding
- VPS auth upload (`POST /auth/sessions` on port 3333) and residential proxy mode
- `pnpm local` as the supported install once the `.dmg` exists

Leave the monorepo code in git until the Electron path runs the same providers. Delete from the **user-facing** install path first; do not do a drive-by deletion of unused packages in the first desktop PR unless the build requires it.

## Process model

```text
Electron main
  ├── renderer (small React or plain HTML UI)
  └── utility process or child: capture runner
        ├── node prompt runner
        └── python3 camoufox launch_options → Firefox
```

The renderer must not import Playwright. The main process holds the device token and performs HTTPS calls to Oppvera.

Capture runner input:

```json
{
  "run_id": "uuid",
  "campaign_id": "uuid",
  "company_id": "uuid",
  "workspace_id": "uuid",
  "brand_name": "string",
  "brand_domain": "string",
  "provider": "chatgpt",
  "queries": [
    { "query_item_id": "q1", "text": "best tool for ..." }
  ]
}
```

Capture runner output per prompt: a file matching the ingest object in doc 03, with `sync_status: pending`.

On each success or at end of run, main process `POST /api/probe/captures`. Network failure leaves files pending and retries with backoff. Idempotency key is `client_capture_id`.

## Camoufox on a Mac that is not a developer machine

v1 may require the user to have network on first launch.

First launch:

1. Find `python3.12`, `python3.11`, `python3.10`, or `python3` (same order as `camoufox.ts`).
2. If missing, show a single message: install Python 3.12 from python.org, then relaunch. Do not embed a full CPython build in v1 unless packaging proves easy.
3. `pip install` camoufox into an app-owned virtualenv under Application Support, not the user's global site-packages.
4. Let Camoufox download its Firefox build into that virtualenv's cache.
5. If import or download fails, show stderr in the UI. Do not fall back to stock Playwright Chromium. The providers depend on Camoufox's fingerprint browser.

Document this in the app's first-run screen, not as a Docker prerequisite.

Signing: ad-hoc signature is enough for local Oppkey use. Notarization can wait until a build is handed to a design partner.

## Electron app layout (new)

Add `apps/desktop/` (names can match repo style):

| Path | Role |
| --- | --- |
| `apps/desktop/package.json` | `electron`, `electron-builder`, script `dist:mac` |
| `apps/desktop/src/main.ts` | window, keychain/token, sync, IPC |
| `apps/desktop/src/preload.ts` | narrow IPC bridge |
| `apps/desktop/src/renderer/` | the five screens above |
| `apps/desktop/src/capture.ts` | calls existing agent functions without BullMQ |

Do not create a second copy of provider scripts. Import from `apps/agent` or extract a library only where BullMQ, Redis, or ClickHouse imports block a clean process start.

Target: `electron-builder` `mac` `dmg`, arch `arm64` first (Apple silicon). Intel `x64` is optional and not required for v1.

## Local development of the shell

```bash
cd apps/desktop
pnpm install
pnpm dev
```

Point the base URL at a local Oppvera (`http://127.0.0.1:8000`) from [03](03-oppvera-probe-ingest-api.md). Until that API exists, a fixture JSON file of the query bank and a mock POST that writes to `captures/` is enough to test the runner.

## Acceptance

- A Mac with Docker **not** running can pair, connect one provider, run one query, and upload or queue one capture file.
- No analysis API key is read from the environment.
- Quitting mid-run does not upload cookies.
- Re-running sync does not duplicate rows when the server returns the existing `client_capture_id`.
- The UI never shows a GEO score. Scores are on Oppvera.
