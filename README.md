# Orbs browser admin

React browser client for the existing Firebase backend. See
[implementation specification](../Docs/browser-admin-spec.md) for roles and event behavior.

## Local development

Use Node 22. Install dependencies with `npm ci` in `admin/` and `backend/`.
Copy `.env.example` to `.env.local` and supply the registered Firebase Web App config
and a browser-capable Mapbox token. These are public browser configuration values.
Set `VITE_USE_EMULATORS=true` for local Auth, Firestore and Functions (ports 9099,
8080 and 5001). Run backend `npm run build` and `npm run emulators`, then admin
`npm run dev`. Set `ORBS_ADMIN_UIDS` on the backend for organizer accounts.

Accounts use Firebase email/password auth. Organizers are allowlisted server-side.
Create staff accounts in Firebase Auth, then assign event access from Staff.

## Release

Run `npm run build` and backend tests, then browser acceptance tests against emulators.
Before the first release run `npx tsx tools/admin-migrate.ts` in `backend/` for a dry run;
add `--apply` to apply reviewed metadata, prize-snapshot and audit-category changes.
The tool does not alter event state, inventory, scores or geometry.

Deploy backend functions and committed Firestore indexes before publishing the client.
Configure repository variable `FIREBASE_WEB_CONFIG` with Firebase SDK JSON and existing
secret `MAPBOX_TOKEN`. Enable Settings → Pages → GitHub Actions. The Pages workflow
publishes only `admin/dist` on main; hash routes support direct links and refresh.

The repository is private: the organization needs an eligible Pages plan. Publication
must not make the repository public. Expected URL: https://369labz-dev.github.io/Orbs-MVP/.

CSV exports include all pages, use UTC timestamps, and omit code strings and contacts.
A report can change after end as issued prizes are redeemed.
