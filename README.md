# Orbs Admin

Browser organizer and redemption portal for Orbs.

- Application: https://369labz-dev.github.io/Orbs-Admin/
- Backend and Unity client: private `369labz-dev/Orbs-MVP` repository.
- [Implementation specification](docs/browser-admin-spec.md).
- [Release record](docs/browser-admin-release.md).

## Development

Use Node 22. Run `npm ci`, copy `.env.example` to `.env.local`, supply the public
Firebase Web App configuration and a browser-capable Mapbox token, then `npm run dev`.
The client uses Firebase email/password accounts and existing functions in
`europe-west3`. Organizer access and event-scoped staff access are checked server-side.

`src/lib/model.ts` and `adminContract.ts` describe the public client API. Update them
when the backend API changes. They contain types only; the client has no dependency
on a local backend checkout or server implementation.

## Acceptance tests

The Playwright tests use the actual backend in Firebase emulators. They require
access to the private backend repository. From its `backend/` directory, run
`npm ci` and `npm run build`, then start emulators with `ORBS_ADMIN_UIDS=browser-organizer`
and `npm run emulators`. Use Auth 9099, Firestore 8080, Database 9000 and Functions 5001.

In this repository, run `npx playwright install chromium` and `npm run test:e2e` with
`VITE_USE_EMULATORS=true`, `VITE_FIREBASE_API_KEY=fake-api-key`,
`VITE_FIREBASE_AUTH_DOMAIN=localhost`, `VITE_FIREBASE_PROJECT_ID=orbs-dev`,
`VITE_FIREBASE_APP_ID=emulator-admin` and
`VITE_FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=orbs-dev`.
Tests seed dedicated accounts and event fixtures and clear emulator data.
Do not point acceptance tests at production.

## Release

Pull requests typecheck and build without production credentials. Main pushes and
manual dispatch publish Pages through `.github/workflows/pages.yml`. The workflow
builds with repository variable `FIREBASE_WEB_CONFIG` (Firebase SDK JSON) and secret
`MAPBOX_TOKEN`, then uploads only `dist/`. Production deployments use `/Orbs-Admin/`
and hash routes so refresh and direct links work. Source maps are disabled.

Firebase web configuration and the browser map token are visible in the compiled
application. Never add service account keys, administrator credentials, deployment
credentials or organizer UID lists to this public repository.

Backend deployments and migrations belong to the private backend repository.
