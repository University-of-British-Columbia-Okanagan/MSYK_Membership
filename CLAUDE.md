# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Read README.md First

**Before starting any work, always read [README.md](./README.md) in full.**

The README.md file is the single source of truth and contains comprehensive documentation about:
- Development commands and setup
- User documentation (guests, members, administrators)
- Architecture overview and system design
- Core system concepts (RBAC, workshops, equipment, memberships, payments)
- Database patterns and Prisma usage
- Development patterns and authentication flows
- Environment variables and configuration
- Brivo access control integration
- Stripe Product Sync integration
- Google Calendar integration
- Complete route map
- Common tasks and workflows

## Quick Reference

### Essential Commands
```bash
npm run dev                           # Start dev server (localhost:5173)
npm run typecheck                     # Type check + generate React Router types
npx prisma generate --schema prisma/schema.prisma  # Generate Prisma client
npx prisma migrate dev                # Run migrations
npx tsx seed.ts                       # Seed database (NODE_ENV=development only)
npx prisma studio                     # Open database GUI
npm test                              # Run Jest tests
```

### Key Documentation Files

Maintained — keep these in sync with the code:
- **[README.md](./README.md)** - Complete documentation: setup, user docs, architecture, database schema, model functions, route map, env vars (READ THIS FIRST)
- **[MSYK-OVERVIEW.md](./MSYK-OVERVIEW.md)** - Detailed functional overview, end-to-end workflows, and test plan
- **[tests/README.md](./tests/README.md)** - Test suite: layout, fixture conventions, and the failure modes that have bitten here
- **[.claude/README.md](./.claude/README.md)** - Slash commands available in this repo

Supporting material in `docs/` — the root is reserved for the three primary docs, so anything else worth reading lives here. Not maintained against the code, but still worth reading for the area it covers:
- **[docs/README.md](./docs/README.md)** - Index of the folder: every file, what it is, and whether it is maintained. Start here
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Vendor Brivo API reference snapshot. Authoritative for the endpoints `app/services/brivo.server.ts` calls — read before changing the door access integration. Never edit
- **[docs/implementations/](./docs/implementations/)** - Point-in-time write-ups of individual implementations, written once when the work landed and deliberately not maintained afterwards. Historical records, not current behavior

### Required workflow for every implementation

**Implement → test → verify end to end. All three steps, every time. Never stop after the code compiles.**

First decide which of the two cases you are in, because it changes step 2:

#### Case A — new functionality

1. **Implement** the feature
2. **Add test files for it** under `tests/`, following the existing layout, and run them until they pass
3. **Verify end to end with Playwright MCP** — drive the real flow in the browser and confirm it behaves as expected
4. **Regress** — `npm test` must stay fully green (currently **27 suites / 372 tests**)
5. **Typecheck** — `npm run typecheck` (three pre-existing errors in `old/webhooks.server.ts` are known and unrelated)

#### Case B — the change touches existing functionality

Assume it does whenever you edit an existing function, route, query, or schema field. Existing tests encode the old behaviour, so they will be wrong now.

1. **Implement** the change
2. **Find and update every affected test file.** Run `npm test` first to see what broke, and grep `tests/` for the symbols you touched — a test can be stale without failing. Then decide, per failure, whether the test or the code is wrong, **say which**, and fix that one
3. **Verify end to end with Playwright MCP** — confirm the changed behaviour *and* that the surrounding flow still works
4. **Regress** — `npm test` fully green
5. **Typecheck**

**Most changes are Case B.** When unsure, treat it as Case B.

Rules:
- **Step 3 is not optional.** A green unit test says the function behaves; only the browser says the feature works
- **Never edit a test purely to make it pass.** Establish whether the test or the code is wrong, state which, fix that one. In this repo several assertions were stale — but one was masking a real defect
- **A suite reporting `0 total` is broken, not passing.** Five equipment suites silently ran zero tests for months while looking green
- **A bug fix should carry a test that would have caught it**
- Match the existing layout — see [tests/README.md](./tests/README.md)

### Browser Testing (Playwright MCP)

`.mcp.json` registers the `@playwright/mcp` server, giving you a real Chromium browser. **Use it to verify UI and flow changes in the running app instead of assuming they work.** Start the app with `npm run dev` first (nothing auto-starts it), seed the DB if you need to log in, then drive `http://localhost:5173`. Chromium is already installed. See [.claude/README.md](./.claude/README.md) for guidance on when to reach for it.

### Project Structure
```
app/
├── routes/              # File-based routing (React Router 7)
├── models/              # Server-side business logic (*.server.ts)
├── services/            # External service integrations (*.server.ts)
├── utils/               # Utilities (*.server.ts)
├── layouts/             # Shared layout components
├── components/ui/       # UI components
├── schemas/             # Zod validation schemas
├── config/              # App config (access-control.ts)
├── hooks/               # use-mobile.tsx
├── lib/                 # utils.ts (cn helper)
└── logging/             # Winston logger

prisma/
└── schema.prisma        # Database schema
```

### Critical Notes
- **Server-side code**: Use `*.server.ts` naming convention
- **Routing**: File-based from `app/routes/` with loaders/actions; configured in `app/routes.ts`
- **Aliases**: `~` and `@` both point to `app/` directory (configured in `vite.config.ts`)
- **Database**: PostgreSQL with Prisma ORM; Stripe API version `2025-02-24.acacia`
- **Stripe**: Live keys start with `sk_live_`/`pk_live_`, test with `sk_test_`/`pk_test_`; env vars are `STRIPE_SECRET_KEY` and `STRIPE_PUBLIC_KEY`
- **Stripe Products**: `stripeProductId` on Workshop, MembershipPlan, Equipment — auto-synced via `app/services/stripe-sync.server.ts`; bulk sync via `/api/stripe-sync` admin endpoint
- **Role Levels**: Strict AND chain (1=registered only, 2=+orientation, 3=+active membership, 4=+needAdminPermission plan+allowLevel4); corrected every 15s by `startRoleLevelSyncCron()` in `app/models/user.server.ts`
- **Cron Jobs**: Three background jobs started in `entry.server.ts` — role level sync (every 15s via node-cron), membership billing (midnight daily via node-cron), workshop occurrence status update (every 1s via setInterval)
- **Door Access**: Two separate systems — Brivo (physical door lock, Level 4 only, auto-sync) and ESP32+local fobs (sign-in/out logging, admin-managed, never auto-modified by syncs)
- **Logging**: Winston logger at `app/logging/logger.ts` → writes to `logs/error.log` and `logs/all_logs.log`; development also logs to console
- **Session**: cookie `RJ_session`, 3-hour `maxAge`. Stores `userId`, `userPassword` (the raw password from the login form), and `loginTime`. `getUserId()` validates all three on every request and `bcrypt.compare`s the session password against the DB hash — so changing a password invalidates every existing session
- **No `requireAuth()` helper exists.** Routes call `getRoleUser(request)` (most common), `getUser(request)`, or `getUserId(request)` in their loader/action and issue their own `redirect()`
- **Emails**: Case-insensitive lookups everywhere (`mode: "insensitive"`); new registrations stored lowercase
- **JWT_SECRET**: Required env var for password reset tokens (1-hour JWT expiry)
- **AdminSettings key for equipment visibility**: `equipment_visible_registrable_days` (not `equipment_visibility_days`)
- **AdminSettings key `level4_unavaliable_hours` is misspelled in the code** — match it exactly; the other equipment keys are `level3_start_end_hours`, `max_number_equipment_slots_per_day` (default 4), `max_number_equipment_slots_per_week` (default 14)
- **`EquipmentBooking` has no unique constraint on `slotId`** — `@@unique([slotId])` is commented out in `schema.prisma` so cancelled and new bookings can share a slot. Double-booking is prevented in application code, not the DB
- **Occurrence status values** are `active` → `past` (set by the 1s cron) and `cancelled`; the `// "open", "closed", "cancelled"` comment in `schema.prisma` is stale
- **`UserWorkshop.result`**: `passed` (schema default), `failed`, `pending`, `cancelled`
- **The `payment.tsx` loader is the only server-side registration-cutoff gate.** Neither `quickCheckout()` nor `paymentsuccess.tsx` re-checks `Workshop.registrationCutoff`, so a loader branch that omits the check is bypassable by pasting the URL. All four workshop branches call `isPastRegistrationCutoff` today — if you add a fifth, add the check and a case to `tests/routes/dashboard/payment.cutoff.test.ts`
- **Admin can move a registration** between occurrences of the same workshop via `moveUserWorkshopRegistration()` — single-day, active, in-capacity targets only

---

**Remember: Read [README.md](./README.md) for complete details before making changes.**
