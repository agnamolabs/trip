# agnamo · trip

Smart packing companion. [trip.agnamo.com](https://trip.agnamo.com)

## Mobile UI prototype

The approved compact Trip UI is in `prototypes/trip-mobile/`. Run `npm ci` and `npm run dev` there. A self-contained browser copy is in `preview/index.html`.

This prototype uses local browser storage. AI chat, agent output, flight/weather data, member roles, and optimization are demonstrations. Image import supports manual booking entry; OCR and the existing backend are not connected. The production frontend and backend remain in their existing locations.

Validation: runtime integrity check, production build, and four Sites worker tests passed.
