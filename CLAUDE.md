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
- **[.claude/README.md](./.claude/README.md)** - Slash commands available in this repo

Supporting material in `docs/` — the root is reserved for the three primary docs, so anything else worth reading lives here. Not maintained against the code, but still worth reading for the area it covers:
- **[docs/README.md](./docs/README.md)** - Index of the folder: every file, what it is, and whether it is maintained. Start here
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Vendor Brivo API reference snapshot. Authoritative for the endpoints `app/services/brivo.server.ts` calls — read before changing the door access integration. Never edit
- **[docs/implementations/](./docs/implementations/)** - Point-in-time write-ups of individual implementations, written once when the work landed and deliberately not maintained afterwards. Historical records, not current behavior

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
- **Admin can move a registration** between occurrences of the same workshop via `moveUserWorkshopRegistration()` — single-day, active, in-capacity targets only

---

**Remember: Read [README.md](./README.md) for complete details before making changes.**
