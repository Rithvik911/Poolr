# Poolr web

The mobile-first React client for Poolr. The visual language follows one continuous route line between pickup and drop-off, with no fabricated ratings, testimonials, counts, or benchmark numbers.

## Run locally

Requirements: Node.js 20+ and the Poolr API running on port 3000.

```powershell
cd web
npm install
npm run dev
```

Vite proxies `/v1` requests to `http://localhost:3000` by default, so the backend does not need a CORS change for normal local development.

There is no prefilled login and this frontend does not create a seeded account. Register with your own email first, or use an account that already exists in your local MongoDB database.

## Configuration

Copy `.env.example` to `.env.local` and change only what you need:

- `VITE_API_BASE_URL`: API origin. Leave blank for the development proxy.
- `VITE_API_PREFIX`: version prefix, currently `/v1`.
- `VITE_DEV_API_TARGET`: Vite proxy target, default `http://localhost:3000`.
- `VITE_USE_MOCKS`: `true` enables clearly labelled demo search, booking, and related data. Existing auth and ride endpoints remain real.
- `VITE_MAP_STYLE_URL`: a MapLibre-compatible style URL supplied by the deployer.
- `VITE_MAP_ATTRIBUTION`: attribution for that configured map style.

No public OpenStreetMap tile endpoint is hard-coded. Without a map style URL, Poolr renders an honest local schematic canvas; it is interactive but deliberately not presented as a road basemap.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The exact backend contracts and unresolved product questions are recorded in [DECISIONS.md](./DECISIONS.md).
The latest hands-on integration and visual QA results are recorded in [QA.md](./QA.md).

## Real and demo boundaries

The live client uses the real API for registration, login, current user, create ride, ride detail, pickup-first ride search, and the driver's ride list. Booking and full pickup-to-drop-off matching do not exist in the API yet. Their demo adapter follows the planned contracts and every screen carrying demo data shows a `Demo data` badge.

Access tokens are kept in memory and mirrored to `sessionStorage` only as a tab-session fallback. Any `401` clears both copies. Tokens are never written to `localStorage`.

## Benchmarks

The under-the-hood page reads only `public/bench/manifest.json`. See [public/bench/README.md](./public/bench/README.md) for the accepted shape. If the file is absent, the page says that there are no results yet.
