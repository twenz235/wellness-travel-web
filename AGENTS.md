<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Base44 sandbox setup

- **Stack**: Next.js 16 + Ant Design 6 + MapLibre GL, frontend-only. The Go API (`wellness-travel-api`) is a separate project not in this repo.
- **API proxy**: The production API at `https://wt-api.flozy.app` only sends `Access-Control-Allow-Origin` for `https://wt.flozy.app`. In the sandbox (`BASE44_PREVIEW_MODE=1`), `next.config.ts` adds `rewrites` to proxy `/v1/*` through the dev server so the browser makes same-origin requests. `NEXT_PUBLIC_API_BASE` is set to `/` so client fetch calls are relative.
- **No secrets required**: the API is public and unauthenticated. No `env_file` needed.
- **Run**: `docker compose -f docker-compose.base44.yml up -d --build`
- **Verify**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` returns 200 after the dev server compiles (~30–60s).
- **Tests**: `npm run build` (CI runs this on Node 24).
