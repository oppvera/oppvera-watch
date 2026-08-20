# Oppvera Watch

**Oppvera Watch** is Oppkey's evaluation fork of an AI visibility tracker. It measures how a brand appears inside real AI products: ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview.

This repository is for **Oppkey staff only**. It is not a public product launch.

## Status

This is a trial so we can see whether the approach is useful.

If we decide to go forward, Oppvera Watch becomes **our project to maintain**. We would keep modifying this codebase under the Oppvera Watch name. That means Oppkey owns ongoing work: provider UI breakage, browser automation, scoring, local/self-host operations, and product changes. Upstream OneGlanse will not do that work for us.

At this stage, do not treat this as a shared customer-facing service. Run it locally, use your own accounts, and keep findings inside Oppkey.

## Origin and attribution

Oppvera Watch is a modification of **[OneGlanse](https://github.com/aryamantodkar/oneglanse)** by [Aryaman Todkar](https://github.com/aryamantodkar).

OneGlanse is open source under the MIT License. The original copyright and license terms still apply. See [LICENSE](LICENSE).

- Original project: [github.com/aryamantodkar/oneglanse](https://github.com/aryamantodkar/oneglanse)
- Original site: [oneglanse.com](https://oneglanse.com)
- Original docs: [docs.oneglanse.com](https://docs.oneglanse.com)

This repo changes branding and a small amount of UI for the Oppkey trial. Most of the product, architecture, and scoring design comes from OneGlanse.

## What it does

It does **not** call ChatGPT / Gemini / Claude / Perplexity model APIs to collect answers.

It opens the real product UIs in a browser, the same way a signed-in user would, and captures what actually renders: the answer, citations, source cards, and how brands are ordered. After capture, it uses **your** OpenAI or Anthropic key to score those answers for GEO visibility, sentiment, rank, and recommendation.

GEO scores are about the **workspace brand** (name + domain), not "did the model answer the prompt." If the brand is absent, scores will look empty even when ChatGPT returned a full response.

## Local setup

**Requirements:** Node.js 20+, pnpm 10+, Docker Desktop running.

WSL is not supported for the Camoufox browser used to log into providers. Use native macOS, Linux, or Windows.

```bash
git clone git@github.com:codetricity/oppvera-watch.git
cd oppvera-watch
cp .env.example .env
```

Put one analysis LLM key in `.env`:

```bash
OPENAI_API_KEY=sk-...
```

or:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANALYSIS_LLM_PROVIDER=claude
```

Then:

```bash
pnpm local
```

The app is at [http://localhost:3000](http://localhost:3000).

On first run it generates auth secrets, starts Postgres / ClickHouse / Redis, runs migrations, and bootstraps the browser runtime.

1. Sign up with email. That account is local to your machine.
2. Connect providers at `/providers`. Finish sign-in, then close the provider browser window.
3. Create a workspace with the brand you want scored.
4. Add prompts and start a run from Workspace Runs. Adding a prompt does not capture answers by itself.

Do not commit `.env`. It contains API keys.

## If we go forward

Choosing this path means Oppkey maintains Oppvera Watch as our own line of development:

- Provider sites change. Capture selectors and login flows will break and we will have to fix them.
- Camoufox, Docker, and the worker stack are part of the product, not optional extras.
- Recurring schedules and VPS deploys need a residential proxy. Local runs usually do not.
- Scoring quality depends on the analysis prompt and on whether the workspace brand name matches how models write the brand.

OneGlanse remains the upstream origin. We should keep attribution in this repo. We should not assume we can drop maintenance back onto that project.

## Stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js 15, React 19, tRPC, Drizzle ORM |
| Browser worker | Camoufox, Playwright, BullMQ |
| Analytics DB | ClickHouse |
| Relational DB | PostgreSQL 16 |
| Queue | Redis |
| Auth | Better Auth |
| Response analysis | OpenAI or Anthropic (your key) |

## Scoring

Captured text is analyzed with the prompt in [`packages/services/src/analysis/analysisPrompt.ts`](packages/services/src/analysis/analysisPrompt.ts).

GEO score is an equal mix of visibility, rank, sentiment, and recommendation. A brand that is not mentioned should be treated as absent, not as a failed run. Click a prompt row to read the captured model answer.

Upstream scoring details are documented in the original [OneGlanse README](https://github.com/aryamantodkar/oneglanse).

## Telemetry

Upstream OneGlanse sends anonymous hashed user-activity events to PostHog on signup and each authenticated page load. **This fork removes that.** Oppvera Watch does not phone home to OneGlanse or PostHog.

Better Auth (the auth library) may still perform its own internal telemetry as part of the dependency. That is separate from the OneGlanse PostHog integration we removed.

## Acknowledgements

OneGlanse also builds on Camoufox, Playwright, BullMQ, ClickHouse, Drizzle, Better Auth, and Turndown. See the original project README for those licenses.

## License

MIT. Original copyright [Aryaman Todkar](https://github.com/aryamantodkar), 2025. Modifications for this Oppkey evaluation, 2026.

The MIT license requires that the original copyright and permission notice remain in all copies. That notice is in [LICENSE](LICENSE).
