# wellness-travel-web

Next.js + Ant Design UI for Wellness Travel MVP1. The browser stores preferences locally and sends search requests to the Go API; it never receives a Supabase service key.

## Run locally

```bash
npm install
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080 npm run dev -- --hostname 127.0.0.1
```

Start `wellness-travel-api` separately and set its `CORS_ORIGIN` to the web origin. Use `npm run build` for the production build check.

For Vercel, deploy this directory as a separate Next.js project and set `NEXT_PUBLIC_API_BASE` to the deployed API origin (for example, `https://wellness-travel-api-<team>.vercel.app`). The API origin must not include a trailing slash.

The UI keeps provider, dataset, and coordinate provenance visible. Flexible searches are historical Seasonal recommendations; explicit dates use the checked-in Open-Meteo/CAMS forecast snapshots and show incomplete coverage when a factor is unavailable. The app does not expose a Supabase service key.
