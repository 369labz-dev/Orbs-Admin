# Orbs browser admin — implementation specification

Status: implemented; dedicated public client repository approved on 2026-10-01.
Date: 2026-10-01.

The organizer can prepare, run and review an activation from a browser. A redemption
staff member can validate and redeem prizes for assigned events from a phone. Both
use the existing Firebase backend and the same accounts and event data as Unity.

The agreed additions are event creation and copying, a launch readiness check,
separate organizer and redemption roles, an audit trail, event reports and CSV exports.
This document defines the complete first release, including backend work. Sections
marked "existing" describe inspected code; all other requirements describe the target.

## 1. Delivery decisions

| Area | Decision |
|---|---|
| Repository | Public web client in `369labz-dev/Orbs-Admin`; backend and Unity remain private in `369labz-dev/Orbs-MVP` |
| Web stack | React, TypeScript in strict mode, Vite |
| Routing | React Router with hash routes, to support refresh and direct links on Pages |
| UI | Plain CSS and Radix UI primitives for dialogs, tabs and accessible controls |
| Forms | React Hook Form; authoritative validation remains in backend handlers |
| Server data | Firebase Web SDK; TanStack Query for administrative callable queries |
| Map | MapLibre GL JS with Terra Draw for one editable polygon |
| Map tiles | Existing Mapbox Streets raster tiles; existing repository map credential |
| Geometry display | Turf modules for area and an approximate inset preview |
| Authentication | Existing Firebase email/password accounts |
| Authority | Existing Cloud Functions, Firestore and Realtime Database |
| Hosting | GitHub Pages, deployed through a separate GitHub Actions workflow |
| Region | Existing `europe-west3`; explicit web Functions region configuration |
| Language | English for all UI, source, messages and documentation |
| Testing | Existing backend Vitest/emulator tests; browser acceptance with Playwright |

Choose supported stable package releases at implementation time and commit the lockfile.
Do not add Next.js, a separate API server, a new database, Redux or a service worker.
The browser reuses the project's existing Mapbox tile account; no additional map provider account is required.

Expected Pages address: `https://369labz-dev.github.io/Orbs-Admin/`.
Use Vite `base: '/Orbs-Admin/'` and URLs such as `#/events/<eventId>/map`.
If a custom domain is configured, switch the build base to `/`.

The client repository is public by explicit user approval. The Unity/backend repository
remains private. GitHub Pages publishes the compiled client from the public repository;
Firebase authenticates every administrative operation independently of site visibility.

## 2. Existing implementation and required changes

| Capability | Existing implementation | Work for this release |
|---|---|---|
| Organizer role | `ORBS_ADMIN_UIDS`, checked in `adminAccess.ts` | Preserve allowlist; add event-scoped redemption membership |
| Commands | `adminCallable` dispatches actions in `eventAdmin.ts` | Add lifecycle/read/report/staff actions and per-action authorization |
| Event configuration | Name, timing, points, unlock and spawn settings | Web forms, complete validation and edit-state policy |
| Event lifecycle | Waiting, active, paused, ended | Readiness-gated start; creation and configuration copying |
| Zone | `saveZone`, simple polygon validation, placement checks | Drawing UI; check buffer edits against existing live Orbs |
| Orbs | Save, move, reactivate; separate delete callable | Web editing; reserve inventory for new manual reward Orbs |
| Inventory | `saveInventory` writes prize and absolute remaining quantity | Transactional adjustment, listing, audit and concurrent stock protection |
| Codes | Transactional check and redemption | Staff access, confirmation UI, immutable reward details |
| Overview | `summary` counts codes and recent validated positions | Claim totals including points-only wins; paged activity and reports |
| Live data | Firestore event/Orb/leaderboard listeners | Reuse existing readable game data; privileged data via callables |
| Journal | Event log documents; reads denied by rules | Organizer-only paginated query; atomic administrative audit writes |
| Hosting | No confirmed configured Pages site | Web build, Pages configuration and deploy workflow |

Relevant code: `backend/functions/src/eventAdmin.ts`, `adminAccess.ts`, `orbAdmin.ts`,
`orbSpawning.ts`, `orbLifecycle.ts`, `claimService.ts`, `model.ts`, `index.ts`,
`backend/firestore.rules` and `backend/database.rules.json`.

Older notes in `Docs/admin-screen.md` are not the authority for current pause behavior:
the inspected claim handlers reject completion while an event is paused. The web UI
must describe and preserve the behavior defined in section 7.

## 3. Ownership and repository layout

```text
Orbs-Admin/                 public client repository
  package.json
  package-lock.json
  vite.config.ts
  index.html
  .env.example
  src/features/            event screens
  src/lib/                 Firebase client and public API types
  tests/                   browser acceptance flows
  docs/                    client specification and release record
  .github/workflows/       checks.yml and pages.yml
Orbs-MVP/backend/          private server repository
  functions/src/           authorization, event handlers and reports
  test/                    backend emulator contracts
```

Backend owns permission checks, inventory reservation, code issuance/redemption,
event transitions, launch checks, valid placement, timestamps and reports. Existing
spawning and lifecycle components continue to own spawning and scheduling. React
owns draft forms, editing gestures, presentation and explicit requests.

Backend request/response types remain in `backend/functions/src/adminContract.ts`.
The standalone client maintains matching public types in `src/lib/adminContract.ts`
and `model.ts`. These contain no Admin SDK imports. Runtime server code must not enter the bundle.
Use a discriminated action union for new calls. Keep the existing Unity payload and
response fields compatible, including `access: { ok, isAdmin }`.

No root workspace conversion or unrelated Unity refactoring is required. The Unity
admin remains available and uses the same server policy; adapt only UI fields or
messages whose semantics necessarily change with inventory and launch checks.

## 4. Roles, accounts and access

### 4.1 Permission model

An organizer is a Firebase UID in the existing server `ORBS_ADMIN_UIDS` allowlist.
Organizers can manage every event in this Firebase project. This release does not
introduce separate organizations or event ownership isolation.

A redemption staff member is an existing Firebase account with one or more event
assignments in a server-managed document:

```text
adminAccess/{uid}
  role: "redemption"
  eventIds: string[]
  updatedAt: number
  updatedBy: string
```

Client reads and writes of this collection remain denied. Organizers manage event
assignments through callables. Resolve entered account email to UID on the server;
store identity by UID, not email. Also accept a UID explicitly. List staff through an
`eventIds array-contains eventId` query. Removing the final assignment deletes the
document. Organizer privileges take precedence over a staff document.

| Action | Organizer | Assigned redemption staff | Player / no assignment |
|---|---|---|---|
| List admin events | All events | Assigned events, minimal metadata | Denied |
| Create/copy event | Yes | No | No |
| Edit zone, Orbs, settings, stock | Yes | No | No |
| Start/pause/resume/end | Yes | No | No |
| Monitor, journal, reports, export | Yes | No | No |
| Add/remove redemption staff | Yes | No | No |
| Check/redeem code | Yes | Assigned event only | No |

The server checks the authenticated UID and current membership on every privileged
request. Revocation takes effect on the next request without a token refresh.
Never accept a caller-provided role, actor UID or list of allowed events.
The existing `deleteOrbCallable`, `moveOrbCallable` and `spawnTestOrbCallable` must
continue to require organizer privileges; staff must not acquire them indirectly.

Existing rules allow authenticated accounts to read game event, Orb and leaderboard
documents and published `visiblePositions`. That player visibility is preserved.
This role model limits administrative access, not access to already public game data.
Private inventory, logs, unrestricted code lists and validated positions stay behind
authorized callables. Do not put staff emails, access lists or secrets in event docs.

### 4.2 Login and provisioning

Routes: `#/login`, `#/events`, and event routes in section 5. Login provides email,
password, password visibility, "Remember me", sign in and "Forgot password".
Use Firebase session persistence by default and local persistence only when selected.
There is no anonymous admin session and no self-assignment of roles.

After sign-in, call `access`. Organizer goes to Events; staff goes to assigned Events
or directly to Redeem when only one assignment exists. An account without admin access
sees "This account has no admin access" and a sign-out action.

Use existing accounts. For a new staff user, an operator creates an email/password
account in Firebase Auth and the organizer assigns its UID/email in Staff. Password
reset uses Firebase's existing flow. The app does not generate passwords, send custom
invitations or manage organizer allowlist membership.

On sign-out, access denial or event change, dispose subscriptions, cancel requests,
clear private cached data and clear checked-code state. On a revoked staff request,
return to permitted events with a clear access message. A stale response from a previous
event must not populate the currently selected event.

## 5. Navigation and interaction

| Route after `#/` | Screen |
|---|---|
| `events` | Event list and creation/copy actions |
| `events/:eventId/map` | Map and Orb/zone editing |
| `events/:eventId/settings` | Event, scoring, unlock and spawn configuration |
| `events/:eventId/inventory` | Stock management |
| `events/:eventId/monitor` | Claims, winners, leaderboard and activity |
| `events/:eventId/redeem` | Check and redeem code |
| `events/:eventId/staff` | Redemption access assignments |
| `events/:eventId/report` | Event report and CSV exports |

Desktop layout: event selector/navigation, event state and remaining time in a persistent
header; map fills the workspace; selection/edit form in a right panel. Map tools are
"Place Orb", "Draw zone", "Fit zone" and "Orb list". Start/resume, pause and end are
separate labeled controls. Editing cannot happen through an unlabeled marker gesture.

At narrow widths use a compact header, navigation menu and bottom sheet for map forms.
Redeem is a simple single-column screen with a large input and action buttons, usable
at 360 CSS px. Full map editing targets a tablet/desktop at least 768 px wide; on smaller
screens the map is view-only with a message to use a larger screen for geometry editing.
Inventory, settings, reports and code redemption remain usable on a phone.

All forms have labels, inline field errors and explicit Save/Cancel. Server rejections
appear next to the action and preserve the draft. Loading, empty, denied and failed
states are distinct. Disable repeat submissions while a request is pending; do not
automatically retry mutations. Use confirmation dialogs for ending an event, deleting
an Orb and redeeming a prize. Discarding an unsaved draft on navigation requires confirmation.

Dialogs are keyboard accessible, restore focus and use English labels. Status is
communicated by text as well as color. Prize and player strings render as text, never
HTML. No browser toast is the sole record of a redemption outcome.

## 6. Event creation, copying and readiness

Events list: name, ID, state, created date, started/ended date when present; state
filter and loaded-name/ID search. Default ordering: `createdAt desc, document ID desc`.
Paginate 50 records. Legacy events without `createdAt` are backfilled before this query
ships; see section 15. Staff receives only assigned event IDs/names/states.

Create requires a name (1–120 trimmed characters). Generate a stable event UUID in the
client for retrying creation and store the event in `waiting`. No zone is drawn yet,
no Orbs/codes are created, no spawn job runs. Defaults below are editable starting
values, not claims about tuned gameplay.

| Group | Initial values |
|---|---|
| Event | 60 minutes; warnings at 5 and 1 minutes remaining; GPS buffer 15 m |
| Unlock | Attempt window 25 s; hold 3 s; frame fraction 0.18; recovery 0.75 s |
| Points | Common, Rare, Legendary, first arrival and consolation all 0 |
| Spawning | Disabled; max live 8; total claims 100; expected players 50 |
| Composition | Reward fraction 0.5; rare frequency 0.2; legendary frequency 0.05 |
| Lifetimes | Common 600 s; Rare 900 s; Legendary 1200 s; relocation delay 30 s |
| Radii | Entry 12 m; exit 18 m; search area 35 m |

Copy requires a source event and a new name/UUID. Copy only configuration: zone, buffer,
duration, warnings, scoring, unlock and spawning; copied spawning is disabled until
explicitly enabled. Do not copy Orbs, codes, stock quantities, staff, timestamps,
leaderboard or logs. The new event starts waiting. Source inventory is never depleted
or replenished by copying. An ended event is valid as a configuration source.

Readiness runs on demand and again inside the start transaction. It returns
`{canStart, blockers[], warnings[], checkedAt}` with stable machine codes and English
messages. Only the transaction result authorizes starting; a green earlier check is
not a permit to bypass validation.

Blockers:

- Event is not waiting, required configuration is absent/invalid, or zone is invalid.
- Any available/locked Orb is outside the zone's allowed interior under the current buffer.
- Manual-only mode has no available, unexpired Orbs.
- Automatic mode has no usable interior for placement. Use a deterministic inset-area
  check in the server geometry component; do not infer this from one random spawn sample.
- With automatic spawning enabled, `maxLive > totalClaims` or the configured lifetimes
  and warnings exceed the event duration.

Warnings requiring explicit acknowledgement at start:

- Points are all zero.
- Target reward fraction is positive but free stock is zero or below the estimated reward target.
- A legacy reward Orb has no tracked inventory item.
- Existing available Orbs expire before the planned end; show earliest expiry.

Stock shortage is a warning because the existing spawner deliberately continues with
points-only Orbs when stock is exhausted. The UI must never promise a guaranteed reward
ratio. For manual-only mode, spawn-specific warnings are omitted.

The start request carries `acknowledgeWarnings: true` after displaying the latest warnings.
Server returns current blockers/warnings if acknowledgement is missing. Resume checks
state and cutoff, not first-launch readiness, because events legitimately exhaust stock.

## 7. Lifecycle and configuration semantics

| Current state | Permitted transition | Effect |
|---|---|---|
| Waiting | Start → active | Set `startedAt = now`, `endsAt = now + durationMinutes * 60000` |
| Active | Pause → paused | Reject new attempts and attempt completions; stop spawning/relocation |
| Paused | Resume → active | Resume if server time is before `endsAt` |
| Waiting / active / paused | End → ended | Set `endedAt`; disable further game mutations |
| Ended | None | Keep results and redemption available; create/copy another event |

Pause does not stop the event clock, Orb lifetimes or attempt expiry. A paused player
cannot complete an attempt; resumption only permits one that is still valid. The UI
states this in the pause confirmation. It must not claim that attempts finish during
pause. No grace period exists at the cutoff. Claim handlers already check `endsAt`;
the scheduler may materialize `ended` later. The UI disables game actions once the
server-calibrated cutoff is reached, and backend performs the same check.

Event name can be edited before end. Gameplay settings, duration and GPS buffer can be
edited in waiting/paused states; require Pause first during active. Ended configuration
is read-only. Ending is irreversible and confirmation displays the selected event name.
Inventory replenishment and staff assignment remain available after end for fulfillment;
they do not create new claims or reopen the event.

Changing duration after start adjusts `endsAt` by the duration difference, preserving
the original start time. Reject a duration that would place cutoff at/before server now;
use End for an immediate cutoff. Warning times must fit within duration. New unlock
settings apply only to newly created attempts. Existing attempts retain their captured
settings. New spawn tier/lifetime/radius settings apply to new Orbs; existing Orbs retain
their fields and lifetime. No global rewrite of live Orbs on settings Save.

Saving buffer/zone must check all available/locked Orbs against the proposed geometry
in the same transaction. Reject excluded Orbs and return their IDs; never silently
move/delete them. Existing multisided rings can be displayed, but this release's editor
creates one simple ring. Existing multi-ring events are view-only for zone editing,
with an explicit message; do not replace several rings with one implicitly.

### 7.1 Field validation

Use the existing limits unless explicitly refined below. Show user-facing tier
"Legendary" while retaining stored `type: "epic"` and `scoring.epic` for Unity compatibility.

| Field | Required range / relation |
|---|---|
| GPS buffer | 0–100 m |
| Duration | Integer 1–1440 minutes |
| Warnings | `0 <= last <= first < duration`; 0 disables that warning |
| Attempt window | 5–120 s |
| Hold duration | 0.5 s through `attempt window - 1 s` |
| Frame fraction | 0.05–0.45; display as 5–45% |
| Recovery | 0–5 s |
| Each points value | Integer 0–1,000,000 |
| Maximum live Orbs | Integer 1–100 |
| Total claims | Integer 1–100,000; at least max live when automatic mode is enabled |
| Expected players | Integer 1–10,000; planning input, not measured attendance |
| Reward fraction | 0–1; display as a percentage |
| Rare / Legendary frequency | Each >= 0; sum <= 1; Common is the remainder |
| Common lifetime | 60–86400 s |
| Rare lifetime | Common lifetime through 86400 s |
| Legendary lifetime | Rare lifetime through 86400 s |
| Relocation delay | 0–3600 s |
| Entry radius | 1–200 m |
| Exit radius | At least entry + 1 m, at most 300 m |
| Search area radius | 1–300 m |
| Manual Orb radius / lifetime | 1–200 m / 1–10080 minutes |
| Stock remaining | Integer 0–100,000 |
| Prize text | 1–200 trimmed characters |
| Zone | One simple ring, 3–100 distinct corners, nonzero area, no self intersection |
| Map coordinates | Latitude -85..85; longitude -180..180 |

## 8. Map, zone and Orbs

Draw the zone, translucent inside buffer preview, precise admin Orb markers and
server-validated recent player positions. Admin sees precise coordinates; player map
behavior stays unchanged. Show attribution for the map provider. Tile load failure
shows a visible error; the remaining forms, Orb list and Redeem still work.

Zone workflow: Draw zone → place corners → finish polygon → review area and buffer →
Save or Cancel. Editing an existing ring allows moving/adding/removing corners.
Closing the polygon in GeoJSON repeats the first coordinate; remove that repeated
coordinate when serializing to existing `geofence: [{points: [{lat,lng}]}]`.
GeoJSON positions are `[lng, lat]`. Turf preview is indicative; server `geo.ts` decides
legal placement. No holes, overlapping regions, import wizard or automatic road exclusion.

Orb workflow: Place Orb → map click creates a local draft → select tier and reward kind,
inventory item if reward, radius and lifetime → Save. Cancel writes nothing. The stable
draft UUID becomes `orbId`; server creation retry returns the original Orb without
another stock reservation or code. Reward contents are hidden from players;
`prizeVisible` is submitted as false and has no web toggle.

Click a marker/list row to show ID, tier, reward kind, prize, status, source (manual/auto),
coordinates, expiry and inventory link. Actions:

- Properties edits only tier, reward selection, radius and lifetime. Keep coordinates
  and elapsed lifetime. Changing lifetime adjusts the existing deadline by the difference.
- Move starts an explicit placement draft, then Save changes location only.
- Activate is explicit for expired Orbs and restarts lifetime from server now.
- Delete confirms name/ID, then removes only unclaimed/unissued Orbs and associated free codes.
- Claimed Orbs are read-only and cannot be deleted; their reward must remain redeemable.

Server refuses edit/move/reactivation/delete during a valid active attempt. Surface the
existing `ORB_LOCKED` rejection and leave the draft available for a later manual retry.
Do not infer attempt permission from a marker's legacy `locked` status alone: current
attempts can be concurrent and leave the Orb status available.

Filters: tier, status, reward kind and manual/auto; ID/prize search over loaded event
Orbs. Expired/claimed markers are visually distinct and can be hidden. Use a GeoJSON
source/layers for positions and markers rather than one React DOM tree per player.
Test-only distance spawn/move actions are not part of the public web admin release.

## 9. Spawn settings and planning preview

Reuse `replenishOrbs`, `chooseSpawnPosition` and the one-minute lifecycle scheduler.
Do not create a browser timer that spawns Orbs or a second spawning function.

Current server behavior:

```text
C = count of claimed Orbs
P = count of nonclaimed auto Orbs (including expired awaiting relocation)
    + available/locked manual Orbs not already counted above
new capacity = max(0, min(maxLive - P, totalClaims - C - P))
```

For each capacity slot, choose a legal point inside the buffered zone, choose a tier
by configured probability, then attempt a reward by `rewardFraction`. Reward selection
uses the first stocked item from the inventory query, not weighted/random prize choice.
If no stock is available the Orb is points-only. Reserve stock and create Orb/code in
the same event transaction. Relocation reuses the Orb and reservation, prefers positions
away from the previous position, and does not issue a new reward/code.

`expectedPlayers` currently does not enter this algorithm. Duration controls the cutoff,
not a spawn cadence formula. This release makes those facts visible and provides a
planning preview, without inventing a new automatic formula:

```text
planned claims per expected player = totalClaims / expectedPlayers
target claims per minute = totalClaims / durationMinutes
estimated reward demand = ceil(totalClaims * rewardFraction)
free stock = sum(inventory.remaining)
additional target stock = max(0, estimated reward demand - free stock)
```

When displaying demand for an event with existing Orbs, including before start, use
`ceil(max(0, totalClaims - claimedCount - pendingCount) * rewardFraction)`;
pending rewards are already reserved and must not be charged against free stock twice.
All outputs are estimates: attendance, chance and player behavior affect actual results.
Changing expected player count updates the preview, not max live/total claims silently.

Warn when expected density or lifetime makes the plan questionable; use numeric
claims/player and claims/minute rather than an unvalidated "good/bad" recommendation.
The scheduler can take about a minute plus execution time to fill a vacancy or relocate;
do not advertise exact-second scheduling. Paused/ended events do not replenish.
Manual Orbs participate in the same capacity/claim limit.

## 10. Inventory and reward consistency

Inventory screen columns: prize, available stock, reserved/unclaimed count, issued count,
redeemed count; stable item ID available in details. Create an item with prize and starting
available stock. Edit available stock and prize with explicit Save. No stock deletion,
payment tracking or supplier management is included.

`remaining` means units not currently reserved, not purchased total. Each newly created
reward Orb reserves one unit. Claiming converts that reservation into an issued reward
without decrementing stock again. Redemption changes code status without touching stock.
Relocation preserves reservation. Deleting an unclaimed reward Orb or converting it to
points restores one unit. Changing its inventory item releases the old reservation and
reserves the new one atomically. Reject empty stock; do not let manual creation bypass it.
Points-only Orbs have no inventory reservation or prize code.

Copy prize text into the Orb and into an issued code. Renaming an inventory item affects
future reservations, not existing Orbs or issued prizes. An issued code's prize is the
redemption authority; use its stored snapshot first, and legacy Orb prize only if missing.
Staff should see the exact prize owed even if inventory names later change.

To prevent a stock edit overwriting a concurrent scheduler reservation, `saveInventory`
must read the item inside a transaction. New web requests carry `expectedRemaining`;
reject a changed value with `INVENTORY_CHANGED` and the current item. Audit the stock delta.
Creation uses a stable item UUID and fails on an existing item. For compatibility,
legacy Unity absolute edits can only save in waiting/paused states; active/ended absolute
edits without `expectedRemaining` are rejected. Update Unity's payload at the existing
inventory request boundary if active stock edits are needed there.

New manual reward saves require `inventoryId`. Existing legacy reward Orbs without a
link remain editable with their current free-text prize and are labeled "Untracked stock";
they must not decrement guessed inventory during migration. A deliberate conversion to
a tracked reward reserves a unit. Reports show an untracked group separately.

After end, unclaimed reservations remain visible; unused prizes are not automatically
returned or copied to another event. No reopening or automatic cross-event stock transfer.

## 11. Monitoring, report definitions and CSV

Monitor has overview cards, current Orb status counts, claim list, leaderboard and
activity journal. Updates must show freshness and never imply that active players are
all registered participants.

| Metric | Definition / source |
|---|---|
| Active players | Validated RTDB positions with `0 <= serverNow - ts < 30000` |
| Participants observed | Distinct UIDs reporting a validated position during the event |
| Claims | Count of Orbs with `status == claimed`, including points-only Orbs |
| Winners | Distinct `claimedBy` UIDs among those Orbs |
| Issued rewards | Codes with non-null `assignedTo` |
| Redeemed rewards | Issued codes with `used == true` |
| Outstanding rewards | Issued minus redeemed |
| Points awarded | Sum of event leaderboard points, including arrivals and consolation |
| Event stock | Available plus reserved; issued/redeemed shown separately, not double-counted |

Maintain `events/{eventId}/participants/{uid}` on the server after an accepted position
report while the event is active/paused, has started and is before its cutoff. Read the
event and create the participant in a transaction so a report after End cannot add
attendance. Create only on the first report (one document per player/event, not one write
every 5 seconds). Store UID and first-observed server timestamp. No contact info or
coordinate history. This gives an explicit participant denominator; leaderboard rows
alone are not attendance. Set `participantCaptureStartedAt` on first Start under the
new backend. An event started before this capture was available shows "Not recorded"
for full-session attendance; do not display a partial count as complete attendance.

Claims list: claimed time, Orb ID, tier, winner UID/display name, reward kind, awarded
points, prize and redemption state when applicable. Sort `claimedAt desc, ID desc`;
filter tier/reward kind. No free/unassigned codes are returned to monitoring views.

Leaderboard uses event points and displays rank, name, points, wins, first arrivals and
consolations. Equal points share rank; deterministic row ordering by UID does not imply
a tie-breaking prize. Missing legacy counters show 0. Top three receive no extra prize.

Journal: time, actor UID/name when known, action and concise details; filter action
category and actor UID. Successful organizer/staff mutations are audited atomically
with their data changes: event create/copy/settings/state, zone, Orb save/move/activate/delete,
inventory adjustment, staff assignment/removal and redemption. Use the existing `log`
collection with `{ts, playerId, type, payload}`; avoid another audit storage service.
Payload contains affected entity IDs and relevant before/after changed fields, not
passwords, player contacts or complete code pools. Legacy `codeId` can equal the actual
code string: redact that field from query results and CSV details; use the associated
Orb ID as the displayed redemption entity. A server transition records a system
actor. Refused operations are not presented as successful audit entries.

Do not count `claim_won` log rows as claims: current callable retries can write another
success log. Orb and code state is the source of truth. Administrative audit for a retry
must not create another logical create/redemption entry. Existing queryable journal logs
may contain legacy duplicates and should remain labeled as activity rather than totals.

Report works during and after an event. Show configuration, start/end timestamps,
metrics above, per-tier wins, per-prize available/reserved/issued/redeemed/outstanding,
leaderboard and a generated timestamp. Ending freezes game activity, but later redemption
updates fulfillment totals. Label game results final and redemption "as of" the report
timestamp. Existing asynchronous consolation processing may briefly update points after
end; refresh displays the current persisted result and does not promise immutable scores
before processing has finished.

For Unity compatibility, existing `summary.winners` keeps its current meaning (unique
recipients of issued reward codes). The web card and report use the new
`uniqueClaimWinners` field for all winners, including points-only wins. Do not change
the old field's meaning silently.

Provide separate UTF-8 CSV downloads:

| File | Fixed columns |
|---|---|
| `event-<id>-summary.csv` | event_id, event_name, state, started_at_utc, ended_at_utc, generated_at_utc, participants_observed, claims, winners, points_awarded, issued_rewards, redeemed_rewards, outstanding_rewards |
| `event-<id>-claims.csv` | event_id, orb_id, claimed_at_utc, tier, winner_uid, winner_name, reward_kind, points_awarded, prize, redeemed, redeemed_at_utc |
| `event-<id>-leaderboard.csv` | event_id, rank, player_uid, player_name, points, wins, first_arrivals, consolations |
| `event-<id>-inventory.csv` | event_id, inventory_id, prize, available, reserved, issued, redeemed, outstanding |
| `event-<id>-audit.csv` | event_id, entry_id, timestamp_utc, actor_uid, action, entity_id, details_json |

Exports cover all matching pages, not just visible rows. Apply screen filters to claims/
audit exports and include filters in the report screen. Use ISO 8601 UTC timestamps,
RFC 4180 quoting and a UTF-8 BOM for spreadsheet compatibility. Escape spreadsheet
formula prefixes in user-supplied text. No contact details, full GPS history or redeemable
code strings in CSV. Render browser times in local timezone with its label; numeric units
are explicit. Use server-authenticated data queries and browser download blobs; no stored
public report URLs or email distribution.

Each report response includes `asOf`; paged exports use it as an upper timestamp bound.
Rows modified during an active export, particularly late redemption, can differ between
pages: label exports generated from current persisted data, not an atomic database snapshot.
Cancellation aborts pending downloads. Failed exports show an error and do not download a
partial file as though it were complete.

## 12. Redemption

Select permitted event → enter/paste code → Check code → display event, exact prize and
status → Redeem prize → confirm physical handover → display "Redeemed" with timestamp.
Input normalizes trim and uppercase on the server, matching current behavior.

Keep Check and Redeem separate. Checked details are tied to code, event and authenticated
user. Changing any of those clears the check. Redemption is not optimistic and is never
queued offline. On success, preserve the receipt until "Check another code"; do not leave
an enabled second Redeem button. On an ambiguous network failure, require checking again.

Unknown, unissued, duplicate and already-used codes have distinct messages. An already
used code shows its prize and used time, and no handover action. Two staff checking the
same code can both see it initially valid; their concurrent redemptions yield exactly one
successful transaction. A second request cannot issue a second successful receipt.
Redemption is allowed after the event ends. Permission is checked for the selected event
before code lookup; staff cannot use another event ID in a direct request.

QR scanning is not included; paste/manual input is sufficient for this release.

## 13. API contract

Extend the existing `adminCallable`, with `adminContract.ts` as the complete typed schema.
Use transport errors for unauthenticated, permission-denied and malformed requests;
domain refusals return `{ok:false, rejection, ...details}`. Successful replies return
`{ok:true, ...data, serverNow}`. No access token in a URL.

Existing compatible actions remain `access`, `saveZone`, `saveInventory`,
`deleteExpiredOrbs`, `summary`, `event`, `moveOrb`, `saveOrb`, `checkCode`, `redeemCode`.
Delete an individual Orb using existing `deleteOrbCallable`, with its audited deletion
implemented in `orbAdmin.ts`, not a duplicate web-only delete path.

New/extended contract:

| Action | Request fields beyond `action` | Success data |
|---|---|---|
| `access` | None | Existing `isAdmin`; `role: organizer/redemption/none`, `eventIds` for staff |
| `listEvents` | Organizer: optional state, cursor, limit; staff: no global filters | Event summaries and nextCursor |
| `createEvent` | Stable eventId, name | eventId; already-created retry returns original result |
| `copyEvent` | sourceEventId, stable eventId, name | eventId; original source/config snapshot preserved on retry |
| `readiness` | eventId | canStart, blockers, warnings, checkedAt |
| `event` | Existing payload; add `acknowledgeWarnings` for start | Existing ok; current state/endsAt |
| `saveZone` | eventId, zonePoints | Existing ok; geometry rejection details |
| `saveOrb` | Existing fields; inventoryId for tracked rewards | Existing orbId; original creation result on retry |
| `moveOrb` | Existing fields | Existing location response |
| `saveInventory` | eventId, inventoryId, prize, quantity; create flag or expectedRemaining | Saved item with current remaining |
| `listInventory` | eventId, cursor, limit | Items and reservation/fulfillment counts, nextCursor |
| `summary` | eventId | Preserve issued/redeemed/winners/activePlayers; add claims, uniqueClaimWinners, participant metric |
| `positions` | eventId | Only recent validated `{uid,lat,lng,acc,ts}` positions; serverNow |
| `listClaims` | eventId, cursor, limit, tier?, rewardKind?, asOf? | Claim rows, nextCursor, asOf |
| `listAudit` | eventId, cursor, limit, category?, actorUid?, asOf? | Activity rows, nextCursor, asOf |
| `listStaff` | eventId | Assigned UID/display account email |
| `assignStaff` | eventId, exactly one of email/uid | Resolved UID and assignment |
| `removeStaff` | eventId, uid | Removed assignment; repeat removal is harmless |
| `checkCode` | Existing eventId/code | Prize snapshot, usedAt, redemption state |
| `redeemCode` | Existing eventId/code | Existing ok/prize/usedAt; no second success on replay |
| `report` | eventId | Configuration, metrics, tier/prize breakdown and asOf |
| `listLeaderboard` | eventId, cursor, limit | Ranked rows and nextCursor; used for complete export |

Request page size: default 50, maximum 200; server enforces both. Use an opaque validated
cursor holding last sort values/document ID and filter identity; never offsets. List
claims/journal are newest-first; leaderboard sorts points descending, UID ascending.
Leaderboard cursors also preserve processed row count, last points value and shared
rank so ties spanning page boundaries retain the same rank.
For staff event lists, resolve only assigned IDs server-side. Empty membership never
means unrestricted access. Do not return unassigned codes or arbitrary player profiles.

New domain errors: `EVENT_NOT_FOUND`, `EVENT_NOT_EDITABLE`, `EVENT_CUTOFF_REACHED`,
`EVENT_NOT_READY`, `WARNINGS_NOT_ACKNOWLEDGED`, `ZONE_EXCLUDES_ORBS`,
`INVENTORY_CHANGED`, `INVENTORY_EMPTY`, `INVENTORY_NOT_FOUND`, `ACCOUNT_NOT_FOUND`.
Preserve existing Orb/code errors and transport semantics. Fields with invalid bounds
use `invalid-argument` and identify the field. Return current stock on inventory conflict
and affected Orb IDs on a geometry exclusion. Missing events return a domain error before
any collection creation; new writes must not create orphan subcollections.

Creation retry ownership: event/Orb/item document stores a creation request ID, createdBy
and original result; a reused ID for a different creation returns a conflict. Do not
apply a second edit when replaying a creation. Never retry redemption as a new logical
handover. Other mutations are explicit operator actions; no generic offline replay queue.

## 14. Data delivery, concurrency and indexes

Subscribe directly to the selected event, its Orbs and bounded leaderboard preview,
using the already permitted Firestore reads. Do not loosen rules for administrative
collections. Do not use client-written `visiblePositions` as validated admin telemetry.

Privileged queries use TanStack Query: summary/positions/claims every 5 seconds while
Monitor or Map is visible; inventory and audit every 15 seconds while their screens are
visible. Fetch staff/config once and invalidate after mutations. Hide/unmount stops
polling and event switch disposes the old queries. Keep at most one in-flight request
per query. First failure stops showing a live label, preserves data as stale and offers
Retry; successful next fetch restores freshness. Display the last successful server time.
Mutation transport failures are not retried automatically.

Positions query omits samples at least 30 seconds old. Query authorization precedes RTDB
read. The browser neither reports an organizer's location nor writes presence merely
because its map is open. Display no participant contact information on the map.

Keep data mutation and success audit in the same Firestore transaction. Single-Orb
deletion records its logical audit when the Orb is removed; existing paged cleanup of
free codes remains in the owning delete operation. Make collection reads/writes respect
Firestore transaction ordering. Inventory changes must contend with spawn reservations.
Event Start must contend with concurrent config/zone edits, using the event transaction.

New optional event fields: `name`, `createdAt`, `createdBy`, `copiedFromEventId`,
`createRequestId`, `participantCaptureStartedAt`. Stock gains `createdAt`, `createdBy`,
`updatedAt`, `updatedBy`; manual tracked reward Orbs use existing `inventoryId`.
All authoritative timestamps are UTC epoch milliseconds. Participant docs and access
documents remain server-only under the existing default-deny rules.

Add indexes for actual queries, committing them in `backend/firestore.indexes.json`:

- Events: state ascending + createdAt descending (document ID tie-break).
- Claims: status ascending + claimedAt descending; add type/rewardKind equality fields
  for supported filter combinations.
- Activity: type/category and actor (`playerId`) equality combinations + ts descending.
  Store normalized `category` on new audit rows; backfill legacy rows before enabling category filters.
- Leaderboard: points descending + document ID ascending for paged rank ordering.

Staff event membership uses a single-field array-contains index. Create only the query
combinations the UI exposes, and verify them against a deployed staging Firestore;
emulator success alone does not prove production indexes exist. Enforce the same page
bounds and filters for CSV and screen queries.

## 15. Compatibility and rollout

Backend deployment comes before the new web release. Maintain all player claim/reward
contracts and Unity `access.isAdmin`. Reuse stored `epic` for Legendary. New web roles
do not change player account behavior or existing position publication.

Provide an explicit one-time administrative migration tool with dry-run and apply:

1. Add `createdAt` to legacy events using the Firestore document creation time and set
   missing display names to the event ID. Do not invent creator UIDs.
2. Backfill missing code prize snapshots from existing Orb prize text; report missing
   Orbs for manual resolution before acceptance, never guess a reward.
3. Add log categories derived from existing types; do not deduplicate or rewrite history.
4. Record which legacy events lack historical participant capture. Their report shows
   "Not recorded" until a new event with capture begins. Do not fabricate past attendance.

Do not change existing stock, live state, zone, scores or issued codes as a side effect
of deploying the admin. Legacy active events remain operable; first-start readiness
is applied when an event is actually started, not by migrating its state.

Deploy event/inventory policy updates and any required Unity inventory payload change
as one reviewed release. Changes are confined to existing request boundaries; no Unity
screen redesign is part of browser admin implementation.

## 16. Build, deployment and operation

Web scripts: `dev`, `build` (typecheck then Vite build), `lint`, `test`, `test:e2e`, `preview`.
Use Node 22, matching backend. Local development explicitly connects Auth, Firestore,
Database and Functions SDKs to the emulator when `VITE_USE_EMULATORS=true`. Never infer
emulator mode from a failed production request. Supply `.env.example` with placeholders.

Public build variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_FUNCTIONS_REGION
VITE_MAPBOX_TOKEN
VITE_USE_EMULATORS
```

These browser configuration values are visible in published JS; GitHub secrets do not
make `VITE_*` output private. Never include service accounts, Admin SDK credentials,
SMTP secrets, deployment tokens or `ORBS_ADMIN_UIDS`. Display environment and build
commit in an About footer. Production build fails if required config is absent or
emulator mode is enabled.

`checks.yml`: pull requests install dependencies and typecheck/build without production
credentials. Backend Vitest tests remain in the private repository. Critical Playwright
flows use the real backend emulators and generated accounts/events; see the README.

`pages.yml`: on main pushes and `workflow_dispatch`, build the web bundle, upload only
`dist` and deploy with the Pages action. Use `contents: read`, `pages: write`,
`id-token: write` and Pages deployment concurrency. Set Pages to GitHub Actions.
Never upload backend directories, Unity assets or an environment file.

Provisioning sequence:

1. Verify GitHub Pages entitlement, publishing settings and organization policy.
2. Register a Firebase Web App in the existing intended project; record its public config.
3. Verify the Firebase email/password provider and allowed auth domains, including the
   Pages hostname and localhost for local development.
4. Configure the existing Mapbox credential for browser use and deployed origin restrictions;
   keep attribution visible and confirm the plan covers expected usage.
5. Deploy reviewed backend handlers, indexes and any compatible Unity changes; run the
   explicit migration on a staging copy first.
6. Configure the build environment, publish Pages, then run the acceptance scenario.

Published HTML/JS can be public while administrative API access remains authenticated.
GitHub repository privacy is not an API authorization boundary. GitHub Pages hosts
static files; Firebase executes all authenticated operations.

Rollback web by redeploying the previously accepted commit. Backend rollback must preserve
existing new documents and issued codes. Do not roll back data or erase reports. If a
backend cannot safely support the previous client, disable affected operations with a
clear error until the corrected release is deployed. No new administrative secrets or
custom infrastructure are required for a Pages deploy.

## 17. Implementation stages and estimates

These are engineering estimates for one developer familiar with this project, not
calendar commitments. Each stage ends with a working, reviewable flow.

| Stage | Deliverable | Estimated work |
|---|---|---|
| 1 | Web foundation, login, access policy, staff assignment, event list/create/copy | 3–4 developer days |
| 2 | Map, zone/Orb editor, settings, readiness, stock reservation/edit semantics | 4–6 days |
| 3 | Monitoring, participant capture, audit, redemption, report queries and CSV | 3–5 days |
| 4 | Migration, Pages/CI, browser acceptance, Unity compatibility and fixes | 2–3 days |
| Total | Complete accepted first release | 12–18 developer days |

Account provisioning, plan entitlement, review turnaround and field acceptance can add
elapsed time. The organizer can first test event preparation after stage 2, then run
the complete create → start → claim in Unity → redeem in browser flow after stage 3.
Use a disposable staging event and prizes, never an active real-prize event for tests.

## 18. Acceptance criteria

Release is complete only when every applicable criterion passes. Backend tests target
permissions, transactions and domain behavior; browser tests target complete user flows.
Do not add tests that merely repeat markup or library implementation.

### Accounts and permissions

- Organizer can sign in, refresh a deep link, switch events and sign out.
- Normal player sees no admin access; direct mutation/read calls are denied.
- Staff sees only assigned admin event summaries and Redeem; direct calls for configuration,
  inventory, logs, reports, exports and a different event's codes are denied.
- Removing an assignment blocks the next check/redeem call, including from an already open tab.
- Existing Unity administrator lookup and organizer-only test/delete endpoints still work.

### Preparation and lifecycle

- Create retries produce one event; copy produces a waiting configuration with no old stock,
  Orbs, codes, staff, results or start/end times.
- Valid simple zone saves; intersecting/empty zone is refused without modifying the event.
- Moving corners or changing buffer cannot exclude live Orbs silently.
- Readiness catches missing zone/settings and shows accurate stock/zero-points warnings.
- Concurrent configuration change cannot bypass the transactional start check.
- Active configuration edits require Pause; ended events cannot restart.
- Pause preserves the running clock and rejects attempt completions; resume after cutoff fails.
- Automatic cutoff rejects a claim even before the scheduler marks the event ended.
- Warning timing and duration edits follow section 7, with server timestamps.

### Orbs, spawning and inventory

- Place/Cancel writes nothing; Save retry creates one Orb, one reservation and at most one code.
- Move changes only location; properties preserve elapsed lifetime; Activate explicitly restarts.
- Claimed Orb deletion is refused; active attempts prevent destructive editing.
- Manual and auto reservations cannot overdraw the same final inventory unit concurrently.
- Editing stock with stale expectedRemaining fails rather than overwriting a reservation.
- Conversion/deletion restores exactly one unclaimed reservation; rename does not change issued prize.
- Expired auto Orb relocation retains its inventory/code; points-only Orb has no code.
- Capacity, claim limits, tier frequencies and depleted-stock behavior match section 9.
- Map survives event switching without previous-event markers; stale positions disappear at 30 s.

### Redemption and reporting

- Unity can claim a web-created reward Orb and the browser shows its issued prize correctly.
- Two simultaneous valid redemptions yield exactly one successful handover and one audit record.
- Duplicate, unknown, unissued and already-used code states are distinct.
- Input/event/account change clears previous code validation; offline failure never shows success.
- Ended-event redemption works without reopening game actions.
- Points-only wins count as claims/winners; reward totals are code-derived and exclude unassigned pool.
- Claim retries do not inflate totals; legacy attendance is labeled rather than fabricated.
- Journal shows successful changes and actor identity; CSV includes every requested page,
  quotes text safely, uses UTC, excludes code strings/contacts and cancels failed partial output.
- Late redemption updates report fulfillment totals and the report generation timestamp.

### Deployment and usability

- Pages publication succeeds on the private repository's actual entitled configuration.
- Direct hash link and refresh load the app and assets at `/Orbs-Admin/` without 404.
- Published JS contains no server credentials; backend protection works independently of URL access.
- Redeem works at 360 px; organizer map editing works at 768 px and desktop widths.
- Current stable Chrome, Firefox, desktop Safari and iOS Safari pass critical flows;
  desktop Edge is covered by Chromium acceptance with a manual smoke check.
- Dialogs and core forms work by keyboard; status/error messages remain understandable without color.
- Map tile failure leaves non-map operations usable; last-known data is labeled stale on query failure.
- A staging run with 300 position samples and up to 100 live Orbs supports pan/select/filter without
  duplicate polling or browser DOM marker proliferation. No whole-history subscription is used for logs/codes.
- Production-required indexes are deployed and verified outside the emulator.
- Existing backend claim contention/redemption/security tests remain green.

## 19. Scope boundary

This release delivers the agreed organizer and redemption tool. Multi-organization
tenancy, partner-specific prize permissions, QR scanning, offline fulfillment, arbitrary
polygon imports/holes, scheduled future starts, payments, invitation emails, new gameplay,
an adaptive spawn formula and second-resolution scheduling are outside this implementation.
There is no dependency on those features to accept the release described above.

## 20. Sources

- Product requirement: [Mechanics #2 and following-stage comment](https://github.com/369labz-dev/Orbs-Admin/issues/2#issuecomment-5743795176).
- Current repository behavior: `Orbs-MVP/Docs/admin-screen.md`, `Orbs-MVP/Docs/live-backend-status.md`
  and the inspected source files listed in section 2. Source code takes precedence over older behavior notes.
- Static build/base path: [Vite static deployment](https://vite.dev/guide/static-deploy.html).
- Private-repository availability and deployment: [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
  and [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
- Authenticated calls: [Firebase callable functions](https://firebase.google.com/docs/functions/callable).
- Accounts: [Firebase password authentication](https://firebase.google.com/docs/auth/web/password-auth).
- Polygon editing: [MapLibre and Terra Draw example](https://maplibre.org/maplibre-gl-js/docs/examples/maplibre-gl-terradraw/).
- Browser map credentials: [Mapbox access tokens](https://docs.mapbox.com/help/dive-deeper/access-tokens/).
