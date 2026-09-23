# Product split: Watch, Probe, and the Studio lab

## Purpose

Oppvera measures two different things today, and this split keeps them separate while sharing analytics.

| Product | What it observes | Where it runs |
| --- | --- | --- |
| Studio / Brand Security (Simulation Lab) | Whether **owned content** is findable in a controlled retrieval lab | Hosted Oppvera (FastAPI) |
| Oppvera Probe | What **LLM and web-search APIs** answer for a buyer question | Hosted Oppvera |
| Oppvera Watch | What **consumer product UIs** render for a signed-in user | Desktop: **macOS first**, **Windows planned** |

Watch and Probe both produce answer text and citations. Those rows go into one store and one scoring pipeline. The lab stays a diagnosis of the client's content. A campaign page may show a dated capture **beside** a lab diagnosis. The lab does not predict ChatGPT.

## Why Watch is a desktop app

Browser automation in the cloud is fragile, operationally heavy, and can conflict with consumer product terms. Oppvera Watch runs on the user's Mac. The user signs into ChatGPT, Claude, Gemini, Perplexity, and Google AI Overview with **their own accounts**. Compliance with those products' terms is the user's responsibility. See [07-legal-tos-and-attribution.md](07-legal-tos-and-attribution.md).

Probe stays hosted because it calls provider APIs (OpenRouter, Anthropic web search, OpenAI web search) with **Oppvera's server keys**. That path does not drive consumer chat UIs and does not need the user's ChatGPT password.

## Cost control and early pricing

During initial rollout, **Oppvera is not charging users** for this visibility loop. Cost still matters for Oppkey (hosted API spend) and for agencies (how they run captures).

| Layer | Who pays | Model / tier choice |
| --- | --- | --- |
| **Watch capture** (desktop) | The user, via **their own consumer subscriptions** (ChatGPT Plus/Pro, Claude Pro, etc.) | Whatever models and tiers those **product UIs** expose to their signed-in account—including frontier options Oppvera does not fund. Watch does not call OpenAI/Anthropic **API keys** for capture. |
| **Probe capture** (hosted) | Oppkey on **Oppvera server keys** | Subject to **quotas, rate limits, and model allowlists** on Oppvera (e.g. development defaults, not unlimited frontier API). Expensive models may be disabled or capped before general partner use. |
| **GEO analysis** (hosted) | Oppkey on **Oppvera server keys** | Runs on **captured text only**, not on re-asking ChatGPT. Use a **cost-efficient** analysis model by default (e.g. OpenRouter `google/gemini-3.1-flash-lite` under consideration)—not the same model used for capture and not required to match the user's ChatGPT tier. |

**Why desktop Watch is a cost-control lever:** agencies that want **frontier answers from ChatGPT.com or Claude.ai** can use **their own accounts** on their own machines without Oppvera paying for cloud browser farms or unlimited API capture. Oppvera still scores the synced text with Oppvera's analysis budget.

**Product copy must stay honest:** Watch is not "free ChatGPT API." It is "you log into the consumer app you already pay for; we capture what that UI shows."

See also [05-unified-analytics.md](05-unified-analytics.md) (analysis model) and [02-watch-desktop-electron.md](02-watch-desktop-electron.md) (no analysis keys on desktop).

## What each side owns

### Watch (this repository)

Owns:

- Camoufox / Playwright capture for `chatgpt`, `claude`, `gemini`, `perplexity`, `ai-overview`
- Local Playwright session files (cookies stay on disk)
- A thin Electron UI: pair to Oppvera, pick a campaign, connect providers, run the frozen query bank, show progress, retry, sync

Does not own:

- GEO scores, dashboards, or sentiment charts
- OpenAI or Anthropic **analysis** API keys (Oppvera scores after sync)
- Oppvera-funded **API capture** quotas (that is Probe on the server)
- Docker, Postgres, Redis, ClickHouse, BullMQ, or a local Next.js app
- Marketing claims that an answer is "what every user sees"

**Cost:** capture spend is the user's **consumer product subscriptions**, not Oppvera's API bill. They choose tier and model availability by which account they sign into (e.g. ChatGPT Plus vs free).

### Probe (Oppvera `app/lab/demo`)

Owns:

- API / web-search collection (`openrouter_serper`, `anthropic_web_search`, `openai_web_search`)
- Device pairing and the ingest API that Watch calls
- Persistence of every Probe pass and every Watch upload
- The shared scorer and the analytics UI

Probe runs live on the **Studio campaign Probe** page (`/workspace/campaigns/{id}/probe`, `probe.run` permission). Each pass is a `visibility_captures` row with `source=probe`. "Mentioned in N of M" is a rollup of `presence.mentioned` on those rows (or interim `brand_named` until analysis is ready), not a second scoring system. Legacy `/admin/dev/probe` URLs redirect to the campaign Probe path.

**Reading** stored analytics is on `/workspace/campaigns/{id}/visibility` for partners who can read the campaign, with honest labels. **Starting** a run is on campaign Probe, not a hidden Development menu.

**Cost:** Probe runs on **Oppvera's keys**. Plan for **usage limits** (per workspace, campaign, or month) and for **restricting the most expensive API models** in partner-facing flows while early access is free to users. Standard model tiers stay the default; frontier slugs in `probe.py` require org **`probe-frontier`** (and platform roles where applicable), not an implicit unlimited API path.

### Studio lab

Owns the eight retrieval signals, Diagnosis, Contrast, and related campaign tools. It does not ingest chat cookies and it does not become a GEO monitoring product by itself.

The join is presentational: for one `query_item_id`, show the lab diagnosis next to the latest labeled capture (Watch or Probe). Copy should say what was recorded from a product surface or API, and what the lab explains about the site. It must not say the lab predicted ChatGPT.

## Shared analytics

```text
Watch (consumer UI)  --source=watch-->  visibility_captures
Probe (API)          --source=probe-->  visibility_captures
                                              |
                                              v
                                       visibility_analyses
                                       (one BrandAnalysisResult per capture)
                                              |
                                              v
                                       one campaign dashboard
                                       filters: source, provider
                                       compare: UI session vs API pass
```

Rules:

- Default view includes all sources, with a filter for Watch vs Probe.
- Every row shows `provider_label` that names the real protocol.
- Do not run two scoring prompts.
- Do not chart Watch and Probe as if they were the same engine.

## Implementation order

Build **hosted Oppvera first**, then **Oppvera Watch**:

1. **Phase A:** Probe persistence, scoring, campaign visibility UI, and optional email reports — all testable in the Oppvera demo app with no changes to this Watch repo.
2. **Phase B:** Watch ingest API and the Electron client here; then enable compare views and mixed-source filters when `source=watch` rows exist.

See [README.md](README.md) for the full sequence.

## Labeling rules

Use these labels in UI, API responses, exports, and docs.

| `source` | `provider_id` | Required label idea |
| --- | --- | --- |
| `watch` | `chatgpt` | ChatGPT.com (signed-in session) |
| `watch` | `claude` | Claude.ai (signed-in session) |
| `watch` | `gemini` | Gemini (signed-in session) |
| `watch` | `perplexity` | Perplexity (signed-in session) |
| `watch` | `ai-overview` | Google AI Overview (signed-in Google session) |
| `probe` | `openrouter_serper` | OpenRouter API. Web snippets: Serper. |
| `probe` | `anthropic_web_search` | Anthropic API (web search). Not Claude.ai. |
| `probe` | `openai_web_search` | OpenAI API (web search). Not ChatGPT.com. |

Forbidden:

- Calling an OpenRouter, OpenAI API, or Anthropic API answer "ChatGPT", "Claude", or "Gemini" without the API qualifier
- Hiding `source` in a blended "visibility %" that mixes UI sessions and API passes
- Implying one account's capture is the universal answer

Probe's existing strings in `oppvera/probe.py` (`PROVIDER_LABELS`, `PROVIDER_ATTRIBUTION`, and the disclaimer that Probe is not a consumer login) stay. Watch adds the "signed-in session" labels.

## User journey

**After Phase A (Probe + analytics on Oppvera):** the consultant runs Probe (or a campaign bank run), opens the campaign visibility page, and reads GEO scores on API-labeled captures. No Mac app required.

**After Phase B (Watch added):**

1. The person works in hosted Oppvera: organization, company, campaign, frozen query bank.
2. Oppvera shows a pairing code for Oppvera Watch.
3. On the Mac, Watch exchanges the code for a device token, downloads the query bank, and asks the user to sign into the consumer products they care about.
4. Watch runs those prompts in the browser and uploads answer text and citations only.
5. Oppvera scores the rows with its own LLM key and shows history next to the campaign.
6. Optionally, someone on **campaign Probe** runs the same questions through APIs (including "Run the campaign query bank"). Those rows land in the same charts, labeled as API.
7. On a schedule the user chooses, hosted Oppvera emails a **campaign report** with a **Probe summary** (mention rate, scores, last run) so the message is worth opening. If the campaign enables **Oppvera Watch reminders**, the **top** of that email says they have not run Watch recently; manual Watch on the Mac remains their action. See [08-email-reports-and-nudges.md](08-email-reports-and-nudges.md). Later emails may add site-change analysis and lab highlights; v1 starts with Probe plus the Watch banner.

The user does not install Docker, does not paste an OpenAI analysis key into Watch, and does not manage ClickHouse.

## Upstream OneGlanse

This repo is an educational fork. Git remote `oneglanse` points at `aryamantodkar/oneglanse` for fetch only (push URL is disabled). Upstream `main` last moved on 2026-05-10. Do not merge it as part of this split. Cherry-pick a capture-engine fix only when someone asks. MIT credit stays either way. See [07-legal-tos-and-attribution.md](07-legal-tos-and-attribution.md).

## Out of scope for v1

- **Windows desktop** (planned after macOS v1; same Electron architecture)
- **Linux desktop** (no planned date)
- Cloud or VPS browser workers
- Residential proxies
- Scheduled unattended Watch runs that the user does not start
- Replacing Studio retrieval scores with GEO scores
- A public GEO monitoring SaaS that drives consumer UIs from Oppvera's servers

## Files this spec points at

Watch capture types:

- `packages/types/src/types/agent.ts` (`AskPromptResult`, provider ids)
- `apps/agent/` (Camoufox, providers, prompt runner)

Oppvera Probe:

- `app/lab/demo/oppvera/probe.py` (`ProbePass`, `ProbeRun`)
- `app/lab/demo/oppvera/store.py` (in-memory payload to replace for history)
- `app/lab/demo/oppvera/auth/models.py` (`Workspace`, `Company`, `Campaign`)
