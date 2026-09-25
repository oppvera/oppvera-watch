# Capture engine

Camoufox/Firefox automation used by the Oppvera Watch desktop app. It opens consumer AI product UIs, extracts answer text and citations, and stores provider logins under Application Support.

The desktop app imports `create-agent`, `execute-prompt`, `auth-cli`, and `auth-sessions`. There is no Redis worker and no analysis API key.

Provider page scripts live in `src/core/providers/`. Do not upload session files.
