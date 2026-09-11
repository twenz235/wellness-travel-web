# Wellness Travel design system

This is the implementation reference for the new web version. It translates the visual direction in `exam-plan/ux/wireframe.html` into reusable tokens, layout rules, and UI states. The wireframe is a visual reference; copy, data, and recommendation status come from the real Go API.

## Visual language

- **Tone:** quiet, editorial, nature-first, with generous whitespace and a blue-green accent.
- **Page surface:** `#f7f8f4` (`--color-page` / `--paper`). Cards use white with a thin green-gray border.
- **Text:** `#203b38` (`--color-ink` / `--ink`); supporting text uses `#64736f` (`--color-muted` / `--muted`).
- **Accent:** `#24657a` (`--color-accent` / `--blue`); dark action buttons use the ink color.
- **Typography:** system Thai sans-serif for UI text; Georgia is reserved for the italic editorial emphasis (`em`).

Tokens live in `app/globals.css`. Spacing uses a 4px base (`--space-1` through `--space-7`), controls use `--radius-control`, cards use `--radius-card`, and modal/search panels use `--radius-panel`. Keep focus indicators visible and preserve a minimum 44px interactive target.

## Wireframe assets

The SVG illustrations from `exam-plan/ux/assets/` are copied into `public/assets/` and reused by the working UI:

- `mountains.svg`: landing postcard, hero decoration, and alternating recommendation card art.
- `forest.svg`: inspiration card and alternating recommendation card art.
- `lake.svg`: inspiration card and alternating recommendation card art.

These are supplied demo illustrations, so the UI does not imply that they are photographs of a specific park. Real place provenance remains in the detail view and source links.

## Component map

| Surface | Component/classes | Purpose |
| --- | --- | --- |
| First visit | `.landing-page`, `.landing-copy`, `.landing-postcard` | Introduce the product and open the preference form. |
| App shell | `.topbar`, `.brand-mark`, `.profile-button` | Persistent identity and preference access. |
| Search | `.hero-section`, `.search-card`, `.search-grid` | Choose a date range or search within the next 30 days. |
| Results | `.results-section`, `.result-group`, `.group-cards`, `.place-card` | Separate complete, incomplete, and non-matching statuses. |
| Map | `.map-panel`, `.map-canvas`, `.map-marker` | MapLibre/OpenFreeMap overview with one marker per place. |
| Details | `.place-detail`, `.detail-days`, `.hourly-list` | Daily/hourly explanation and provenance on demand. |
| Preferences | `.panel-backdrop`, `.profile-panel` | Edit saved user preferences; cancel restores the last saved value. |

## Responsive rules

- **Mobile (320–639px):** one card per row, one-column search form, full-width actions, and the map after all cards. The 320px layout is the minimum supported width.
- **Tablet (640–1200px):** two cards per row; the map moves below the card list so the result flow remains readable.
- **Desktop (>1200px):** three cards per row; the map sits beside the result list and remains sticky while browsing.
- Results render three rows initially and append more cards through the lazy-load sentinel. The map always represents all available places, including cards not yet rendered.

## Interaction and state rules

1. First visit shows the landing page. Saving preferences stores them in the browser and opens the search page; later visits skip onboarding.
2. The date range is optional. With no dates, the API searches the next 30 days using the saved trip length. A selected trip may be 1–30 days.
3. `national_park` is the only hard requirement. Temperature, rain, and AQI affect scores and explanations.
4. Result status is explicit: `ผ่านเงื่อนไขและข้อมูลครบ`, `ข้อมูลยังไม่ครบ`, or `ไม่ตรงเงื่อนไข`.
5. Loading, API error, no-result, and incomplete-data states retain the same spacing and focus behavior as the normal state.

