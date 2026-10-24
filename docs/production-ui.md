# Production Trip UI

The root Worker now serves the approved React UI, built by Wrangler's custom build command. The production entry uses native scrolling, inputs and responsive sheets, with no device frame or simulated keyboard. The reference prototype is retained separately.

Production trip data comes from authenticated `/api/app/*` handlers using the existing `TRIPS_KV` binding. Legacy fields remain stored; new planner, packing, booking, clothing and Whitepages content is stored under each record's `ui`. Trip access is owner/shared-account scoped. Only trip owners can change sharing; explicit Editor access permits edits. Private packing/photos are user scoped; shared item progress is updated only for the authenticated user. Weather calls Open-Meteo. Scanner output requires review and does not automatically save a trip.

The existing login compatibility fallback remains active when `TRIP_AUTH_USERS` is absent. Configured accounts override that fallback. Existing Gabe/Lux owner accounts manage integrations by default only when `TRIP_ADMIN_USERS` is unset; explicitly configured admin lists take precedence. `TRIP_KEYS_ENCRYPTION_KEY` remains supported. Without it, the existing private `trip_agents` R2 binding initializes an encryption master with a conditional create-only write under `private/trip/keys-master-v1`; group credentials are encrypted in KV. The public agent-file API does not allow access to this private path. Master keys never return to browsers.

Account → Connections lets owners add/test keys, edit prompts and approve groups. Actual provider credentials are still required for Sonar/Firecrawl/Apify. Unconfigured or failing providers return explicit errors. Flight tracking has no authoritative provider connected and displays unavailable rather than generated live status. Maps directions open explicitly in a separate page.

Validation: `node scripts/build-production.mjs` followed by `node --test tests/*.test.mjs` passes 80 tests, including production routing, legacy login compatibility, trip access/personal data isolation, provider group policies, encryption bootstrap and scanner review. Browser QA with isolated accounts verified server packing persistence through reload. These are not claims of successful paid provider requests or real-account sign-in.

KV's existing whole-list persistence and cross-region eventual consistency remain material limits: simultaneous trip edits can conflict and approval/revocation propagation is not instantaneous. No data migration deletes or reassigns unowned records.
