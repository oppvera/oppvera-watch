# Oppvera Watch + Probe analytics specs

These documents are the build brief for splitting **Oppvera Watch** into a desktop capture client (**macOS first**, **Windows planned**) and putting **GEO analytics** in the hosted Oppvera app. Watch and **Oppvera Probe** share one capture store and one scoring pipeline.

They live in this Watch repo so a Cursor session can implement either side:

- Watch desktop: this repository (`oppvera/oppvera-watch`)
- Probe ingest, persistence, and analytics: [codetricity/oppvera](https://github.com/codetricity/oppvera) → `app/lab/demo/`

Do not treat these files as shipped product docs for marketers. The public install guide is the root [README](../../README.md) (macOS desktop client; no Docker in this repo).

## Validate on Oppvera before Oppvera Watch

You can ship and test the **hosted loop first** without changing this Watch repo or building Electron.

**Phase A — Oppvera only (Probe + analytics + UI):**

1. **Done** — Persist Probe into `visibility_captures` ([04](04-oppvera-probe-persistence.md), Oppvera v0.89.0, [PR #268](https://github.com/codetricity/oppvera/pull/268)).
2. **Done** — Shared scorer and campaign visibility UI ([05](05-unified-analytics.md), v0.90.0, [PR #269](https://github.com/codetricity/oppvera/pull/269)).
3. **Done** — Campaign query-bank Probe runs ([06](06-query-bank-and-runs.md), v0.91.0, [PR #270](https://github.com/codetricity/oppvera/pull/270)).
4. **Done** — Email reports ([08](08-email-reports-and-nudges.md), v0.94.3, [PR #276](https://github.com/codetricity/oppvera/pull/276)).

At the end of Phase A you have a working product surface: **API-labeled captures, GEO metrics, and HTMX dashboards** on real campaign data. That is the milestone to demo and iterate on before desktop work.

**Phase B — Oppvera Watch (this repo + Oppvera UI):**

5. ~~Watch ingest API and device pairing~~ **Done** on Oppvera ([03](03-oppvera-probe-ingest-api.md), v0.95.0, [PR #277](https://github.com/codetricity/oppvera/pull/277)).
6. ~~**macOS** Electron capture client~~ **Shipped** in this repo ([02](02-watch-desktop-electron.md)) — `apps/desktop` **0.5.1-alpha**, arm64 `.dmg`, pairing, query-bank runs, offline pending queue, sync to `POST /api/probe/captures`.
7. ~~UI-vs-API compare and mixed-source filters~~ **Implemented** on Oppvera when both sources exist ([05](05-unified-analytics.md)) — `?source=watch|probe|all` on the visibility board; `compare_pair()` and lab link on capture detail (`oppvera/routers/visibility.py`, `visibility/queries.py`). **Still to validate in production:** end-to-end compare with real Watch + Probe rows on one campaign (tests cover Probe-only empty compare today).
8. **Windows** Electron build (planned desktop v2, after macOS v1) — same stack; see [02](02-watch-desktop-electron.md).

Phase A and the core Phase B loop are merged on Oppvera `main` and in this repo. Remaining product work is mostly polish, Windows, and optional automation (see [What's next](#whats-next)).

## Implementation status

| Doc | Oppvera (`app/lab/demo`) | Notes |
| --- | --- | --- |
| [04](04-oppvera-probe-persistence.md) | **Done** — v0.89.0 | [PR #268](https://github.com/codetricity/oppvera/pull/268) |
| [05](05-unified-analytics.md) | **Done** — v0.90.0 | [PR #269](https://github.com/codetricity/oppvera/pull/269) |
| [06](06-query-bank-and-runs.md) | **Done** — v0.91.0 | [PR #270](https://github.com/codetricity/oppvera/pull/270) |
| [08](08-email-reports-and-nudges.md) | **Done** — v0.94.3 | [PR #276](https://github.com/codetricity/oppvera/pull/276) (PRs #273–#276) |
| [03](03-oppvera-probe-ingest-api.md) | **Done** — v0.95.0 | [PR #277](https://github.com/codetricity/oppvera/pull/277) |
| [02](02-watch-desktop-electron.md) | Watch repo | **Shipped** — `apps/desktop` **0.5.1-alpha** (arm64 `.dmg`). See [releasing-macos.md](../releasing-macos.md) |
| [05](05-unified-analytics.md) compare + filters | Oppvera | **Done in code** — board filters; detail compare when Watch + Probe share a `query_item_id`; tests for hidden compare when Probe-only |
| [05](05-unified-analytics.md) + [01](01-product-split.md) lab beside capture (objective 9) | Oppvera | **Done** — v0.110.0 inline panel on capture detail + eval row anchors |

Update this table when each spec lands on [codetricity/oppvera](https://github.com/codetricity/oppvera) `main`.

## What's next

Core split is implemented. Follow-ups:

1. **Production validation** — Pair Watch, run a query-bank capture, confirm visibility board filters and the UI-vs-API compare panel on `/workspace/campaigns/{id}/visibility/{capture_id}` for shared bank ids.
2. **macOS distribution** — Ad-hoc signed `.dmg` today; optional Apple Developer ID notarization ([releasing-macos.md](../releasing-macos.md)).
3. **Windows desktop v2** — [02](02-watch-desktop-electron.md); not started.
4. **Optional hosted** — Scheduled Probe runs on the frozen query bank (plan “optional later”; not in Oppvera code yet).
5. **Objective 9 polish** — Optional: lab highlights in monthly email ([08](08-email-reports-and-nudges.md)); richer Contrast/Showdown widgets on visibility detail.

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
2. ~~Shared scorer and campaign analytics UI on Probe-only data~~ **Done** ([05](05-unified-analytics.md), [PR #269](https://github.com/codetricity/oppvera/pull/269)).
3. ~~Campaign query-bank Probe runs~~ **Done** ([06](06-query-bank-and-runs.md), [PR #270](https://github.com/codetricity/oppvera/pull/270)).
4. ~~Campaign email reports~~ **Done** ([08](08-email-reports-and-nudges.md), [PR #276](https://github.com/codetricity/oppvera/pull/276)).

**Phase B (Watch repo + Oppvera ingest):**

5. ~~Watch ingest API and device pairing~~ **Done** ([03](03-oppvera-probe-ingest-api.md), [PR #277](https://github.com/codetricity/oppvera/pull/277)).
6. ~~**macOS** Electron client~~ **Done** ([02](02-watch-desktop-electron.md)) — `apps/desktop`.
7. ~~UI-vs-API compare and mixed-source filters~~ **Done in Oppvera** ([05](05-unified-analytics.md)); validate with live Watch data.
8. **Windows** Electron client (desktop v2, after macOS v1) — [02](02-watch-desktop-electron.md).

## Objectives

Status reviewed against `oppvera-watch` and Oppvera `app/lab/demo` (October 2026).

| # | Objective | Status |
| --- | --- | --- |
| 1 | Isolate Watch capture (no Redis/Postgres) | **Done** — agent + desktop only; no Docker stack in repo |
| 2 | macOS Electron shell (v1) | **Done** — `apps/desktop` 0.5.1-alpha |
| 3 | Camoufox on first launch | **Done** — Python venv + `camoufox fetch` in app (`setupCamoufoxEnv`) |
| 4 | Device pairing tokens | **Done** — Oppvera `POST /api/probe/devices/pair`; Watch `devices.json` |
| 5 | Shared `visibility_captures` in Oppvera | **Done** |
| 6 | Persist Probe passes | **Done** — v0.89.0 |
| 7 | One scorer per row | **Done** — `visibility/scorer.py`, `analysis_prompt.py` |
| 8 | Dashboard filters + UI-vs-API compare | **Done in code** — visibility board + `compare_pair` on detail; production smoke test recommended |
| 9 | Lab beside a dated capture | **Done** (Oppvera v0.110.0) — capture detail shows capture summary beside inline Studio Diagnosis (bucket, rationale, fix, lab answer preview); link to `#eval-query-…` on full report |
| 10 | Watch offline queue | **Done** — pending captures on disk; `syncNow` / post-run sync |
| 11 | Strip Docker from Watch README | **Done** — root README is desktop install path |
| 12 | Windows desktop v2 | **Not started** |
| 13 | No routine OneGlanse merges | **Done** — `.cursor/rules/upstream-merge.mdc`, `oneglanse` remote |
| 14 | Email reports + Watch stale nudge | **Done** — v0.94.3 |

### Objective 9: Lab beside capture

**Intent:** On a visibility capture detail page, show **Studio Simulation Lab diagnosis** for the same buyer question (`query_item_id` or question text) **next to** the dated Watch or Probe capture—without claiming the lab predicted ChatGPT or an API answer.

**Shipped (Oppvera v0.110.0, [PR #334](https://github.com/codetricity/oppvera/pull/334)):** capture detail shows a two-column **This capture** / **Studio lab reading** panel (bucket, rationale, fix, lab answer preview) plus **Full Diagnosis report** linking to `#eval-query-{id}` on Inspect → Diagnosis.

**Optional later:** lab highlights in monthly email ([08](08-email-reports-and-nudges.md)); Contrast/Showdown widgets on the same page.

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
