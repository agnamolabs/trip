# Trip functional copy — design and interaction verification

Source visual truth: ../generated_images/exec-430bbade-108b-4ad9-a6d5-9e10d1789eae.png, with the user's subsequent usability review explicitly superseding its crowded layout.
Implementation: http://terminal.local:4173/functional-copy.html
Browser-rendered screenshot: /workspace/scratch/trip-functional-final.png
Comparison: ../trip-qa-comparison.jpg (before the final hero-height reduction).

## Approved intentional changes
The user requested a functional copy after the review: overview and detailed planner separated; one illustrated dark next-up surface; weather/packing summaries; three clean agenda rows; AI entry; five tabs. Removed stock thumbnails, duplicate Members/Whitepages tiles, oversized date, and permanent composer on overview. This is not a pixel-for-pixel recreation of the rejected crowded screenshot.

## Evidence and dimensions
Browser viewport 1363x936. iPhone preview logical screen393x852, rendered approximately360.5x781.6 due protected fit-to-browser scaling. Pixel preview427x952 also inspected. Source938x1677, visually normalized alongside the cropped implementation for composition review. These captures are scaled rather than a strict unscaled pixel-fidelity proof; CSS sizes were checked in source. Source has no device chrome; implementation retains required runtime-owned device chrome. No accessibility compliance claim.

## Findings and fixes
- P1 initial form creation failed because randomUUID was unavailable in non-secure preview. Added local unique-ID fallback; creation verified with Sunset walk at18:00.
- P2 scroll top used bottom safe-area variable for top position, obscuring the eyebrow. Added app-owned device-top geometry; verified header/context/content separation.
- P2 native focus scrolled the protected outer screen, exposing the keyboard asset after dismissal. App now resets non-keyboard outer-screen scroll while preserving inner MobileScroll behavior; closed-keyboard screen verified.
- P2 overview AI entry partially below fold. Reduced hero196→172→148 and summary spacing. Final screenshot shows complete entry and persistent navigation.

## Required visual surfaces
Typography: restrained brand serif with readable neutral sans;15px task labels,12px metadata,65–73px itinerary rows. Small demo/eyebrow labels are supplemental. No long activity label clipped in inspected states.
Spacing:16px gutters, concentrated hero, open list rows; no horizontal overflow observed; longer views scroll.
Colors: ivory/ink/petrol teal/vermilion; no decorative gradients or generic stock thumbnail cards. Contrast not certified.
Images: supplied illustration reused directly; no CSS approximation. Icon library Radix. Photo import accepts local image files, not remote uploads.
Copy: simulated/live-unavailable states stated explicitly. Agent outputs concise; preview/apply never books or sends anything.

## Primary interactions tested in browser
- Five-section navigation and overview→Full day.
- Packing increment: AlexT-shirts1/3→2/3; Sam remains0/3 and0/8 total.
- Sample optimization Preview→Apply updates lunch12:00→12:30.
- Activity create/save: Sunset walk18:00, Waikiki; persisted through reload.
- Whitepages create/save: Arrival checklist; count2/30→3/30; persisted through reload.
- Chat simulation responds to packing query using active user's local progress; three agent controls visible.
- Android device selection and return to iPhone; fixed safe-area layout inspected.
- Self-contained HTML opens and navigation works.
- Runtime integrity check passed; production build passed; four packaging/Worker tests passed.
- Browser logs checked: application randomUUID error found and corrected; final self-contained view only showed unrelated browser-extension metadata errors.

## Limits and follow-up
Live APIs, secure authentication/authorization, real collaboration, OCR, itinerary optimization, flight/weather feeds and routed maps are not connected. Image attachments and member role UI are implemented but were not exhaustively exercised in browser. No physical-device or screen-reader testing. Full offline file behavior depends on the user's browser allowing JavaScript and local storage; some attachment viewers do not.

Final result: passed
