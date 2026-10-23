# Trip integration acceptance

This checklist covers the requested settings and provider connections. Passing isolated tests does not establish a live deployment or a successful paid provider request.

## Required deployment configuration

| Setting | Purpose |
| --- | --- |
| `TRIPS_KV` | Existing KV binding; stores sessions, group configuration and encrypted provider keys. |
| `TRIP_AUTH_USERS` | Server secret: JSON map of existing account names to login passwords. No default credentials. |
| `TRIP_ADMIN_USERS` | Comma-separated account names authorized to manage provider keys, prompts and approvals. Must match real accounts exactly. |
| `TRIP_KEYS_ENCRYPTION_KEY` | Server secret: base64-encoded random 32-byte AES key. Required to save provider keys securely. Keep it stable; changing it requires reconnecting saved keys. |
| `PPLX_KEY` or `PERPLEXITY_API_KEY` | Optional existing Sonar key; owners may choose it instead of adding a key in Settings. |
| `FIRECRAWL_API_KEY`, `APIFY_TOKEN` | Optional existing provider keys; otherwise add them through Settings. |
| `APIFY_ACTOR_ID`, `APIFY_INPUT_TEMPLATE` | Optional server Actor defaults; group settings can configure their Actor and exact JSON input template. |

The runtime must publish `_worker.js`, `trip-tools.mjs` and `trip-settings.mjs` together. These modules use the existing KV binding. A prototype frontend build alone does not deploy these backend routes.

## Acceptance on the deployed app

1. Sign in as an owner. Confirm incorrect login and a signed-out provider request fail without contacting a provider.
2. Open Account → integrations. Add a group, save a provider key and reload. The provider appears configured; its raw value is never returned to the browser.
3. Use **Test connection** for each provider. Confirm success only after a valid provider response; an invalid key displays failure. Sonar/Firecrawl tests may incur normal API usage. Apify's token check does not start an Actor.
4. Edit Chat and one agent's system prompt, save and reload. Run that agent and verify the configured instruction reaches the provider request.
5. Approve a second real account for Sonar only. Sign in as that account: Sonar works with the group, Firecrawl/Apify are denied, and key/prompt/approval editing is denied.
6. Remove that account's Sonar approval and repeat the call. It must fail once KV has propagated the updated group. KV is eventually consistent; this design does not promise instantaneous global revocation.
7. For Apify, configure a real Actor and its accepted input schema. Run it and verify actual dataset items, the 20-item output limit, and reported errors. The request sets a $1 charge ceiling; provider billing rules still apply.
8. Run the three agents. Verify distinct real provider responses, HTTPS source links, and visible partial failures. No test response or default lunch proposal should replace an unavailable provider.
9. Confirm legacy provider routes also reject signed-out and unapproved requests, so old endpoints cannot bypass shared-key policy.

## Evidence currently available

- Local provider handlers and browser UI source compile.
- Provider/authorization tests use isolated test doubles and make no paid external calls.
- Firecrawl's connected documentation retrieval succeeded during implementation.
- Runtime credentials, deployed Account settings and paid real-account provider calls remain unverified until the deployed acceptance steps above succeed.

This change does not establish completion of trip persistence/sharing, image scanning, live flights/weather, routing, or the full production UI rollout.
