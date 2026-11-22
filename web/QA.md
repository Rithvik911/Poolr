# Frontend integration and visual QA

Last verified: 20 November 2026 (Asia/Calcutta)

## Automated checks

- Backend TypeScript test configuration: passed.
- Backend suite: 13 files and 139 tests passed.
- Web typecheck: passed.
- Web suite: 4 files and 15 tests passed.
- Web production build: passed.

The production build still reports a chunk-size warning for the lazy-loaded MapLibre engine and its worker. Route pages are split into separate chunks so they no longer inflate the initial route bundle, but MapLibre remains intentionally isolated and large.

## Live real-API checks

The Vite client was exercised against the local Express `/v1` API and MongoDB, with mocks disabled.

- Registration API: driver registration returned a user and access token; duplicate email returned `409 EMAIL_TAKEN`.
- Login: invalid credentials displayed the friendly error; valid credentials opened the protected app.
- Protected routes: signed-out access redirected to login; successful login returned to the original path, query, and hash.
- Search: pickup-first search returned a real ride and plotted its route on the schematic map.
- Ride details: real API data, route, seats, departure, price, and honest booking limitation rendered correctly.
- Create ride: a driver account published a sample route and navigated to the created ride.
- My Rides: the created ride appeared through the owner-scoped cursor endpoint.
- Mobile shell: navigation, theme control, and sign-out were usable at a 390 x 844 viewport.
- Desktop shell: the sidebar navigation and account controls were present at a 1440 x 900 viewport.
- Registration validation: native email validation and React/Zod name/password messages were visible and exposed as alerts; registration passwords use `new-password` autocomplete.
- Browser console: no warnings or errors were captured during the final pass.

## Accessibility and motion

- Visible focus styling, semantic headings, labelled controls, alert roles, status roles, map labels, and disabled states were inspected.
- The stylesheet includes a `prefers-reduced-motion: reduce` override that removes smooth scrolling and reduces animation and transition duration.
- MapLibre uses a labelled local schematic fallback when no external map style is configured, so the UI does not imply road routing.

## Product boundaries

- Live search is pickup-only because the current API has no drop-off matching contract.
- Booking, ride start, and ride cancellation remain unavailable in the live API. The client does not show pretend live actions; booking is available only in clearly labelled mock mode.
- The QA run created one local test driver and one scheduled test ride in the development database.
