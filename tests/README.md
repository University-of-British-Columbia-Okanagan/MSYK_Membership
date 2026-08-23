# tests/

Jest test suite for the MSYK Membership Management System.

**Current state: 27 suites, 372 tests, all passing.** Every server module under `app/models/`, `app/services/`, `app/utils/session.server.ts`, and `app/config/` has coverage. That green baseline is what makes a failure meaningful — if the suite goes red after your change, you caused it.

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

---

## Layout

```
tests/
├── README.md                    # this file
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
│   └── workshop.{basic,cancellation,capacity,move,registration}.test.ts
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
