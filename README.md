# agnamo · trip

Smart packing companion. [trip.agnamo.com](https://trip.agnamo.com)

## Compact Trip UI prototype

The approved UI and complete runnable source are in `prototypes/trip-mobile/`.

```sh
cd prototypes/trip-mobile
npm ci
npm run dev
```

Live preview: https://agnamo-trip-preview.luxdev-3821.chatgpt.site

To generate a standalone HTML copy, run `npm run build` followed by `python scripts/make-offline-copy.py` from the prototype directory.

The prototype uses local browser storage. AI chat, agents, flight/weather data, member roles, and optimization are demonstrations. Booking image import supports manual entry; OCR and the production backend are not connected.

Validation: runtime integrity, production build, and four Sites worker tests passed. Production frontend and backend files are unchanged.
