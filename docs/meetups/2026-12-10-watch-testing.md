# Meetup guide: Oppvera Watch hands-on (10 December 2026)

**Audience:** Person running the session (not a script to read aloud).

**Goal:** Marketing testers install Oppvera Watch on **Apple silicon Macs**, pair to a campaign, and run at least one **query-bank capture** that syncs to Oppvera Visibility.

**Download (notarized):** [Latest release](https://github.com/oppvera/oppvera-watch/releases/latest/download/OppveraWatch-arm64.dmg) (v0.7.1+).

## What changed recently (tell attendees this)

| Topic | Old experience (pre–v0.7.1) | Now (v0.7.1+) |
| --- | --- | --- |
| **Install from browser** | Often “damaged” / quarantine; needed Terminal `xattr` | **Notarized Developer ID** — drag to Applications and **open normally** |
| **Python** | Still required for capture | **Still required** — not bundled in the app |

Do **not** lead with `xattr` in the room. Mention it only if someone is on an **old unsigned build** or corporate lockdown (see troubleshooting).

## The Python situation (why facilitators care)

Oppvera Watch uses **Camoufox** (browser automation) inside a **Python virtual environment**. The Electron app does **not** ship Python.

On a typical Mac:

- **No** reliable system Python 3.10+ out of the box.
- The app looks for Python **3.10+** (python.org install paths, Homebrew, or `python3` on PATH).

**Tester journey:**

1. Install **Oppvera Watch** from the DMG (no Terminal for Gatekeeper).
2. Install **Python 3.12** from [python.org](https://www.python.org/downloads/macos/) if the app says Python is missing (**admin password** for the installer).
3. **Quit and reopen** Oppvera Watch.
4. In the app: **Set up Camoufox Python** (downloads deps + browser; **several minutes**, needs Wi‑Fi).
5. Pair from Oppvera **Visibility** (pairing code) on **Settings**. If several campaigns are paired, select **one**. Query bank and Run use that campaign.
6. Run a query-bank capture and confirm it appears in Oppvera.

**Several campaigns:** stay on Settings to store them and pick one to run. Use the **Advanced settings** button on Settings only when someone should run more than one campaign on a schedule. Clicking the version label at the bottom of the window does not open Advanced settings.

Steps 2–4 are the friction point for non-developers. Plan **15–20 minutes** of setup before the “real” test.

## What to send attendees **before** the meetup

Send **5–7 days ahead** and again **2 days ahead**.

### Subject line idea

`Before Dec 10: install Oppvera Watch + Python (one-time, ~15 min)`

### Body (copy and adjust)

```text
We will test Oppvera Watch on your Mac (Apple silicon) on December 10.

Please complete this one-time setup BEFORE the meetup if you can:

1. Download Oppvera Watch (macOS): https://github.com/oppvera/oppvera-watch/releases/latest/download/OppveraWatch-arm64.dmg
2. Open the DMG and drag “Oppvera Watch” to Applications. Open it from Applications — you should NOT need Terminal or “xattr”.
3. If the app asks for Python, install Python 3.12 for macOS from https://www.python.org/downloads/macos/
   (use the macOS 64-bit universal2 / Apple Silicon installer; you may need your Mac admin password).
4. Quit and reopen Oppvera Watch, then click “Set up Camoufox Python” and wait until it finishes (Wi‑Fi required, can take several minutes).
5. Bring your laptop charged; we will pair to a test campaign in the room.

If you use a locked-down work Mac (no admin password), reply before Dec 8 — we may have loaner Macs.

You do not need Git, Node, or Docker.
```

### Ask them to reply with

- **Personal Mac vs work Mac**
- **Whether they can install software** (admin password)
- **Apple silicon** (M1/M2/M3/M4/M5) — Intel Macs are not supported for this build

## Room run sheet (suggested)

| Time | Activity |
| --- | --- |
| 0:00 | Confirm who completed pre-flight; pair loaners for stuck users |
| 0:10 | Group: anyone missing Python → install python.org together |
| 0:25 | Group: **Set up Camoufox Python** while you circulate |
| 0:40 | Pairing codes; one capture per person |
| 1:00 | Open Oppvera Visibility and confirm sync |

Have **one facilitator machine** on Oppvera showing the campaign board so success is visible.

## What attendees need from Oppvera (not Watch)

- Login to hosted Oppvera
- A **campaign** with a query bank
- A **pairing code** from that campaign’s Visibility page (mint fresh codes in the room if needed)

## Troubleshooting cheat sheet

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| “Damaged” on **latest** DMG | Rare; quarantine or wrong file | Confirm `releases/latest`; as last resort `xattr -cr` on the app ([runbook](../runbooks/releasing-macos.md#if-macos-says-the-app-is-damaged)) |
| Python missing | No 3.10+ installed | python.org 3.12 installer, relaunch app |
| Python OK, Camoufox not ready | Setup not run or failed | **Set up Camoufox Python** again; check Wi‑Fi |
| Can't install `.pkg` | Work policy | Loaner Mac or skip capture demo |
| Capture fails | Provider login | Use provider login flow in Watch settings |

## Facilitator checklist (day before)

- [ ] Confirm Oppvera campaign + query bank + pairing works
- [ ] Test **latest** DMG on a clean profile Mac: install → Python → Camoufox → pair → capture
- [ ] Prepare 1–2 **loaner Macs** fully set up (optional but high leverage)
- [ ] Printed or Slack post: python.org link + latest DMG link
- [ ] Note: notarization does **not** remove Python — set expectations early

## After the meetup

- Capture feedback on Python onboarding (issue or doc update)
- Point engineers at [bundling Python](../../apps/desktop/src/python.ts) only if product decides meetup friction is unacceptable long term

## Related docs

- [Releasing macOS apps](../runbooks/releasing-macos.md) — notarization, maintainer builds
- [Desktop app README](../../apps/desktop/README.md) — product behavior