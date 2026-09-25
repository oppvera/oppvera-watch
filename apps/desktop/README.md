# Oppvera Watch desktop

macOS capture client for hosted Oppvera. Current version is **0.3.0** (`version` in `package.json`). The footer and About panel read that value.

Scores stay on Oppvera. This app never asks for an analysis API key.

## Install a built app

Download the `.dmg` from the Oppvera Visibility page or [GitHub Releases](https://github.com/oppvera/oppvera-watch/releases/latest). Drag it to Applications. Right-click **Open** the first time if Gatekeeper blocks an unsigned build.

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
