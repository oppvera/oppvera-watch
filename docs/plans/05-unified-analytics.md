# Unified analytics (Watch and Probe)

Implement in the Oppvera demo app:

`/Users/craig/Documents/Oppkey/geo/generative-engine-optimization/app/lab/demo/`

UI there is Jinja2, HTMX, Tailwind, and DaisyUI. Do not port the Next.js dashboard from this Watch repo. Port the **scoring semantics**.

Watch does not score. Oppvera scores every `visibility_captures` row with one prompt and one result shape, whether `source` is `watch` or `probe`.

## Probe-first rollout

Implement and test this doc immediately after doc [04](04-oppvera-probe-persistence.md). With only `source=probe` rows:

- The campaign visibility page should list captures, show scores, and use Probe-only empty states where Watch is mentioned.
- The UI-vs-API compare panel stays hidden or shows "needs Oppvera Watch capture" until Phase B.
- Acceptance in this doc (two sources) is the **full** milestone; **partial** acceptance is: one Probe run, analyses `ready`, dashboard usable in the browser without the desktop app.

## Source of truth to port

Copy the analyzer prompt from this repo:

`packages/services/src/analysis/analysisPrompt.ts`

Function `analysisPrompt({ brandName, brandDomain, prompt, response })` returns the full instruction string. Port that string to Python (`oppvera/visibility/analysis_prompt.py`). Keep the rules, caps, and JSON schema. Do not summarize them into a shorter prompt. The model must return **only** JSON.

Inputs:

| Prompt variable | Oppvera source |
| --- | --- |
| `brandName` | `Company.name` for the capture's company |
| `brandDomain` | host of `Company.website_url`, or the campaign's known domain if the company URL is empty |
| `prompt` | `visibility_captures.question` |
| `response` | `visibility_captures.raw_answer` |

If `raw_answer` is empty or `error` is set, do not call the LLM. Store an analysis with `presence.mentioned=false`, `geoScore.overall=0`, `recommendation.type=not_mentioned`, and `sentiment.score=50` (the absent-brand defaults in the prompt's checklist).

## Result shape

Matches `BrandAnalysisResult` in `packages/types/src/types/analysis.ts`.

```json
{
  "geoScore": { "overall": 0 },
  "presence": { "mentioned": false, "visibility": 0 },
  "position": { "rankPosition": null },
  "sentiment": { "score": 50 },
  "recommendation": { "type": "not_mentioned" },
  "competitors": [],
  "perception": {
    "coreClaims": [],
    "differentiators": [],
    "bestKnownFor": null,
    "pricingPerception": "not_mentioned"
  },
  "risks": { "items": [] }
}
```

`recommendation.type` is one of:

`top_pick`, `strong_alternative`, `conditional`, `mentioned_only`, `discouraged`, `not_mentioned`.

`perception.pricingPerception` is one of:

`premium`, `mid_range`, `budget`, `free`, `not_mentioned`.

`risks.items[].severity` is `critical`, `warning`, or `info`.

## Score formula (must match the prompt)

Weights are equal:

| Component | Weight | Mapping |
| --- | --- | --- |
| Visibility | 25% | `presence.visibility` as returned (0–100) |
| Rank | 25% | #1→100, #2→80, #3→65, #4→50, #5→40, #6+→30, mentioned but unranked→15, absent→0 |
| Sentiment | 25% | `sentiment.score` |
| Recommendation | 25% | top_pick→100, strong_alternative→80, conditional→60, mentioned_only→30, discouraged→10, not_mentioned→0 |

```text
overall = round(visibility_value * 0.25 + rank_value * 0.25 + sentiment_value * 0.25 + recommendation_value * 0.25)
```

After the model returns JSON, recompute `geoScore.overall` in Python with that formula and **store the recomputed number**. If it differs from the model by more than 3 points, keep the Python value and record `score_adjusted=true` on the analysis row. Also enforce:

- `mentioned=false` forces overall 0, visibility 0, recommendation `not_mentioned`, sentiment 50, rank null
- sentiment ≤ 20 forces overall ≤ 25
- visibility ≤ 15 forces overall ≤ 45
- visibility < 20 forces overall ≤ 40
- recommendation `discouraged` forces overall ≤ 30
- recommendation `mentioned_only` forces overall ≤ 35

If the model names the target brand inside `competitors`, drop that competitor before save.

## Table `visibility_analyses`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `capture_id` | unique FK to `visibility_captures.id` |
| `brand_analysis_json` | the object above |
| `geo_score` | copy of `geoScore.overall` for sorting without parsing JSON |
| `mentioned` | copy of `presence.mentioned` |
| `model` | scorer model id, not the capture's answer model |
| `score_adjusted` | bool |
| `status` | `ready` or `failed` |
| `error` | scorer error string |
| `created_at` | |

One analysis per capture. Re-analyze replaces the row (or inserts a new row and marks the previous `superseded` — replacing is enough for v1).

## Which LLM key

Use Oppvera's existing server env, not a key from Watch. Prefer the OpenRouter client already used by Probe (`openrouter_api_key` in `oppvera/config.py`) with a small JSON-capable model. If OpenRouter is unset, skip scoring, set `status=failed`, and leave the capture visible as unscored. Do not read `OPENAI_API_KEY` from the Watch desktop.

Record token use with the existing `UsageEvent` pattern if that is a one-line call. Category: `visibility_analysis`. Do not block ingest on this.

## When scoring runs

- After Probe inserts a capture with non-empty `raw_answer` (doc 04)
- After `POST /api/probe/captures` returns `created` (doc 03)
- After `POST /api/probe/captures/{id}/analyze`

Run in a background thread the same way Probe jobs already use threads. Do not add Redis or Celery for v1.

## Dashboard (HTMX, campaign scoped)

Add a campaign page, for example `/workspace/campaigns/{id}/visibility`, linked from the campaign nav. Partner-visible if they can read the campaign. Do not hide **stored** rows behind the Development menu. Starting a new Probe API run can stay on `/admin/dev/probe`.

### Default view

All sources. Chips:

- All
- Watch (consumer UI)
- Probe (API)

Second filter: `provider_id`.

Cards at top, for the active filters and a time window (7d, 30d, all):

- Mention rate: count of analyses with `mentioned` / count of analyses
- Mean `geo_score` among mentioned rows, and mean among all rows (show both; all-rows mean is pulled down by zeros)
- Capture count

Table, one row per capture:

- captured_at
- question (link to detail)
- source chip
- provider_label
- mentioned yes/no
- geo_score
- rank
- sentiment
- recommendation type

Empty states:

- No rows: "No captures yet. Run Probe for an API check, or pair Oppvera Watch to record a signed-in session."
- Probe only: "These rows are API answers, not ChatGPT.com or Claude.ai."
- Watch only: "These rows are from a signed-in browser session on one Mac. They are not an API sample."

### Detail

`/workspace/campaigns/{id}/visibility/{capture_id}`

Show provider_label, attribution, question, raw answer, citations, and the analysis JSON fields in readable sections (presence, rank, sentiment, recommendation, competitors, perception, risks). Link "Lab diagnosis" to the existing Studio diagnosis for the same question text or `query_item_id` when a lab report exists. If none exists, say so. Do not claim the lab predicted the answer.

### UI vs API compare

On the detail page, if the same `query_item_id` has both a Watch row and a Probe row, show a two-column panel:

| | Left | Right |
| --- | --- | --- |
| Default pair | Latest `source=watch` and `provider_id=chatgpt` | Latest `source=probe` and `provider_id=openai_web_search` |
| Fallback | Latest Watch row for that question | Latest Probe row for that question |

Heading text must say the columns are different protocols. Show geo_score, mentioned, and the first 500 characters of each answer. Do not average the two scores into one "true" visibility number.

### Citations

A sources table for the campaign: domain, count, source, provider_label. Default filter is the same chip as the dashboard. Do not mix Claude.ai and Anthropic API domains in one unlabeled total.

### Time series

For each `query_item_id`, plot or table `mentioned` and `geo_score` over `captured_at`, split by `source` and `provider_id`. A simple table grouped by week is enough for v1 if charts are heavy. Do not merge Watch and Probe into one line.

## Probe page rollup

On `/admin/dev/probe`, "mentioned in N of M" counts `visibility_analyses.mentioned` for passes in that run. Until analysis is `ready`, show the interim `brand_named` line from doc 04.

## Tests

- Absent answer (empty text) stores overall 0 without an HTTP call to OpenRouter
- A fixture JSON with `mentioned=false` and overall 80 is corrected to 0
- Formula unit test: visibility 80, rank #1 (100), sentiment 80, recommendation top_pick (100) → overall 90
- List endpoint scoped so campaign B cannot read campaign A's captures
- Compare view does not render when only one source exists

## Acceptance

Insert two captures for one query (one `watch`/`chatgpt`, one `probe`/`openai_web_search`), run analysis, and the campaign page shows both with different labels, separate scores, and a compare panel that does not average them.
