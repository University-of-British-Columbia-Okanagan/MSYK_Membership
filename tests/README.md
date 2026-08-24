# tests/

Jest test suite for the MSYK Membership Management System.

**Current state: 29 suites, 388 tests, all passing.** Every server module under `app/models/`, `app/services/`, `app/utils/session.server.ts`, and `app/config/` has coverage. That green baseline is what makes a failure meaningful — if the suite goes red after your change, you caused it.

```bash
npm test                                      # everything
npx jest --testPathPatterns "workshop"        # one area
npx jest --testPathPatterns "payment.gst"     # one file
npx jest --json                               # machine-readable, for checking per-suite counts
```

---

## The workflow this folder exists to support

Every implementation follows **implement → test → verify end to end**. Which middle step you take depends on what you changed:

| | New functionality | Change to existing functionality |
|---|---|---|
| 1 | Implement the feature | Implement the change |
| 2 | **Add** test files here and make them pass | **Update** the existing tests the change invalidated |
| 3 | Verify end to end with Playwright MCP | Verify end to end with Playwright MCP |
| 4 | `npm test` fully green | `npm test` fully green |
| 5 | `npm run typecheck` | `npm run typecheck` |

Most changes are the right-hand column. When in doubt, assume you are. Full rules live in [CLAUDE.md](../CLAUDE.md); the reader-facing version is in [README.md](../README.md#testing-strategy).

**Step 0 is asking.** Before implementing, put the clarifying questions to the maintainer — *"ask me any clarifying questions and anything you need from me to do this, we are a team"* runs in both directions. Scope, expected behaviour at the edges, which of two designs: settle it before writing the test that encodes it.

### Ask for what you need to test

Testing is where an agent most often gets quietly stuck, and where staying stuck does the most damage. If you cannot finish step 2 or step 3 without something only the maintainer can provide — **ask for it**:

- A Brivo sandbox credential or a Google OAuth test client (the Stripe test card is already documented below — you do not need to ask for that one)
- A user in a state the seed does not produce. The seed *does* cover role levels 1–4 (`testuser1`–`testuser6` below), so check that table first; the sync cron reverts a hand-edited `roleLevel` within 15s, so ask rather than patching the column
- A seeded workshop, membership, or booking in a specific state
- An admin setting flipped, or a `.env` value you do not have
- A ruling on what the correct behaviour actually *is*, when the existing test and the new code disagree

Asking costs one message. The alternatives — skipping the verification, faking the data, or softening the assertion until it passes — all ship a change nobody checked. Say what you are blocked on and what would unblock you.

---

## Layout

```
tests/
├── README.md                    # this file
├── entry.server.test.ts         # boot wiring: the three background jobs start, once each
├── config/                      # app/config/
│   └── access-control.test.ts
├── models/                      # app/models/
│   ├── access.card-log.test.ts      # access_card + accessLog
│   ├── admin.settings.test.ts
│   ├── equipment.{basic,booking,cancellation,settings,slots}.test.ts
│   ├── issue.server.test.ts
│   ├── membership.{server,cron}.test.ts
│   ├── payment.{gst,refunds}.test.ts
│   ├── profile.volunteer.test.ts
│   ├── user.rolelevel.test.ts
│   └── workshop.{basic,cancellation,capacity,move,occurrence-status,registration}.test.ts
├── services/                    # app/services/
│   ├── access-control-sync.server.test.ts
│   ├── brivo.server.test.ts
│   └── stripe-sync.server.test.ts
├── utils/                       # app/utils/
│   └── session.server.test.ts
├── routes/dashboard/            # route loaders and actions
│   ├── addequipment.test.ts
│   ├── addworkshop.test.ts
│   └── payment.cutoff.test.ts
├── fixtures/                    # per-domain mock setup + sample data
│   ├── equipment/   {setup,equipments,addEquimentForm,getEquipmentSlotsWithStatus}.ts
│   ├── membership/  {setup,memberships}.ts
│   ├── payment/     setup.ts
│   ├── session/     {setup,getUser,getRoleUser}.ts
│   ├── user/        setup.ts
│   └── workshop/    {setup,workshops}.ts
└── helpers/
    ├── db.mock.ts               # shared Prisma client mock
    └── test-utils.ts            # clearAllMocks, createMockRequest, …
```

Specs mirror the source tree. A file with more than roughly 20 tests is split by concern (`equipment.booking` vs `equipment.slots`) rather than growing without bound.

---

## Background jobs

Three jobs run for the life of the server process, all started from `entry.server.ts`. Each has its own spec, and the wiring that starts them has one too:

| Job | Cadence | Started by | Spec |
|-----|---------|-----------|------|
| Role level sync | every 15s (`*/15 * * * * *`, node-cron) | `startRoleLevelSyncCron()` | `models/user.rolelevel.test.ts` |
| Membership billing | daily at midnight (`0 0 * * *`, node-cron) | `startMonthlyMembershipCheck()` | `models/membership.cron.test.ts` |
| Occurrence status | every 1s (`setInterval`) | `startWorkshopOccurrenceStatusUpdate()` | `models/workshop.occurrence-status.test.ts` |
| — all three start at boot | once per process | `entry.server.ts` | `entry.server.test.ts` |

Testing them means never waiting on real time:

- **node-cron is mocked as a recorder.** `fixtures/user/setup.ts` and `fixtures/membership/setup.ts` replace `cron.schedule` with a mock that stores `{ expression, handler }`, so a spec asserts the expression and then calls the handler directly. Note the difference between the two fixtures: the membership recorder *invokes* the handler as it registers it (the spec awaits `job.execution`), while the user one does not (the spec calls `job.handler()` itself)
- **`setInterval` uses fake timers.** The occurrence job takes no schedule argument, so the spec asserts `setInterval(fn, 1000)` and drives it with `jest.advanceTimersByTime`, counting `db.workshopOccurrence.findMany` calls as passes. `jest.clearAllTimers()` in `afterEach` stops the interval leaking into the next test
- **Assert the schedule, not just the work.** A job whose handler is correct but whose expression was changed to `0 0 * * *` from `*/15 * * * * *` is still broken
- **Failure behaviour differs on purpose, so test what each one actually does.** The role-level and membership jobs catch and log, because a throw would kill a job that has to survive until the next tick. `updateWorkshopOccurrenceStatuses()` rethrows

---

## Conventions

### Import the domain setup on the first line

```ts
import "tests/fixtures/equipment/setup";       // side-effect import, must come first
import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import { addEquipment } from "~/models/equipment.server";
```

**Ordering is load-bearing.** Several modules do work at import time — `payment.server`, `user.server`, and `stripe-sync.server` each construct a Stripe client from `STRIPE_SECRET_KEY`, and `session.server` throws if `SESSION_SECRET` is unset. If the mocks are not registered first, the suite fails to load and reports **zero tests while still looking green**. That is exactly how five equipment suites went unnoticed for months.

### Put mocks in a fixture, not the spec

Each `tests/fixtures/<domain>/setup.ts` registers the `jest.mock` calls for that domain and exports:

- `get<Domain>Mocks()` — typed handles to the mocks
- `reset<Domain>Mocks()` — restores default implementations, called from `beforeEach`

Add a new domain folder when you test a module that needs a mock shape none of the existing ones provide.

### Use the shared Prisma mock

`helpers/db.mock.ts` exports `createDbMock()`. When a new query needs a model or method that is not there yet, **add it there** rather than hand-rolling a mock in one spec — a missing method surfaces as `db.x.y is not a function` in whichever suite happens to hit it first.

### Fixtures must match the query, including relations

A fixture has to carry every relation the query `include`s. `cancelWorkshopOccurrence` includes the parent workshop and reads `.type` off it, so `createMockOccurrence` carries a `workshop` object. A fixture missing a relation produces `Cannot read properties of undefined`, which reads like an app bug and is not.

### Mock keyed helpers per key

`getAdminSetting(key, fallback)` returns different shapes per key — some callers `JSON.parse` the result. A blanket `mockResolvedValue("7")` makes `getLevel3ScheduleRestrictions()` return the number `7`, and indexing it by day name yields `undefined`. See `ADMIN_SETTING_TEST_DEFAULTS` in `fixtures/equipment/setup.ts`.

### Test the guard, not just the happy path

Where the defects actually are: capacity limits, role-level gates, refund windows, upload validation, `already cancelled` states, and "what happens when the third-party integration is not configured".

---

## Browser verification accounts

Step 3 needs a real login. `npx tsx seed.ts` (requires `NODE_ENV=development`) creates six users, all with the password `password`, one for every role level:

| Email | Password | Role level | How the level is earned |
|-------|----------|-----------|--------------------------|
| `testuser1@gmail.com` | `password` | 1 — **Admin** (`roleUserId: 2`) | Admin role; no orientation or membership |
| `testuser2@gmail.com` | `password` | 1 | Registered only |
| `testuser3@gmail.com` | `password` | 1 | Registered only |
| `testuser4@gmail.com` | `password` | 2 | Passed a past General Orientation |
| `testuser5@gmail.com` | `password` | 3 | Orientation + active **Makerspace Member** membership |
| `testuser6@gmail.com` | `password` | 4 | Orientation + active **Drop-In 10 Pass** (`needAdminPermission`) + `allowLevel4` |

Use `testuser1` for admin flows (settings, user management, workshop and equipment administration), `testuser2`/`testuser3` for a plain registered user — including the check that a non-admin is redirected away from admin routes — and `testuser4`–`testuser6` for anything gated on role level.

### Paying in a browser test (Stripe test card)

Step 3 flows that reach checkout need a card. On **test** Stripe keys, use Stripe's standard test card — `4242 4242 4242 4242`, any future expiry, any CVC, and any non-empty values for name, email, and billing address. Only the number matters. Never use a real card, and never run this against live keys.

Two gotchas that will otherwise cost you a debugging session:

- **`QuickCheckout` renders only when the user has a saved payment method.** With no card on file the payment page shows the ordinary Stripe form instead and the quick-checkout block is absent — that is the designed fallback, not a regression. `getSavedPaymentMethod()` reads the separate `UserPaymentInformation` row, and the payment routes gate on both `stripeCustomerId` and `stripePaymentMethodId` being set on it
- **`npx tsx seed.ts` deletes it.** The seed calls `prisma.user.deleteMany()`, and `UserPaymentInformation` cascades on its `user` relation, so saved cards go with the user rows. The seed creates no replacement

To restore one: log in as the user, go to **`/user/profile/paymentinformation` → Add Payment Method**, enter the card above. Quick Checkout then appears on `/dashboard/payment/...` and on the equipment booking page once slots are selected.

None of these levels are written directly. The seed creates the rows that *earn* them — a `UserWorkshop` with `result: "passed"` on an orientation, a `UserMembership` with status `active`, the `allowLevel4` flag — and then derives `roleLevel` from those rows using the same rules as `startRoleLevelSyncCron()`. That cron re-derives the level every 15 seconds, so **editing `roleLevel` by hand does not stick**; change the underlying rows instead.

---

## Things that bite

- **A suite reporting `0 total` is broken, not passing.** Check with `npx jest --json` and look for suites whose `assertionResults` array is empty
- **Never edit a test purely to make it pass.** Work out whether the test or the code is wrong, say which, and fix that one. Some assertions here were genuinely stale — one was masking a real defect
- **`clearAllMocks()` does not restore implementations**, only call history. Domain `reset*Mocks()` helpers re-apply defaults; call both in `beforeEach`
- **`console.error` in a passing test is noise, not failure.** Several model functions log and swallow by design; spy and restore rather than letting it clutter output
- **Time-dependent logic uses `jest.useFakeTimers()` + `setSystemTime`.** See `utils/session.server.test.ts` for the 3-hour session expiry boundary

---

## What is not here

**End-to-end browser tests.** Step 3 of the workflow is done interactively through the Playwright MCP server (`.mcp.json`) — driving the running app, not an automated spec. A standing Playwright suite was scoped and deferred: it needs an isolated test database, Stripe Checkout stubbing, and a way to handle the 1-second occurrence cron and 48-hour refund windows. Roughly 4–6 days of work, revisit when there is a deploy pipeline to gate.

Until then, "verified" means someone drove it in a browser.
