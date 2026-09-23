# Oppvera Watch + Probe analytics specs

These documents are the build brief for splitting **Oppvera Watch** into a desktop capture client (**macOS first**, **Windows planned**) and putting **GEO analytics** in the hosted Oppvera app. Watch and **Oppvera Probe** share one capture store and one scoring pipeline.

They live in this Watch repo so a Cursor session can implement either side:

- Watch desktop: this repository (`oppvera/oppvera-watch`)
- Probe ingest, persistence, and analytics: [codetricity/oppvera](https://github.com/codetricity/oppvera) → `app/lab/demo/`

Do not treat these files as shipped product docs for marketers. The public install guide stays in the root [README](../../README.md) until the desktop app replaces Docker.

## Validate on Oppvera before Oppvera Watch

You can ship and test the **hosted loop first** without changing this Watch repo or building Electron.

**Phase A — Oppvera only (Probe + analytics + UI):**

1. **Done** — Persist Probe into `visibility_captures` ([04](04-oppvera-probe-persistence.md), Oppvera v0.89.0, [PR #268](https://github.com/codetricity/oppvera/pull/268)).
2. Run the shared scorer and the campaign visibility pages ([05](05-unified-analytics.md)).
3. Run Probe from Development (or a campaign bank run when built), restart the server, confirm history and scores in the UI.
4. Optional: email reports ([08](08-email-reports-and-nudges.md)) using Probe-only data; Watch banner shows "never" until a desktop sync exists.

At the end of Phase A you have a working product surface: **API-labeled captures, GEO metrics, and HTMX dashboards** on real campaign data. That is the milestone to demo and iterate on before desktop work.

**Phase B — Oppvera Watch (this repo):**

5. Watch ingest API and device pairing ([03](03-oppvera-probe-ingest-api.md)).
6. **macOS** Electron capture client ([02](02-watch-desktop-electron.md)) — desktop v1.
7. UI-vs-API compare and mixed-source filters once both `source=probe` and `source=watch` rows exist ([05](05-unified-analytics.md), [06](06-query-bank-and-runs.md)).
8. **Windows** Electron build (planned desktop v2, after macOS v1) — same stack; see [02](02-watch-desktop-electron.md).

Do not start Phase B until Phase A meets the acceptance criteria in docs 04 and 05 (Probe persists, scores, and the campaign visibility UI renders). The desktop app only adds rows to tables and screens that already work for Probe.

## Implementation status

| Doc | Oppvera (`app/lab/demo`) | Notes |
| --- | --- | --- |
| [04](04-oppvera-probe-persistence.md) | **Done** — v0.89.0 | [PR #268](https://github.com/codetricity/oppvera/pull/268) on `main` |
| [05](05-unified-analytics.md) | Not merged | Scorer + campaign visibility UI |
| [03](03-oppvera-probe-ingest-api.md), [06](06-query-bank-and-runs.md), [08](08-email-reports-and-nudges.md) | Not started | Phase A |
| [02](02-watch-desktop-electron.md) | N/A (Watch repo) | Phase B |

Update this table when each spec lands on [codetricity/oppvera](https://github.com/codetricity/oppvera) `main`.

## Reading order

1. [01-product-split.md](01-product-split.md) — what Watch, Probe, and the Studio lab each own, labeling, and **cost control**.
2. [02-watch-desktop-electron.md](02-watch-desktop-electron.md) — macOS Electron shell, Camoufox, no Docker.
3. [03-oppvera-probe-ingest-api.md](03-oppvera-probe-ingest-api.md) — device pairing and `POST /api/probe/captures`.
4. [04-oppvera-probe-persistence.md](04-oppvera-probe-persistence.md) — save Probe API passes into the same tables.
5. [05-unified-analytics.md](05-unified-analytics.md) — OneGlanse-style scores on both sources.
6. [06-query-bank-and-runs.md](06-query-bank-and-runs.md) — one frozen buyer-question list for both collectors.
7. [07-legal-tos-and-attribution.md](07-legal-tos-and-attribution.md) — provider ToS, cookies, MIT credit.
8. [08-email-reports-and-nudges.md](08-email-reports-and-nudges.md) — monthly email with Probe summary and Oppvera Watch stale banner.

## Implementation sequence

Build in this order. Specs can be written together; code should not skip ahead.

**Phase A (Oppvera repo — test without desktop):**

1. ~~Oppvera schema and Probe persistence~~ **Done** ([04](04-oppvera-probe-persistence.md), [PR #268](https://github.com/codetricity/oppvera/pull/268)).
2. Shared scorer and campaign analytics UI on **Probe-only** data ([05](05-unified-analytics.md)). Filters for Watch can show empty states until Phase B.
3. Campaign query-bank Probe runs when ready ([06](06-query-bank-and-runs.md)), still on hosted Oppvera.
4. Campaign email reports with Probe teaser ([08](08-email-reports-and-nudges.md)); Watch stale banner is fine with no UI captures yet.

**Phase B (Watch repo + Oppvera ingest):**

5. Watch ingest API and device pairing ([03](03-oppvera-probe-ingest-api.md)).
6. **macOS** Electron client ([02](02-watch-desktop-electron.md)) — desktop v1.
7. UI-vs-API compare and full mixed-source filters once Watch rows exist ([05](05-unified-analytics.md), [06](06-query-bank-and-runs.md)).
8. **Windows** Electron client (desktop v2, after macOS v1) — [02](02-watch-desktop-electron.md).

## Objectives

1. Isolate Watch capture so it runs without Redis or Postgres.
2. Ship a **macOS** Electron shell (desktop v1); **Windows** build planned as v2 with the same stack.
3. Bundle or first-launch Camoufox (Python + Firefox).
4. Device pairing tokens for Watch.
5. Shared `visibility_captures` store in Oppvera.
6. Persist Probe passes into that store.
7. One scorer (`BrandAnalysisResult`) on every row.
8. One dashboard with source and provider filters, plus UI-vs-API compare.
9. Studio lab diagnosis shown beside a dated Watch or Probe capture.
10. Offline queue on the Mac until Oppvera is reachable.
11. Strip Docker and analysis-key setup from the Watch README once the desktop path exists.
12. **Desktop v1:** macOS only. **Desktop v2 (planned):** Windows, same Electron stack after macOS capture and sync are proven. Linux desktop is not on the roadmap unless product asks.
13. No routine merges from OneGlanse. The `oneglanse` git remote is fetch-only for optional capture-engine patches.
14. Hosted email reports summarize Probe state and nudge stale Oppvera Watch runs when enabled ([08](08-email-reports-and-nudges.md)).

## Constraints that apply to every doc

- Never upload browser cookies or Playwright `storageState`.
- Never label an API result as ChatGPT.com, Claude.ai, Gemini, or Perplexity.
- **Capture cost:** Watch = user's consumer subscriptions; Probe = Oppvera API keys with planned quotas and model caps.
- **Analysis cost:** Oppvera's keys only, on hosted Oppvera; prefer a cost-efficient analysis model (e.g. Gemini Flash Lite class), not frontier capture models.
- Early rollout: visibility features may be **free to users** while Oppkey controls hosted LLM spend.
- Do not reuse `POST /api/uploads` (that path ingests campaign content files).
- Keep the MIT copyright notice for Craig Oda and Aryaman Todkar / OneGlanse.
- Push this repo to `oppvera` only. Do not push to the `oneglanse` remote.
- Oppvera already uses PostHog on the hosted app. Do not add a Watch README section that claims this fork deleted PostHog once the desktop product is the install path. Do not add PostHog to the desktop capture client.
