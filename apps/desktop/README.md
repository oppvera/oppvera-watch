# Oppvera Watch desktop

macOS capture client for hosted Oppvera. It pairs with a campaign, runs the frozen query bank in signed-in consumer UIs (Camoufox/Firefox), and uploads answer text only.

Scores stay on Oppvera. This app never asks for an analysis API key.

## Develop from this repo

```bash
pnpm install
pnpm --filter @oppvera/watch-desktop dev
```

Or `pnpm dev:desktop` from the repo root.

pnpm 10 skips dependency build scripts by default, which leaves Electron without a binary. This repo allowlists `electron` and `apps/desktop` downloads the binary on `pnpm dev:desktop` if it is missing. If you still see `Electron failed to install correctly`, run `pnpm --filter @oppvera/watch-desktop exec node scripts/ensure-electron.mjs`.

Pair against local Oppvera (`http://127.0.0.1:8000`) or `https://oppvera.com`. Generate a code on the campaign Visibility page.

First capture needs Python 3.10+ from [python.org](https://www.python.org/downloads/). Use **Set up Camoufox Python** once. Docker is not required.

## Package a dmg

```bash
pnpm --filter @oppvera/watch-desktop dist:mac
```

v1 packaging is ad-hoc signed arm64. Capture still expects this git checkout (Camoufox + agent). A fully standalone installer is later work.
