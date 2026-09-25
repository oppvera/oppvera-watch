# Legal, terms of service, and attribution

This is product policy for implementers, not legal advice. If a design partner's counsel disagrees, their written guidance wins for that deployment.

## Who is responsible for consumer UI automation

Oppvera Watch drives ChatGPT, Claude, Gemini, Perplexity, and Google surfaces in a real browser on the user's Mac, with accounts the user connects.

- The user starts the run and can see the browser.
- Oppvera does not operate those sessions in the cloud for v1.
- The app should state, before the first provider connect, that automated access may conflict with the provider's terms and that the user is responsible for compliance.
- Do not ship a residential proxy, a VPS worker, or a "run while I am away on our servers" mode in v1.

Probe is different. It calls APIs with Oppvera server credentials. Label every Probe row as an API result (doc [01](01-product-split.md)). Do not describe Probe as the user being signed into ChatGPT.com.

## Secrets that stay on the Mac

Never upload:

- Playwright `storageState`
- cookies
- `localStorage` dumps
- provider passwords
- the analysis LLM is not configured on the desktop at all

The ingest API rejects JSON keys named `cookies`, `storageState`, `localStorage`, or `origins` (doc [03](03-oppvera-probe-ingest-api.md)).

`account_hint` is optional, short, and must not be a full email address or a session token.

Device tokens are secrets. Store them in the keychain or a `0600` file under Application Support. Oppvera stores only a hash.

## Data Oppvera does store

For each capture: question text, answer text, citations (title, excerpt, url, domain), provider id and label, timestamps, campaign ids, and the derived GEO analysis. That is enough to score and chart. It is still customer content. Scope it with the existing campaign permissions. A device token only writes (and confirms) its own campaign.

## Attribution

Watch is a modification of OneGlanse by Aryaman Todkar, maintained as Oppvera Watch by Craig Oda.

The MIT notice in `LICENSE` must remain on this repo and on any substantial copy of the capture code:

- Copyright (c) 2026 Craig Oda
- Copyright (c) 2025 Aryaman Todkar
- Based on OneGlanse (https://github.com/aryamantodkar/oneglanse)

Electron packaging, ingest docs, and the Oppvera Python scorer are Oppvera work. The scorer prompt ported from `packages/services/src/analysis/analysisPrompt.ts` is part of the MIT-licensed Watch tree. If that prompt is copied into the Oppvera repo, carry the same copyright notice next to the ported file (file header comment is enough).

Oppvera the hosted product is not open source today. Copying the prompt into that private repo is allowed by MIT as long as the notice stays with the copy. Do not publish the Oppvera app as if it were OneGlanse.

Suggested credit when the desktop app is shown:

```text
Based on OneGlanse (MIT) and Oppvera Watch (MIT).
```

## Upstream git

Remote `oneglanse` is fetch-only (push URL disabled). Remote `oppvera` is where this fork pushes. Do not merge `oneglanse/main` as part of the desktop split. Cherry-pick a capture fix only when asked.

## Telemetry

Hosted Oppvera may keep its existing PostHog. The desktop capture client does not send product analytics to PostHog, OneGlanse, or a new endpoint in v1.

When the Watch README is rewritten for the desktop install, remove the section that says this fork deleted PostHog. That section described the Docker-era fork versus upstream OneGlanse. It should not linger as a claim about the hosted Oppvera product. Replace it with: the Mac app does not phone home; scoring happens on Oppvera after you sync.

## Acceptance

- First-run copy includes the terms warning before a provider window opens.
- A capture payload with a `cookies` key is rejected.
- `LICENSE` still names both copyright holders.
- The desktop app has no PostHog dependency.
