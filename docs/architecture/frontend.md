# Frontend architecture

The Poolr frontend lives in `web/` as a separate React, TypeScript, and Vite application. It is intentionally isolated from the Express package so the backend's dependency graph and scripts remain untouched.

## Contract boundary

`web/src/api/` contains the HTTP integration boundary. The shared transport is implemented in `web/src/api/http.ts`, while the real API adapter implements the verified versioned contracts:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/me`
- `GET /v1/rides/search`
- `POST /v1/rides`
- `GET /v1/rides/:id`
- `GET /v1/me/rides`

API failures are parsed from the shared `{ error: { code, message, details, requestId } }` envelope. The access token is stored in `sessionStorage`, not durable browser storage, matching the current 60-minute, access-token-only backend model.

## Experience boundaries

The landing page uses clearly labelled sample route data. Authenticated search, create, get, and own-list views render backend responses. The route canvas projects supplied GeoJSON coordinates into an SVG visualization; it does not geocode, snap points to roads, or claim road-network walking distance.

Booking, payments, drop-off matching, chat, ratings, navigation, and live tracking are absent because no verified backend contracts exist for them. Search language states that pickup walking distance is straight-line geographic distance.

## Local development

Vite proxies versioned API and operational probe requests to `http://localhost:3000`. A deployed frontend can set `VITE_API_BASE_URL` when the API is served from another origin; that deployment must also provide an appropriate cross-origin policy.
