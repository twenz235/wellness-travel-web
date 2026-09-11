# wellness-travel-web

Next.js + Ant Design UI for Wellness Travel MVP1. The browser stores preferences locally and sends search requests to the Go API; it never receives a Supabase service key.

## Run locally

```bash
npm install
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080 npm run dev -- --hostname 127.0.0.1
```

Start `wellness-travel-api` separately and set its `CORS_ORIGIN` to the web origin. Use `npm run build` for the production build check.

For Vercel, deploy this directory as the separate Next.js project `wellness-travel-web` and set `NEXT_PUBLIC_API_BASE=https://wt-api.flozy.app` in Production. The public Web URL is `https://wt.flozy.app`; API origin must not include a trailing slash.

The UI keeps the place coordinate caveat visible. Provider and dataset provenance remain in the API response and test evidence rather than on the detail screen. Flexible searches are historical Seasonal recommendations; explicit dates use the checked-in Open-Meteo/CAMS forecast snapshots and show incomplete coverage when a factor is unavailable. The app does not expose a Supabase service key.

Selecting any recommendation card opens `/places/<place-id>/detail`. The page sends the card's scoring context to `POST /v1/recommendations/detail`, shows Forecast or Seasonal details without a rank, and includes a MapLibre/OpenFreeMap map with the place reference point and the user's route when geolocation is available. It requests OSRM road geometry and distance; if routing is unavailable, it keeps the dashed straight-line fallback and labels the distance as approximate. The route ends at the park reference point, not a verified campsite.
