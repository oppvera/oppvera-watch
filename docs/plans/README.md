# Oppvera Watch + Probe analytics specs

These documents are the build brief for splitting **Oppvera Watch** into a small macOS desktop capture client and putting **GEO analytics** in the hosted Oppvera app. Watch and **Oppvera Probe** share one capture store and one scoring pipeline.

They live in this Watch repo so a Cursor session can implement either side:

- Watch desktop: this repository (`oppvera/oppvera-watch`)
- Probe ingest, persistence, and analytics: `/Users/craig/Documents/Oppkey/geo/generative-engine-optimization` (`app/lab/demo/`)

Do not treat these files as shipped product docs for marketers. The public install guide stays in the root [README](../../README.md) until the desktop app replaces Docker.

## Reading order

1. [01-product-split.md](01-product-split.md) — what Watch, Probe, and the Studio lab each own, and the labeling rules.
2. [02-watch-desktop-electron.md](02-watch-desktop-electron.md) — macOS Electron shell, Camoufox, no Docker.
3. [03-oppvera-probe-ingest-api.md](03-oppvera-probe-ingest-api.md) — device pairing and `POST /api/probe/captures`.
4. [04-oppvera-probe-persistence.md](04-oppvera-probe-persistence.md) — save Probe API passes into the same tables.
5. [05-unified-analytics.md](05-unified-analytics.md) — OneGlanse-style scores on both sources.
6. [06-query-bank-and-runs.md](06-query-bank-and-runs.md) — one frozen buyer-question list for both collectors.
7. [07-legal-tos-and-attribution.md](07-legal-tos-and-attribution.md) — provider ToS, cookies, MIT credit.
8. [08-email-reports-and-nudges.md](08-email-reports-and-nudges.md) — monthly email with Probe summary and Oppvera Watch stale banner.

## Implementation sequence

Build in this order. Specs can be written together; code should not skip ahead.

1. Oppvera schema and Probe persistence ([04](04-oppvera-probe-persistence.md)) so analytics has a writer before Watch exists.
2. Shared scorer and campaign analytics on Probe-only data ([05](05-unified-analytics.md)).
3. Watch ingest API ([03](03-oppvera-probe-ingest-api.md)) and the Electron client ([02](02-watch-desktop-electron.md)).
4. Source filters and the UI-vs-API compare view once both sources exist ([05](05-unified-analytics.md), [06](06-query-bank-and-runs.md)).
5. Campaign email reports with Probe teaser and optional Watch nudge ([08](08-email-reports-and-nudges.md)) after visibility data exists.

## Objectives

1. Isolate Watch capture so it runs without Redis or Postgres.
2. Ship a macOS Electron shell.
3. Bundle or first-launch Camoufox (Python + Firefox).
4. Device pairing tokens for Watch.
5. Shared `visibility_captures` store in Oppvera.
6. Persist Probe passes into that store.
7. One scorer (`BrandAnalysisResult`) on every row.
8. One dashboard with source and provider filters, plus UI-vs-API compare.
9. Studio lab diagnosis shown beside a dated Watch or Probe capture.
10. Offline queue on the Mac until Oppvera is reachable.
11. Strip Docker and analysis-key setup from the Watch README once the desktop path exists.
12. Windows is a non-goal for v1.
13. No routine merges from OneGlanse. The `oneglanse` git remote is fetch-only for optional capture-engine patches.
14. Hosted email reports summarize Probe state and nudge stale Oppvera Watch runs when enabled ([08](08-email-reports-and-nudges.md)).

## Constraints that apply to every doc

- Never upload browser cookies or Playwright `storageState`.
- Never label an API result as ChatGPT.com, Claude.ai, Gemini, or Perplexity.
- Scoring LLM keys live only on Oppvera, never in the desktop app.
- Do not reuse `POST /api/uploads` (that path ingests campaign content files).
- Keep the MIT copyright notice for Craig Oda and Aryaman Todkar / OneGlanse.
- Push this repo to `oppvera` only. Do not push to the `oneglanse` remote.
- Oppvera already uses PostHog on the hosted app. Do not add a Watch README section that claims this fork deleted PostHog once the desktop product is the install path. Do not add PostHog to the desktop capture client.
