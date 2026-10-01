# Browser admin release record

Backend implementation branch: `sburdenko/browser-admin`.
Client repository: `369labz-dev/Orbs-Admin`.

## Delivered

The browser client lives in the public `369labz-dev/Orbs-Admin` repository.
Unity and backend remain in the private `369labz-dev/Orbs-MVP` repository.
It includes email/password login and password reset, organizer access, event-assigned
redemption staff, event creation/copy, launch readiness, lifecycle controls, map and
zone editing, inventory, settings, activity monitoring, code fulfillment, staff
assignment, reports and paginated CSV exports.

MapLibre uses the existing Mapbox raster map provider. Mutations and authorization
remain owned by the Firebase backend. The Unity callable request fields remain
compatible. Server-enforced staff permissions do not depend on hiding UI routes.

## Verification on 2026-10-01

- Backend build and browser production build passed.
- Backend: 144 tests passed across 15 files, including existing contention,
  claim, redemption and security checks and new portal contracts.
- Chromium: five browser acceptance tests passed: organizer lifecycle/stock/export,
  mobile staff fulfillment, player denial, CSV escaping and map placement/move/zone save.
- The map was also visually inspected after the acceptance run.
- Live unauthenticated `adminCallable` request returned HTTP 401 with
  `UNAUTHENTICATED`.

Real organizer password login, Firefox, Safari/iOS, Edge manual checks and the
300-position staging load scenario have not been verified in this release session.
The browser tests use Firebase emulators rather than modifying live game data.

## Production backend

Project: `orbs-369labz`; region: `europe-west3`.

`adminCallable`, `deleteOrbCallable`, `reportPositionCallable`,
`completeClaimCallable` and `orbLifecycle` were deployed and verified `ACTIVE`.
The existing lifecycle Cloud Scheduler job remains `ENABLED` with its OIDC target.
The organizer UID allowlist was retained.

All nine committed composite indexes were deployed and verified `READY`.
The reviewed metadata migration applied 144 document updates with no unresolved
prize snapshots. It does not alter event state, inventory, scores or geometry.
The Firebase Web App was registered and `369labz-dev.github.io` added to Auth
authorized domains. Public SDK configuration is held in the repository variable
`FIREBASE_WEB_CONFIG`; the existing `MAPBOX_TOKEN` secret supplies the map build.

## Hosting

The user approved a separate public client repository after GitHub rejected Pages
activation for the private repository's Free plan. Source and compiled browser assets
are hosted in `369labz-dev/Orbs-Admin`; the backend remains private.
The public client has its own API types, Pages workflow and `/Orbs-Admin/` base path.
The site address is https://369labz-dev.github.io/Orbs-Admin/.
