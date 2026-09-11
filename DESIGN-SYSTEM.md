# Wellness Travel design system

This is the implementation reference for the new web version. It translates the visual direction in `exam-plan/ux/wireframe.html` into reusable tokens, layout rules, and UI states. The wireframe is a visual reference; copy, data, and recommendation status come from the real Go API.

## Visual language

- **Tone:** quiet, editorial, nature-first, with generous whitespace and a blue-green accent.
- **Page surface:** `#f7f8f4` (`--color-page` / `--paper`). Cards use white with a thin green-gray border.
- **Text:** `#203b38` (`--color-ink` / `--ink`); supporting text uses `#64736f` (`--color-muted` / `--muted`).
- **Accent:** `#24657a` (`--color-accent` / `--blue`); dark action buttons use the ink color.
- **Typography:** system Thai sans-serif for UI text; Georgia is reserved for the italic editorial emphasis (`em`).
- **Icons:** use Ant Design icons with semantic meaning: `SearchOutlined` for the search action, `FireOutlined` for temperature, `CloudDownloadOutlined` for rain, and `HeatMapOutlined` for the AQI summary.

Tokens live in `app/globals.css`. Spacing uses a 4px base (`--space-1` through `--space-7`), controls use `--radius-control`, cards use `--radius-card`, and modal/search panels use `--radius-panel`. Keep focus indicators visible and preserve a minimum 44px interactive target.

## Wireframe assets

The SVG illustrations from `exam-plan/ux/assets/` are copied into `public/assets/` and reused by the working UI:

- `mountains.svg`: landing postcard, hero decoration, and alternating recommendation card art.
- `forest.svg`: inspiration card and alternating recommendation card art.
- `lake.svg`: inspiration card and alternating recommendation card art.

These are supplied demo illustrations, so the UI does not imply that they are photographs of a specific park. The card keeps the summary compact; place names focus the corresponding map marker and do not expand an inline detail panel.

## Component map

| Surface | Component/classes | Purpose |
| --- | --- | --- |
| First visit | `.landing-page`, `.landing-copy`, `.landing-postcard` | Introduce the product and open the preference form. |
| App shell | `.topbar`, `.brand-mark`, `.profile-button` | Persistent identity and preference access. |
| Search | `.hero-section`, `.search-card`, `.search-grid` | Choose a date range or search within the next 30 days. |
| Inspiration | `.inspiration-section`, `.group-cards`, `.place-card` | Show the six highest-scoring recommendations returned for the fixed system baseline using the same card template as search results. |
| Results | `.results-section`, `.result-group`, `.group-cards`, `.place-card` | Separate complete, incomplete, and non-matching statuses. |
| Map | `.map-panel`, `.map-canvas`, `.map-marker` | MapLibre/OpenFreeMap overview with one marker per place. |
| Map focus | `.place-card-button`, `.map-marker`, `.map-place` | Selecting a place name flies the map to that marker without expanding the card. |
| Preferences | `.panel-backdrop`, `.profile-panel` | Edit saved user preferences, including the default 1–30 day flexible-trip length; cancel restores the last saved value. |

## Responsive rules

- **Mobile (320–639px):** one card per row, one-column search form, full-width actions, and the map after all cards. The 320px layout is the minimum supported width.
- **Tablet (640–1023px):** two cards per row; the map moves below the card list so the result flow remains readable.
- **Laptop and desktop (≥1024px):** three cards per row for the home recommendations and results; the map sits beside the result list above 1200px and moves below it at smaller widths.
- The desktop search action is aligned to the right edge of the search card; when the post-search preference summary is present it occupies the left side. On mobile the action becomes a full-width stacked button.
- Flexible `สถานที่สำหรับคุณ` results use pagination with 12 cards per page; the page size is capped below 100 and the map always represents all available places, including cards on other pages.

## Interaction and state rules

1. First visit shows the landing page. Saving preferences stores them in the browser and opens the search page; later visits skip onboarding.
2. The date range is optional. With no dates, the API searches the next 30 days using the saved 1–30 day trip length from the preferences panel; the search form does not repeat that field.
3. `national_park` is the only hard requirement. Temperature, rain, and AQI affect scores and explanations.
4. Result status is explicit: `ผ่านเงื่อนไขและข้อมูลครบ`, `ข้อมูลยังไม่ครบ`, or `ไม่ตรงเงื่อนไข`.
5. Selecting a place name calls `flyTo` with the current zoom. On mobile the map is read-only (no pan, zoom, rotate, touch, or keyboard map interactions); tablet and desktop keep map controls enabled.
6. Loading, API error, no-result, and incomplete-data states retain the same spacing and focus behavior as the normal state.
7. After a profile is saved, the home page requests the flexible 30-day recommendation with `period: "day"` and `scoringProfile: "system"`; the API applies the 25–30°C, no-rain, equal-weight baseline, sorts national parks by that score, and shows the first six places. Search requests use `scoringProfile: "user"` with the saved preferences. The card date range is the API-selected best window; the home list is a recommendation preview, not a replacement for the full result groups.
8. The saved-preference summary chip stays hidden while the homepage shows `สถานที่แนะนำ`; it appears in the search card only after results load, where the page is `สถานที่สำหรับคุณ` or a dated trip result.
