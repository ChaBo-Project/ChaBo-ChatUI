# Managed document chat

An optional native Svelte screen is available at `${APP_BASE}/managed` when
`PUBLIC_MANAGED_CHAT_ENABLED=true`. The generic chat navigation links to it only
when enabled. The default remains disabled. This is a page in ChatUI, not an
iframe or redirect to API documentation.

The screen uses the same-origin `/management` APIs with the existing ChaBo human
session cookie and CSRF token. It supports email-code sign-in (and a password if
enrolled), document collection binding, English/Kinyarwanda text chat, canonical
history, explicit retry with the same turn/body, owner deletion, microphone
capture/preview and answer playback. Kinyarwanda voice is marked as evaluation;
its quality has not been accepted. Enter an assigned bot and published collection
ID, or resume an existing conversation by ID. Collection administration remains
in the management APIs.

The managed identity and conversation history belong to the management and
logging services. They are not mapped to anonymous ChatUI identities or copied
into MongoDB. The existing generic ChatUI runtime still requires MongoDB for
its own sessions/settings and migration startup. Its account does not authorize
managed API calls. No provider token or service capability is exposed to the
browser.

`static/managed-chat/` contains the reusable browser client/audio adapters and a
DOM controller mounted within the Svelte page. These adapters originate from
ChaBo-Channels `3fbe80808b9b81499f6121e26b8d5fa13d6507d1` under its Apache-2.0
license. Changes here add scoped selectors, stylesheet rules and an explicit
Svelte lifecycle disposer. Keep contract changes synchronized with the backend.
The page renders model output as plain text, never injected HTML. It stores no
account token, recording or transcript in browser storage. The app's existing
theme preference is independent.

On navigation, deletion or sign-out the controller releases microphone tracks,
audio URLs and handlers. Pending writes never retry automatically. Reload loses
pending local recordings; reopen the canonical conversation before starting a
new question if the previous outcome is uncertain. Playback after reload uses
the history API's completed `turn_id` values.

## Deployment

Build `Dockerfile.uat` with `APP_BASE=/chat` and the exact source revision in
`VCS_REF`. The image runs adapter tests, Svelte checks and the production build.
Its Node base is digest-pinned. This lean UAT image omits installed browser
binaries used by unrelated web-browsing tools; the original Dockerfile remains
available for those deployments.

Publish `/chat/` and `/management/` on the same HTTPS origin. Set `ORIGIN` and
`PUBLIC_ORIGIN` to that origin, and configure the management authentication
origin to match. `PUBLIC_MANAGED_CHAT_ENABLED=true` is the only new runtime
setting. No new provider key or human account is required. A file URL or separate
localhost origin cannot reuse UAT's secure session cookie. For local development,
use an HTTPS reverse proxy serving both the local ChatUI and the local management
API, with matching authentication origin/cookie settings.

UAT Compose/build automation resides in ChaBo-Channels alongside the existing
isolated service deployments. ChatUI uses a dedicated MongoDB volume and unique
generic cookie name. MongoDB has no published port. The existing documentation
credentials protect UAT ingress; they do not grant access to the human APIs.

## Checks

`node --test scripts/managed-tests/*.test.mjs` checks bounded PCM conversion,
variable AudioWorklet blocks, permission-pending cancellation, exact manual
retry, cookie/CSRF transport, owner/turn matching, response limits and playback
integrity. `npm run check` checks the complete Svelte application. A production
build and separate actual-browser UAT acceptance are required before rollout.
