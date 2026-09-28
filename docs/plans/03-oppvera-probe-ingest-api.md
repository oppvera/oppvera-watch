# Oppvera Probe ingest API (Watch pairing and captures)

## Status

**Implemented** in the Oppvera demo **v0.95.0**, merged to [`main`](https://github.com/codetricity/oppvera) on 2026-09-23 via [PR #277](https://github.com/codetricity/oppvera/pull/277).

Pairing, device Bearer tokens, query-bank device auth, and `POST /api/probe/captures` live in `oppvera/routers/probe_api.py` and `oppvera/visibility/devices.py`. Watch is the HTTP client.

This spec is **Oppvera-only**. The desktop client is [02-watch-desktop-electron.md](02-watch-desktop-electron.md).

Implement this in the Oppvera demo app:

`/Users/craig/Documents/Oppkey/geo/generative-engine-optimization/app/lab/demo/`

Stack there is FastAPI, SQLModel, session cookie `rl_session` for the browser, and routers included from `oppvera/app.py`. This API is new. Do not extend `POST /api/uploads` or the corpus ingest pipeline.

Probe's in-process writer (doc [04](04-oppvera-probe-persistence.md)) inserts the same rows without HTTP. Watch is the HTTP client.

## Auth model

Two callers:

| Caller | Auth |
| --- | --- |
| Oppvera HTML (create pairing code, browse history) | Existing session cookie. User must be allowed to access the campaign (`content` write or a new `watch.ingest` permission on that campaign). |
| Oppvera Watch desktop | `Authorization: Bearer <device_token>` |

There is no client API-key table today. Add one.

### `probe_devices`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `workspace_id` | required |
| `campaign_id` | token is scoped to one campaign in v1 |
| `label` | user-visible, e.g. "Craig's Mac" |
| `token_hash` | store a hash, never the raw token |
| `created_by_user_id` | who paired |
| `created_at` | ISO time |
| `last_seen_at` | updated on successful ingest |
| `revoked_at` | null if active |

Pairing codes are short-lived rows, not the device token:

### `probe_pair_codes`

| Column | Notes |
| --- | --- |
| `id` | uuid |
| `campaign_id` | |
| `code` | 8 characters, unguessable enough for a 10-minute window; store hashed |
| `created_by_user_id` | |
| `expires_at` | 10 minutes |
| `consumed_at` | set when exchanged |

## Endpoints

JSON only. Errors: `{ "detail": "string" }` to match FastAPI.

### `POST /api/probe/campaigns/{campaign_id}/pair-codes`

Session cookie. Response:

```json
{
  "code": "K7QM-2P9L",
  "expires_at": "2026-09-22T23:40:00Z",
  "campaign_id": "uuid",
  "campaign_name": "Positron vs Cursor"
}
```

Show the code once in the Oppvera UI. Do not log the raw code.

### `POST /api/probe/devices/pair`

No session. Body:

```json
{
  "code": "K7QM-2P9L",
  "label": "Craig's Mac"
}
```

Response `201`:

```json
{
  "device_token": "ow_live_...",
  "workspace_id": "uuid",
  "company_id": "uuid",
  "campaign_id": "uuid",
  "campaign_name": "string",
  "company_name": "string",
  "brand_domain": "string",
  "api_base": "https://oppvera.com"
}
```

`device_token` is returned once. Invalid, expired, or reused code: `400`. Unknown code: `400` with the same body as expired (do not reveal which).

### `GET /api/probe/campaigns/{campaign_id}/query-bank`

Bearer device token **or** session cookie. The token's `campaign_id` must match the path.

Response:

```json
{
  "campaign_id": "uuid",
  "queries": [
    {
      "query_item_id": "q_intro",
      "text": "What is the best ...",
      "category": "category",
      "expected_strength": "unknown"
    }
  ]
}
```

Source the list from the campaign `queries.md` loader that already feeds `QueryItem` (`query_id`, `text`, `expected_strength`, `category`). Rename `query_id` to `query_item_id` in this API so Watch and analytics share one name. Keep `query_id` on the existing `/api/queries` routes.

Empty bank: `200` with `"queries": []`.

### `POST /api/probe/captures`

Bearer device token. Batch ingest. The token's campaign is the only campaign accepted; ignore any campaign id in the body that does not match, and return `403` if the body disagrees. Watch sends `campaign_id` on the batch and on each capture.

Body:

```json
{
  "run_id": "uuid",
  "campaign_id": "uuid",
  "captures": [
    {
      "client_capture_id": "uuid",
      "source": "watch",
      "campaign_id": "uuid",
      "provider_id": "chatgpt",
      "provider_label": "ChatGPT.com (signed-in session)",
      "grounded": null,
      "query_item_id": "q_intro",
      "question": "What is the best ...",
      "raw_answer": "markdown text",
      "citations": [
        {
          "title": "Docs",
          "cited_text": "short excerpt",
          "url": "https://example.com/docs",
          "domain": "example.com"
        }
      ],
      "captured_at": "2026-09-22T23:00:00Z",
      "account_hint": null
    }
  ]
}
```

Limits: at most 50 captures per request. `raw_answer` at most 200_000 characters. Reject the item, not the whole batch, when one item is invalid.

`source` from this endpoint must be `watch`. Probe rows are inserted by the server (doc 04), not by the desktop.

`provider_id` for Watch must be one of: `chatgpt`, `claude`, `gemini`, `perplexity`, `ai-overview`.

Response `200`:

```json
{
  "results": [
    {
      "client_capture_id": "uuid",
      "status": "created",
      "capture_id": "uuid"
    },
    {
      "client_capture_id": "uuid",
      "status": "exists",
      "capture_id": "uuid"
    }
  ]
}
```

Idempotency: unique `(device_id, client_capture_id)`. A repeat POST returns `exists` and the original `capture_id`. Do not create a second analysis job.

On `created`, enqueue analysis (doc [05](05-unified-analytics.md)). Do not block the HTTP call on the LLM.

### `GET /api/probe/captures`

Session cookie (analytics UI) or bearer token (Watch sync debug only).

Query: `campaign_id` (required), optional `source` (`watch` or `probe`), optional `run_id`, optional `query_item_id`.

Response: list of capture summaries **without** asking Watch to render scores. Include `capture_id`, `source`, `provider_id`, `provider_label`, `query_item_id`, `question`, `captured_at`, `run_id`, `analysis_status` (`pending`, `ready`, `failed`).

Full answer text is allowed for the session-cookie caller. The device token may only read captures that device uploaded, and only enough to confirm sync (`capture_id`, `client_capture_id`, `analysis_status`).

### `POST /api/probe/captures/{capture_id}/analyze`

Session cookie, campaign access. Re-runs the shared scorer. Device tokens cannot call this.

## Mapping from Watch `AskPromptResult`

Watch code today (`packages/types/src/types/agent.ts`):

```text
userId, workspaceId, promptId, prompt, response, sources[]
sources: title, cited_text, url, domain, favicon?
```

Map:

| Watch field | API field |
| --- | --- |
| new uuid | `client_capture_id` |
| constant `watch` | `source` |
| provider being run | `provider_id` |
| label table in doc 01 | `provider_label` |
| `promptId` from the query bank | `query_item_id` |
| `prompt` | `question` |
| `response` | `raw_answer` |
| `sources` minus `favicon` | `citations` |
| run uuid | `run_id` |

Drop `userId` from the Watch app user. Oppvera's user is the person who created the device. Do not send Playwright user ids.

Drop `favicon`. It is optional display chrome and often a data URL.

## Security

- Reject bodies that contain keys named `cookies`, `storageState`, `localStorage`, or `origins`. Return `400`. Those blobs stay on the Mac.
- `account_hint` max 64 characters, no `@` full email. Optional. Example: last 4 of an email, or a region code the user typed. Never scrape the cookie jar to fill this.
- Device token prefix `ow_live_` so it is recognizable in logs. Log only the prefix and last 4.
- Revoke: `POST /api/probe/devices/{id}/revoke` with session cookie. Later ingests `401`.

## Router placement

`oppvera/routers/probe_api.py` is included from `oppvera/app.py`. Watch ingest is **done** on Oppvera v0.95.0: pairing, device Bearer, query-bank, `POST /captures`, revoke.

Human Probe UI lives in `oppvera/routers/probe_ui.py` at `/workspace/campaigns/{id}/probe`. Legacy `/admin/dev/probe` in `routers/ui.py` redirects to that path. Watch never calls those HTML routes.

## Tests

In `app/lab/demo/tests/`:

- Pair code expires and cannot be reused
- Device token can post a capture and a second post returns `exists`
- Token for campaign A cannot post to campaign B
- Cookie payload key is rejected
- Query bank returns campaign `queries.md` ids
- Session user without campaign access gets `403`

## Acceptance

Watch can pair against local Oppvera, download the bank, POST one capture, and see `created` then `exists` on retry, with a row in `visibility_captures` (`source=watch`) as defined in doc 04.
