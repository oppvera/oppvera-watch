# Contributing to Oppvera Watch

Oppvera Watch is a macOS capture client for hosted Oppvera. It is MIT-licensed. The capture engine began as [OneGlanse](https://github.com/aryamantodkar/oneglanse). That upstream repo is the archive of the old dashboard and Docker stack. Do not add those back here.

## Git history

`main` is a single squashed commit (current tree only). OneGlanse monorepo history is not in this repository; attribution lives in `LICENSE` and the initial commit message. Remote `oneglanse` stays fetch-only for occasional cherry-picks. After a history rewrite, use a fresh clone or `git fetch oppvera && git reset --hard oppvera/main` on `main`; delete stale local topic branches that still point at the old graph.

## Development setup

Root `package.json` sets `"private": true` so this monorepo is not published to npm. It does not affect GitHub visibility.

Requirements: Apple silicon or any Mac for `pnpm dev:desktop`, Node.js 20+, pnpm 10+, Git. Python 3.10+ is needed only when you connect a provider.

```bash
git clone https://github.com/oppvera/oppvera-watch.git
cd oppvera-watch
pnpm install
pnpm dev:desktop
```

Packaging a downloadable app is [docs/releasing-macos.md](docs/releasing-macos.md).

## Project layout

```text
apps/desktop/     Electron UI, pairing, sync, dmg packaging
apps/agent/       Camoufox launch, provider scripts, session files
packages/types/   Shared TypeScript types
packages/errors/  Typed errors
packages/utils/   Selectors and small helpers
docs/plans/       Watch and Probe specs
```

## Checks

```bash
pnpm typecheck
pnpm test
```
