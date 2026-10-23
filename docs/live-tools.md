# Trip live tools

The approved UI's AI screen now makes authenticated API calls. It no longer uses a timeout and a canned lunch proposal. Account settings now persist encrypted provider keys, group approvals and per-agent prompts. The rest of the prototype remains a local demonstration; this change does not claim production rollout or complete backend integration.

## Providers

| Tool | Endpoint | Configuration |
| --- | --- | --- |
| Sonar chat + Guide/Research/Planning | `/api/tools/chat`, `/api/tools/agents` | `PPLX_KEY` (existing) or `PERPLEXITY_API_KEY` |
| Firecrawl search | `/api/tools/research`, provider `firecrawl` | `FIRECRAWL_API_KEY` |
| Apify Actor dataset | `/api/tools/research`, provider `apify` | `APIFY_TOKEN`, `APIFY_ACTOR_ID`, `APIFY_INPUT_TEMPLATE` |
| BYOK | Account → Connections | Owner-managed encrypted keys and per-provider group approvals; plaintext keys never return to clients |

Set `TRIP_AUTH_USERS` as a server secret containing the authorized account/password JSON map. Hardcoded login codes have been removed; there is no default password. Authentication returns 503 until this secret is configured.

The API uses `/api/auth` to issue an opaque one-hour session in `TRIPS_KV`. Provider endpoints require that session and reject cross-origin browser requests. `TRIP_ADMIN_USERS` is a comma-separated server configuration listing integration owners. `TRIP_KEYS_ENCRYPTION_KEY` is a server secret containing a base64-encoded 32-byte AES key. Owners add keys and edit prompts in Account → Connections, then approve existing users per provider within integration groups. Shared key values never return through the settings API. Legacy provider routes are owner-only, so users cannot bypass group grants through the old endpoints. Keys are sent only to the corresponding fixed provider host. Error responses omit upstream response bodies. Provider results are rendered as text, and source links accept HTTPS only.

Apify input schemas depend on the selected Actor. For server credentials, administrators must configure an Actor ID and JSON template, for example `{"search":"{{query}}"}` only if that Actor accepts a `search` field. Callers cannot choose another Actor or override the template using server credits. With their own Apify key, users can enter an Actor ID and its exact JSON input. Each run caps output at 20 items and requests a $1 total charge ceiling and 25-second execution timeout. Provider billing rules still apply.

The three-agent action performs three separate Sonar calls. Firecrawl results are passed as untrusted reference data. Research errors and individual agent errors stay visible. No itinerary, reservation, packing list, or booking is edited by AI responses.

## Verification and rollout limits

- Run `node --test tests/trip-tools.test.mjs` for provider contract and authorization tests using isolated test doubles, not paid network calls.
- Run the existing prototype runtime integrity check, production build, and Sites worker tests.
- Live Firecrawl documentation retrieval succeeded through the connected tool during implementation.
- Apify and BYOK connectors were not found by plugin discovery; their direct API integration does not establish that deployment credentials exist.
- The current production Worker must deploy `trip-tools.mjs` alongside `_worker.js`. The approved React UI is still under `prototypes/trip-mobile`; publishing this backend alone does not switch the production frontend.
- Real-account provider calls, OCR, real trip persistence/sharing, weather, flight tracking, route calculations, and full UI rollout still require end-to-end acceptance. Do not label these complete based on these unit tests.

## Official API references

- https://docs.firecrawl.dev/features/search
- https://docs.apify.com/api/v2/act-run-sync-get-dataset-items-post
- https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview

Perplexity currently documents synchronous Sonar compatibility and the `/v1/sonar` endpoint. This change retains the user-requested Sonar model rather than silently switching models.

## Verified local acceptance

Three subagents reviewed the settings UI, authorization tests, and provider/error handling. 51 integration tests, the production build, the mobile runtime integrity check, and four Sites worker tests pass. Browser QA against the real handlers with isolated test accounts verified encrypted-key save, prompt persistence, member-only provider visibility, and revocation. A dummy key remained correctly marked Saved · untested. The test UI uses fixture sessions; real-account UI sign-in and paid provider calls are not claimed verified.

The settings use the existing KV binding. Access is rechecked on requests; cross-region KV replication can delay an approval/revocation. See `integration-acceptance.md` before production rollout.
