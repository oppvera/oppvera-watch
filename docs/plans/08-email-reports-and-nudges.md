# Email reports and Oppvera Watch nudges

Implement in the hosted Oppvera demo app:

`/Users/craig/Documents/Oppkey/geo/generative-engine-optimization/app/lab/demo/`

This spec is **hosted product behavior**. It does not change the desktop capture client except by giving consultants a reason to run Watch on a rhythm they already use (monthly retainer reports).

Manual Watch runs stay manual (doc [06](06-query-bank-and-runs.md)). Email is the **reminder and teaser**, not automation of ChatGPT.com.

## Goals

1. Send a periodic **campaign report email** to the person who should act on it (start with the logged-in user who enables the feature; allow a dedicated recipient later).
2. Make the email **worth opening** by summarizing **current Oppvera Probe** state from `visibility_captures` / `visibility_analyses` where `source=probe`.
3. When **Oppvera Watch** is enabled for that campaign, put a **Watch nudge at the top** if there has been no recent UI capture (`source=watch`).
4. Link to the **full report** on Oppvera (campaign visibility page, doc [05](05-unified-analytics.md)).
5. Leave room to add sections later (site change analysis, lab diagnosis highlights, and so on). **v1 is Probe summary plus optional Watch banner only.**

## Campaign settings

Add campaign-level flags (SQLModel fields or a small `campaign_report_settings` table):

| Field | Type | Meaning |
| --- | --- | --- |
| `email_reports_enabled` | bool | Send scheduled report emails for this campaign |
| `email_report_recipient_user_id` | uuid, nullable | Defaults to user who turned it on; later: pick any workspace member |
| `email_report_cadence` | enum | v1: `monthly` only. Later: `weekly`, `biweekly` |
| `watch_reminder_enabled` | bool | Include Oppvera Watch nudge block when UI capture is stale |
| `watch_stale_days` | int | Default `30`. Nudge when no `source=watch` capture in this many days |
| `last_report_sent_at` | ISO time | For scheduler idempotency |

UI: campaign settings (or visibility page) with:

- Checkbox: **Send email reports**
- Checkbox (enabled when reports on): **Remind me to run Oppvera Watch** when UI capture is out of date
- Short note: Probe summaries use **API-labeled** answers, not ChatGPT.com. Watch records **signed-in consumer UIs** on the Mac.

Do not send Watch reminders when `watch_reminder_enabled` is false, even if Watch was never run.

## What triggers send

v1: a daily hosted job (cron on Fly, or `launchd` in dev) that finds campaigns where:

- `email_reports_enabled` is true
- cadence says a report is due (e.g. first Monday of the month, or 30 days since `last_report_sent_at`)
- campaign is not archived

Optional later: manual **Send report now** button for admins.

Use the existing Mailgun / email stack (`EMAIL_BACKEND`, auth reset mail). Category the send in logs as `campaign_visibility_report`.

## Email layout (v1)

**Subject line** (examples):

```text
{Company name} — visibility update ({month year})
```

Include mention rate or "N questions tracked" when data exists so the inbox is not generic.

**Body order:**

### 1. Oppvera Watch banner (top, conditional)

Show **only when** `watch_reminder_enabled` is true **and** either:

- no `visibility_captures` row with `source=watch` for this campaign, or
- `max(captured_at)` for `source=watch` is older than `watch_stale_days`

Copy (plain language):

```text
You have not run Oppvera Watch recently (last UI capture: {date or "never"}).
Consumer apps such as ChatGPT.com are not included in the Probe summary below.
Run Oppvera Watch on your Mac to record a signed-in session for this campaign's query bank.
```

Link: Oppvera help or pairing page on the campaign (`/workspace/campaigns/{id}/visibility` with anchor `#watch-pairing`).

Do **not** claim Watch data is in the email when it is stale. Do **not** put this banner below the Probe teaser; it must stay at the top so it is seen first.

When Watch is fresh (capture within `watch_stale_days`), omit the banner. Optionally one line: "Last Oppvera Watch capture: {date}."

### 2. Oppvera Probe summary (main hook)

This block drives opens. Build from the **latest Probe run** or rolling window (v1: last 30 days, `source=probe` only):

| Line in email | Data source |
| --- | --- |
| Campaign and company name | `Campaign`, `Company` |
| Query bank size | count of `query_item_id` in bank |
| Last Probe run date | `max(captured_at)` or `visibility_runs.finished_at` for `source=probe` |
| Mention rate | analyses with `mentioned=true` / analyses with `source=probe` in window |
| Mean GEO score (mentioned only) | mean `geo_score` where `mentioned` (doc 05) |
| Per-question one-liners (cap 5) | For each bank question: `{query text truncated}` → mentioned yes/no, score if ready |
| Honest label footer | "Answers from API providers (OpenRouter / OpenAI / Anthropic web search). Not ChatGPT.com or Claude.ai." |

If there is **no Probe data** in the window:

```text
No Probe captures yet for this period. Run Probe from Oppvera (Development) or schedule a bank run when available.
```

Still send the email if reports are enabled so Watch-only users get the banner; Probe section can be short.

### 3. Call to action

Primary button/link:

```text
View full report on Oppvera
```

URL: `/workspace/campaigns/{id}/visibility` (authenticated; use a signed token link later if you add magic links).

Secondary (optional): link to pair Oppvera Watch when banner shown.

### 4. Future sections (not v1)

Reserve placeholders in the template or a `report_sections[]` builder for later:

- Site / content change analysis since last report
- Studio lab diagnosis deltas (eight signals)
- Brand Security harvest highlights
- Rivals or Contrast one-liners

v1 template must not depend on these. Add sections without breaking the Probe + Watch layout.

## Full report on the web

The email is a **teaser**. The campaign visibility page (doc 05) holds:

- Full capture table (Probe and Watch, filtered)
- Charts and compare view
- Citations
- Lab beside capture links

Email must not duplicate entire answer text. Snippets only (question + mentioned + score).

## Recipient

v1: `email_report_recipient_user_id` or the user who enabled reports. Send to that user's email from the `users` table.

Later: multiple recipients, agency admin default, separate "Watch operator" email.

## Privacy and labeling

- Email is not forwarded to clients by default; copy is for the **agency user**. If they forward it, Probe disclaimer still applies.
- Never write "ChatGPT said" in the Probe section. Use "API capture" or provider labels from doc [01](01-product-split.md).
- Do not include cookies, full answer bodies, or PII from `account_hint` in email.

## Dependencies

Requires before meaningful v1 emails:

- `visibility_captures` and `visibility_analyses` (docs [04](04-oppvera-probe-persistence.md), [05](05-unified-analytics.md))
- At least one Probe bank run persisted with analyses

Watch banner can work with zero Watch rows (shows "never") once ingest exists (doc [03](03-oppvera-probe-ingest-api.md)).

## Tests

- Campaign with reports off: job sends nothing
- Stale Watch + reminder on: banner present, Probe block present
- Fresh Watch + reminder on: no banner
- Reminder off: no banner even when Watch stale
- Probe mention rate matches dashboard for same window
- `last_report_sent_at` updates once per period (no duplicate spam same day)

## Acceptance

A consultant enables email reports and Watch reminders on a campaign with Probe history. They receive one monthly email whose **top** says Watch is stale when applicable, whose **middle** shows Probe mention rate and a few question lines they want to click through, and whose link opens the full visibility report on Oppvera.
