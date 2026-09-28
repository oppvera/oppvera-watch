![Oppvera Watch — AI Visibility Monitoring](docs/images/oppvera-watch-logo.png)

# Oppvera Watch

**Oppvera Watch** is a **macOS capture client** for [Oppvera](https://oppvera.com). It opens real consumer AI product UIs (ChatGPT, Claude, Gemini, Perplexity, Google AI Overview), records what those pages render, and uploads **answer text and citations** to a paired campaign.

GEO scores, dashboards, and query-bank editing live on **hosted Oppvera**. This app does not score, chart, or store analytics locally.

The capture engine started as a fork of [OneGlanse](https://github.com/aryamantodkar/oneglanse). This repository is only the Mac client. Original OneGlanse features (dashboard, Docker, analysis keys) live on that upstream repo if you need to look them up. Do not merge `oneglanse/main`.

## Install

1. On the campaign **Visibility** page in Oppvera, choose **Download Oppvera Watch** (macOS, Apple silicon). The file is also attached to [GitHub Releases](https://github.com/oppvera/oppvera-watch/releases/latest).
2. Open the `.dmg` and drag **Oppvera Watch** to Applications.
3. The build is ad-hoc signed. If macOS blocks the first open, right-click the app and choose **Open**. You can also run `xattr -dr com.apple.quarantine "/Applications/Oppvera Watch.app"`.
4. Install [Python 3.12](https://www.python.org/downloads/) if the app asks, then use **Set up Camoufox Python** once.
5. Paste a pairing code from that campaign’s Visibility page. Repeat for each campaign you want on this Mac (one code per campaign).

You do not need Node.js, Git, or this repository to use the app.

## How it works

1. Pair with `https://oppvera.com` (or `http://127.0.0.1:8000` for a local Oppvera). Use **Settings** to add more campaigns; pick the **active** campaign for the query bank and **Run** tab.
2. Connect the consumer accounts you already pay for. Logins stay on this Mac and are shared across paired campaigns.
3. The query bank is read-only. Edit questions in Oppvera.
4. Run connected providers one at a time for the active campaign. Stop ends the capture, including Firefox.
5. Sync uploads pending captures (each row uses the token for the campaign it was captured under). Oppvera scores them. Watch never asks for an analysis key.

### Multiple campaigns and group runs

One Mac can hold several paired campaigns. Only the **active** campaign drives **Query bank** and **Run → Run query bank**.

To run **2–4 campaigns in one session** (sequential: each campaign’s full query bank, then the next, same provider logins), open **Advanced**:

- **Option-click** (⌥-click) the version label in the footer, or
- **Click the version label seven times** within about two seconds.

Choose campaigns and providers, then **Run selected campaigns**. Runs are not parallel. Details: [apps/desktop/README.md](apps/desktop/README.md).

## Developer console

Capture logs appear in Chromium DevTools.

- Alpha builds open the panel at the bottom when Oppvera Watch starts.
- Choose **View → Toggle Developer Tools**, or press Option-Command-I (⌥⌘I).
- Use the **Console** tab.

See [apps/desktop/README.md](apps/desktop/README.md) for `WATCH_OPEN_DEVTOOLS` and verbose capture logging.

## Requirements

| Who | Need |
| --- | --- |
| Anyone capturing | Apple silicon macOS, Python 3.10+, network, and a pairing code per campaign you capture |
| Signed-in captures | Your consumer logins in the Camoufox window |
| Developers | Node.js 20+, pnpm 10+, this git checkout |

## Develop

```bash
git clone https://github.com/oppvera/oppvera-watch.git
cd oppvera-watch
pnpm install
pnpm dev:desktop
```

To build a `.dmg` and publish it, see [docs/releasing-macos.md](docs/releasing-macos.md).

## Data that stays on the Mac

Under `~/Library/Application Support/Oppvera Watch/`:

- Playwright session files (cookies / `storageState`)
- Device pairing tokens (one per paired campaign)
- Unsynced capture files

Camoufox’s Firefox build is cached at `~/Library/Caches/camoufox` (the Camoufox installer has no custom directory flag).

Watch uploads question text, answer markdown, citations, provider labels, and ids. It never uploads cookies, `storageState`, passwords, or localStorage.

## Documentation

- [apps/desktop/README.md](apps/desktop/README.md) — desktop develop notes
- [docs/releasing-macos.md](docs/releasing-macos.md) — produce a `.dmg` and publish it
- [docs/plans/README.md](docs/plans/README.md) — Watch / Probe specs (not a consumer install guide)

## License

This project is **MIT licensed**. See [LICENSE](LICENSE).

- Original capture project: **Aryaman Todkar / OneGlanse**
- This fork and desktop product: **Craig Oda / Oppvera Watch**

Suggested credit:

> Based on [OneGlanse](https://github.com/aryamantodkar/oneglanse) (MIT) and [Oppvera Watch](https://github.com/oppvera/oppvera-watch) (MIT).

**Trademark note:** "OneGlanse" is the upstream project name. Oppvera Watch is an independent fork and is not an official OneGlanse release.

Application code is MIT. Camoufox, Playwright, Electron, and other packages ship under their own licenses.
