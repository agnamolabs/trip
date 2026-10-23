# Trip — functional mobile copy

A local interactive prototype of the reviewed Trip mobile direction. No production account or data connection is used.

## Open the copy
Open `Trip-Functional-Copy.html` in a modern browser. Everything needed to display the app is embedded. Some mobile document viewers do not execute JavaScript; use a browser rather than an attachment preview.

## Source project
Use Node 22+ and `npm ci`, then `npm run dev`. `npm run build` creates the static app and Worker package. `npm run check:runtime` protects the mobile preview shell. The app offers iPhone and Pixel 10 preview modes.

## Functional flows
- Five sections, overview, focused day planner and calendar.
- Add/edit/remove activities; sample optimization preview and apply.
- Alex and Sam packing progress stored separately on this browser.
- Personal/shared item views, clothing photo attachments.
- Booking image attachment, manual review and local booking save.
- Whitepages create/edit/delete, maximum 30 pages.
- Demo member list and role selection; nothing is sent or granted.
- Simulated Chat / Guide / Research / Planning results; concise previewable proposal.
- Browser-local persistence. Uploaded images are kept locally; maximum 4MB each.

## Not connected
Real authentication, cross-device sharing, invitations, AI/agent APIs, OCR extraction, flight search/tracking, live weather, route calculation, conflict checking, payment or reservations. Sample responses and forecasts are marked in the UI. Never rely on sample data for travel decisions.

## Design
Ivory / ink / petrol teal / vermilion, with one concentrated destination illustration. Home summary and detailed editing are separate. Body text is 15px; interactive rows 65–73px. Most actions are 44px tall. This is a prototype, not an accessibility compliance certification.
