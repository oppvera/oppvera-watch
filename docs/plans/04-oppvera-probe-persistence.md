# Persist Oppvera Probe into the shared capture store

## Status

**Implemented** in the Oppvera demo **v0.89.0**, merged to [`main`](https://github.com/codetricity/oppvera) on 2026-09-22 via [PR #268](https://github.com/codetricity/oppvera/pull/268).

Code lives under [`app/lab/demo/`](https://github.com/codetricity/oppvera/tree/main/app/lab/demo):

- `oppvera/visibility/models.py` — `visibility_runs`, `visibility_captures`, `visibility_analyses`
- `oppvera/visibility/persistence.py` — Probe write path, SQL read after restart
- `oppvera/probe.py` — persist each `ProbePass`
- `oppvera/routers/probe_ui.py` — Studio campaign Probe loads history from SQL (`/workspace/campaigns/{id}/probe`; legacy `/admin/dev/probe` redirects)
- `tests/test_visibility_probe_persistence.py`

At merge, `schedule_visibility_analysis` was a no-op hook. Scoring and the campaign visibility UI are [05-unified-analytics.md](05-unified-analytics.md).

Implement in:

[`https://github.com/codetricity/oppvera`](https://github.com/codetricity/oppvera) → `app/lab/demo/` (local clone path may differ)

Probe today (`oppvera/probe.py`) runs up to three questions through OpenRouter, Anthropic web search, and OpenAI web search. Results sit in memory (`store.probe_payloads`, keyed by `report_scope_key()`). Restarting the process drops them. Watch cannot share that store.

This spec adds SQL tables and writes every `ProbePass` into them. Watch uploads (doc [03](03-oppvera-probe-ingest-api.md)) use the same tables later.

**Probe-only validation:** After this spec and doc [05](05-unified-analytics.md), you can run Probe in local or hosted Oppvera, score captures, and exercise the campaign visibility UI **without** building Oppvera Watch or changing the oppvera-watch repo. Treat that as the first integration test of the shared store.

## Tables

SQLite locally, Postgres when hosted. Follow existing SQLModel style in `oppvera/auth/models.py` (string uuids, ISO timestamp strings).

### `visibility_runs`

| Column | Notes |
| --- | --- |
| `id` | uuid, this is `run_id` |
| `workspace_id` | |
| `company_id` | nullable only if the campaign has no company; prefer always set |
| `campaign_id` | |
| `source` | `watch` or `probe` |
| `label` | optional human label |
| `created_by_user_id` | Probe: the logged-in user. Watch: the user who paired the device |
| `device_id` | null for Probe |
| `started_at` | |
| `finished_at` | null while running |

### `visibility_captures`

| Column | Notes |
| --- | --- |
| `id` | uuid, server id |
| `client_capture_id` | uuid from Watch, or a uuid minted per Probe pass |
| `device_id` | null for Probe; set for Watch. Unique with `client_capture_id` when `device_id` is not null |
| `run_id` | FK |
| `workspace_id`, `company_id`, `campaign_id` | denormalized for queries |
| `source` | `watch` or `probe` |
| `provider_id` | see doc 01 |
| `provider_label` | honest string |
| `attribution` | Probe's `PROVIDER_ATTRIBUTION`; Watch may repeat `provider_label` |
| `model` | Probe model slug; Watch null |
| `grounded` | Probe bool; Watch null |
| `query_item_id` | nullable for legacy Probe questions that were not in the bank |
| `question` | text actually asked |
| `raw_answer` | markdown or plain text |
| `citations_json` | JSON list of `{title, cited_text, url, domain}` |
| `source_urls_json` | Probe `source_urls` if you want them separate from citations |
| `brand_named` | Probe's current boolean; Watch null until analysis |
| `other_products_json` | Probe `other_products`; optional |
| `account_hint` | Watch only, short, non-secret |
| `captured_at` | |
| `error` | non-empty if the pass failed; still store the row |
| `created_at` | server insert time |

Index: `(campaign_id, captured_at)`, `(campaign_id, query_item_id, source, provider_id)`, unique `(device_id, client_capture_id)`.

### `visibility_analyses`

Defined in doc [05](05-unified-analytics.md). Create the table in the same migration so captures are not stranded without a place to put scores. The scorer can land in a follow-up PR.

## Write path for Probe

In `run_probe` and `run_probe_panel` (`oppvera/probe.py`):

1. At start, insert `visibility_runs` with `source=probe`.
2. Each finished `ProbePass` (including timeout/error passes) inserts one `visibility_captures` row.
3. Map fields:

| `ProbePass` | Column |
| --- | --- |
| new uuid | `id` and `client_capture_id` |
| `provider_id` | `provider_id` |
| `provider_label` | `provider_label` |
| `attribution` | `attribution` |
| `model` | `model` |
| `grounded` | `grounded` |
| `question` | `question` |
| `kind` | do not overload `provider_id`. Store on the row only if you add `question_kind`; otherwise keep it inside a small `meta_json` |
| `raw_answer` | `raw_answer` |
| `citations` | `citations_json` (normalize keys to title, cited_text, url, domain when present) |
| `source_urls` | `source_urls_json` |
| `brand_named` | `brand_named` |
| `other_products` | `other_products_json` |
| `timestamp` | `captured_at` |
| `error` | `error` |

4. Set `query_item_id` when the question text was loaded from the campaign bank. Ad-hoc questions on campaign Probe (e.g. `default_questions`) may have a null id; analytics still stores them but partner charts key off ids (doc [06](06-query-bank-and-runs.md)).
5. After insert, schedule analysis the same way Watch ingest does.

Do not delete `ProbePass`. It can remain the in-memory dataclass. Persistence is a side effect of a completed pass.

## Read path

- `save_probe_payload` / `latest_probe_payload` may stay for one release as a cache, but the Probe HTML page must render from SQL when rows exist so a restart does not blank history.
- `GET /workspace/campaigns/{id}/probe` shows the latest run for that campaign from `visibility_runs`, not only the process-local dict.
- Campaign analytics (doc 05) queries the same tables. Do not fork a second "probe_results" table.

## Mentioned-in-N-of-M

Keep the sentence on the Probe page as a **count of rows** in that run:

```text
mentioned = number of passes in the run where analysis says presence.mentioned
```

Until analysis has run, fall back to the existing `brand_named` flag and label the line "name match (not the GEO score)". When `visibility_analyses` exists for every pass, use `presence.mentioned` only, so the page and the dashboard cannot disagree.

Do not invent a second score in `probe.py`.

## Tenancy

Resolve workspace, company, and campaign the same way other campaign-scoped writes do (`report_scope_key()` and the active campaign in the session). A Probe run always stores those ids. Do not key history only by the in-memory scope string.

## What not to do

- Do not write captures into `documents` / `chunks` or call `ingest_corpus`.
- Do not put Probe rows into Trace Evidence. The existing probe plan says Probe stays out of Trace; this store is separate.
- Do not require the desktop app for Probe to persist.
- **Starting** an API run requires **`probe.run`** and campaign access (Studio Probe). Storing rows is what changed persistence; Watch ingest (doc 03) is a separate Bearer-token path.

## Tests

- A fake `ProbePass` inserted via the mapper survives a new process (SQLite file), with `source=probe` and attribution text intact.
- Watch idempotency unique key does not collide with Probe rows (`device_id` null).
- Failed pass (`error` set, empty `raw_answer`) still inserts and does not call the scorer.

## Acceptance

Run Probe once from **campaign Probe** in Studio, restart `uvicorn`, and the same answers are still listed for that campaign with provider labels that say API, not ChatGPT.com.
