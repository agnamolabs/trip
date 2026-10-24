# agnamo · trip

Trip planning, travel, maps, events, packing, weather and Whitepages. [trip.agnamo.com](https://trip.agnamo.com)

The production Worker serves the responsive UI from `prototypes/trip-mobile/src/production.tsx` and the authenticated trip/provider handlers. Wrangler builds it automatically before deployment.

```sh
node scripts/build-production.mjs
node --test tests/*.test.mjs
```

Cloudflare D1 stores the page registry, per-trip records and ACLs, expiring sessions, and encrypted integration settings. Existing KV data imports once and remains a read-only backup; private image blobs stay in R2. Map and Events reuse saved trip data, with event discovery and URL import for prefilled review.

Account → Connections manages provider keys, agent prompts and approved user groups. See [production behavior and limits](docs/production-ui.md) and [integration acceptance](docs/integration-acceptance.md).

The original visual reference prototype is retained under `prototypes/trip-mobile/`; production selects the real-data app and native web runtime.
