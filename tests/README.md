Flight regression checks
========================

- `npm test`: `npm install` and Node 20+; tests DOM interactions and the actual Worker with mocked Perplexity responses. No keys, account access or trip data are required.
- `npm install && npx playwright install chromium && npm run test:browser`: responsive Chromium checks at 1440, 768, 390 and 320 pixels. All network requests are intercepted; the deployed HTML is loaded into an isolated fixture. Authentication and trip setup are replaced only inside that fixture. No saved trip data is read or written. Screenshots go to the OS temporary directory, outside the repository. An existing Chromium executable can be selected using `TRIP_CHROMIUM_PATH`.

The flight controls are tested for HTML/event-handler injection, malformed/null responses, duplicate suggestions, refresh and offset reset, retry after failure, overlapping requests and tracking modal dismissal. The Worker tests also assert unverified metadata and preserve the existing trip persistence source unchanged from the inspected baseline.

These tests validate UI and response handling, not flight accuracy. Perplexity is not an authoritative flight provider. Suggestions and status estimates remain unverified; additional batches have no provider cursor or confirmed total. A real provider integration is required before showing confirmed availability, prices, gates or live status.
