# OneGlanse Lab — Learn GEO & AI Visibility

**OneGlanse Lab** is an open-source educational fork of [OneGlanse](https://github.com/aryamantodkar/oneglanse). Run it locally to learn **GEO (Generative Engine Optimization)** and **AI visibility**: how brands show up inside ChatGPT, Gemini, Perplexity, Claude, and Google AI Overview.

This repo is meant for learners, instructors, and anyone experimenting with real AI product surfaces—not as a hosted product or Oppkey internal trial.

<p align="center">
  <img src="docs/images/hero-icon.png" alt="OneGlanse dashboard showing AI visibility, rank, sources, and prompt analytics" width="100%" />
</p>

## What you'll learn

- **GEO measurement on real UIs.** The app opens provider chat interfaces in a browser (like a signed-in user), not model APIs. You see citations, source cards, and ranking the way users do.
- **How visibility scores are built.** Captured answers are analyzed with your own OpenAI or Anthropic key. Scores combine visibility, rank, sentiment, and recommendation for a workspace brand.
- **Self-hosted data flow.** Postgres, ClickHouse, Redis, and a browser worker run on your machine via Docker. Responses and analytics stay local.

Upstream [OneGlanse docs](https://docs.oneglanse.com) explain the full product. This fork tracks upstream and adds educational framing, simpler local setup notes, and removes upstream PostHog telemetry.

## Status

- **Synced with upstream:** This branch includes the latest [OneGlanse](https://github.com/aryamantodkar/oneglanse) changes through the current merge base, plus Lab-specific tweaks (branding, telemetry removal, install notes).
- **Work in progress:** Install and onboarding are still being simplified. Expect rough edges—issues and PRs welcome.

## Quick start

**Requirements:** Node.js 20+, pnpm 10+, Docker Desktop running.

**WSL is not supported** for Camoufox browser automation. Use native macOS, Linux, or Windows.

```bash
git clone https://github.com/codetricity/oppvera-watch.git
cd oppvera-watch
cp .env.example .env
```

Add one analysis LLM key to `.env`:

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

Open [http://localhost:3000](http://localhost:3000). First run generates auth secrets, starts Postgres / ClickHouse / Redis, runs migrations, and bootstraps the browser runtime.

1. Sign up with email (local to your machine).
2. Connect providers at `/providers`. Finish sign-in, then close the provider browser window.
3. Create a workspace with the brand you want to score.
4. Add prompts and start a run from Workspace Runs.

Do not commit `.env`; it contains API keys.

## How it works

It does **not** call ChatGPT / Gemini / Claude / Perplexity model APIs to collect answers.

It opens the real product UIs in a browser and captures what renders: the answer, citations, source cards, and brand order. After capture, it uses **your** OpenAI or Anthropic key to score those answers for GEO visibility, sentiment, rank, and recommendation.

GEO scores are about the **workspace brand** (name + domain), not whether the model answered the prompt. If the brand is absent, scores stay empty even when ChatGPT returned a full response.

Scoring uses the prompt in [`packages/services/src/analysis/analysisPrompt.ts`](packages/services/src/analysis/analysisPrompt.ts). Upstream details: [OneGlanse README](https://github.com/aryamantodkar/oneglanse).

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

## Telemetry

Upstream OneGlanse sends anonymous hashed user-activity events to PostHog on signup and each authenticated page load. **This fork removes that.** OneGlanse Lab does not phone home to OneGlanse or PostHog.

Better Auth (the auth library) may still perform its own internal telemetry as part of the dependency. That is separate from the OneGlanse PostHog integration removed here.

## Origin and attribution

OneGlanse Lab is a modification of **[OneGlanse](https://github.com/aryamantodkar/oneglanse)** by [Aryaman Todkar](https://github.com/aryamantodkar).

- Original project: [github.com/aryamantodkar/oneglanse](https://github.com/aryamantodkar/oneglanse)
- Original site: [oneglanse.com](https://oneglanse.com)
- Original docs: [docs.oneglanse.com](https://docs.oneglanse.com)

Most architecture, capture logic, and scoring design come from OneGlanse. Lab changes focus on educational use, local install, and privacy (no PostHog).

**Trademark note:** "OneGlanse" is the upstream project name. This repo is an independent educational fork—not an official OneGlanse release. Please say so in courses and videos.

## License

This project is **MIT licensed**. See [LICENSE](LICENSE).

### Using this in educational videos

The MIT license allows you to:

- Run, screen-record, and demonstrate the software
- Fork, modify, and share copies
- Use it in free or paid courses

You must:

- Keep the MIT copyright and permission notice (in `LICENSE` and substantial copies)
- Credit the original author: **Aryaman Todkar / OneGlanse**
- Credit this fork's modifications: **Craig Oda / OneGlanse Lab**

Suggested on-screen or description credit:

> Based on [OneGlanse](https://github.com/aryamantodkar/oneglanse) (MIT) and [OneGlanse Lab](https://github.com/codetricity/oppvera-watch) (MIT).

### Dependencies

Application code is MIT. Third-party packages (Camoufox, Playwright, Next.js, ClickHouse client, etc.) ship under their own licenses in `node_modules` and upstream notices. OneGlanse's README lists major dependency acknowledgements.

## Acknowledgements

OneGlanse builds on Camoufox, Playwright, BullMQ, ClickHouse, Drizzle, Better Auth, and Turndown. See the [original project README](https://github.com/aryamantodkar/oneglanse) for those licenses.
