# Query bank and runs

## Status

**Implemented** in the Oppvera demo **v0.91.0**, merged to [`main`](https://github.com/codetricity/oppvera) on 2026-09-23 via [PR #270](https://github.com/codetricity/oppvera/pull/270).

Campaign **query bank** Probe runs set `query_item_id` on each pass. Ad-hoc questions on campaign Probe may still use null ids. Watch bank download remains [03-oppvera-probe-ingest-api.md](03-oppvera-probe-ingest-api.md) (Phase B; query-bank GET exists with session auth; device token is still open).

Watch and Probe must ask the **same frozen buyer questions** when the goal is a history chart. Oppvera already stores that list as the campaign `queries.md`, loaded into `QueryItem` (`query_id`, `text`, `expected_strength`, `category`, `source_url`) in `oppvera/schemas.py`.

## Frozen bank

A question is frozen when it has a stable `query_item_id` (`QueryItem.query_id`).

Rules:

- Editing the **text** of an existing id is a content change. Keep the id so history stays attached, and show the text that was actually asked on each capture (`visibility_captures.question`), not only the current bank text.
- Deleting an id does not delete captures. Charts for retired ids stay available under "archived questions."
- Adding an id starts a new series. Do not reuse an id for a different question.
- `expected_strength` and `category` are lab fields. Analytics does not use them as scores. They may display as tags.

Watch downloads this list from `GET /api/probe/campaigns/{id}/query-bank` (doc [03](03-oppvera-probe-ingest-api.md)). The desktop app does not edit it.

## Probe and the bank

Campaign Probe may still offer a short default of up to three generated questions (`default_questions` in `probe.py`). Those rows persist with `query_item_id=null`.

Partner-facing history and the compare view only include rows whose `query_item_id` is in the campaign bank (including archived ids).

Add a control on the Probe page: "Run the campaign query bank" which sends each bank question through the selected API providers and sets `query_item_id` on each pass. That is the path that lines up with Watch. Cap a single run at the current bank length, and keep the existing timeout behavior in `probe.py`.

Do not raise the ad-hoc default from three questions just to imitate a full bank. The bank runner is the explicit action.

## What a run is

A **run** is one user action that asks a set of questions to one or more providers.

| Source | Run starts when | `run_id` |
| --- | --- | --- |
| Probe | User submits the Probe form | `visibility_runs.id` created at start |
| Watch | User clicks Run in the desktop app | uuid created on the Mac, sent with every capture in that click |

Providers inside one run:

- Probe: the providers checked on the form (OpenRouter, Anthropic, OpenAI)
- Watch: the connected providers the user checked (ChatGPT.com, Claude.ai, and so on)

One capture row is one question × one provider. A run of 10 questions × 2 providers is 20 captures sharing one `run_id`.

Watch runs providers **sequentially**. Probe may keep its current parallel provider calls. Both still share `run_id`.

## Schedule

v1 runs are manual.

- Watch: the person starts a run on the Mac. No cron in the desktop app in v1.
- Probe: the person starts a run in Oppvera. A hosted schedule that repeats the bank is optional later and is not required for the first analytics page.

Monthly history in the design-partner sense is "run the same ids again later," not an unattended cloud browser. Hosted **email reports** (doc [08](08-email-reports-and-nudges.md)) can remind the user to run Watch when UI capture is stale while the email body leads with **Probe** state so they still open the report.

## Offline Watch queue

If Oppvera is unreachable:

- Keep capture files on disk (doc [02](02-watch-desktop-electron.md))
- Retry the same `client_capture_id` values
- Do not start a second `run_id` for the retry

The server treats a replay as `exists` (doc 03).

## Lab beside a capture

For a bank question, the campaign visibility detail page links to Studio diagnosis for that question when the lab has a result. The capture remains labeled with its `provider_label`. The diagnosis remains a statement about owned content in the lab, not about the consumer UI.

## Acceptance

- Changing a question's text without changing its id still groups old and new captures in one series, and the old row still shows the old text.
- A Probe bank run and a Watch run of the same ids produce compare pairs (doc 05).
- A Probe experiment that used only `default_questions` does not appear as a bank series.
