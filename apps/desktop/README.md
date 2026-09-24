# Oppvera Watch desktop

macOS capture client for hosted Oppvera. It pairs with a campaign, runs the frozen query bank in signed-in consumer UIs (Camoufox/Firefox), and uploads answer text only.

Scores stay on Oppvera. This app never asks for an analysis API key.

## Develop from this repo

```bash
pnpm install
pnpm --filter @oppvera/watch-desktop dev
```

Or `pnpm dev:desktop` from the repo root.

pnpm 10 skips dependency build scripts by default, which leaves Electron without a binary. This repo allowlists `electron` and `apps/desktop` downloads the binary on `pnpm dev:desktop` if it is missing. If Electron crashes with a missing `Electron Framework.framework`, the zip extract was incomplete. `pnpm dev:desktop` wipes that dist and downloads again.

Pair against local Oppvera (`http://127.0.0.1:8000`) or `https://oppvera.com`. Generate a code on the campaign Visibility page.

First capture needs Python 3.10+ from [python.org](https://www.python.org/downloads/). Use **Set up Camoufox Python** once. Docker is not required.

## Package a dmg

```bash
pnpm --filter @oppvera/watch-desktop dist:mac
```

v1 packaging is ad-hoc signed arm64. Capture still expects this git checkout (Camoufox + agent). A fully standalone installer is later work.

## Versioning

The app version is **semver in `apps/desktop/package.json`** (`version` field). The UI footer and macOS About panel read that value at launch. Bump the version when you ship a new desktop release, then build the dmg:

```bash
# edit "version" in apps/desktop/package.json, then:
pnpm --filter @oppvera/watch-desktop dist:mac
```
