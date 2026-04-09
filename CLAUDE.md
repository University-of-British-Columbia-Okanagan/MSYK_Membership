# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Read PROJECT.md First

**Before starting any work, always read [PROJECT.md](./PROJECT.md) in full.**

The PROJECT.md file contains comprehensive documentation about:
- Development commands and setup
- Architecture overview and system design
- Core system concepts (RBAC, workshops, equipment, memberships, payments)
- Database patterns and Prisma usage
- Development patterns and authentication flows
- Environment variables and configuration
- Brivo access control integration
- Stripe Product Sync integration
- Google Calendar integration
- Common tasks and workflows

## Quick Reference

### Essential Commands
```bash
npm run dev                           # Start dev server (localhost:5173)
npm run typecheck                     # Type check + generate React Router types
npx prisma generate --schema prisma/schema.prisma  # Generate Prisma client
npx prisma migrate dev                # Run migrations
npx tsx seed.ts                       # Seed database
npx prisma studio                     # Open database GUI
npm test                              # Run Jest tests
```

### Key Documentation Files
- **[PROJECT.md](./PROJECT.md)** - Complete technical documentation (READ THIS FIRST)
- **[README.md](./README.md)** - Project overview, setup instructions, user documentation
- **[GEMINI.md](./GEMINI.md)** - Same guidance for Gemini AI
- **[docs/msyk-overview.md](./docs/msyk-overview.md)** - Detailed functional overview and workflows
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Brivo API reference
- **[docs/implementations/stripe-product-sync.md](./docs/implementations/stripe-product-sync.md)** - Stripe Product Sync implementation details

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
└── logging/             # Winston logger

prisma/
└── schema.prisma        # Database schema
```

### Critical Notes
- **Server-side code**: Use `*.server.ts` naming convention
- **Routing**: File-based from `app/routes/` with loaders/actions; configured in `app/routes.ts`
- **Alias**: `~` points to `app/` directory
- **Database**: PostgreSQL with Prisma ORM; Stripe API version `2025-02-24.acacia`
- **Stripe**: Live keys start with `sk_live_`/`pk_live_`, test with `sk_test_`/`pk_test_`
- **Stripe Products**: `stripeProductId` on Workshop, MembershipPlan, Equipment — auto-synced via `app/services/stripe-sync.server.ts`; bulk sync via `/api/stripe-sync` admin endpoint
- **Role Levels**: Strict AND chain (1=registered only, 2=+orientation, 3=+active membership, 4=+needAdminPermission plan+allowLevel4); corrected every 15s by `startRoleLevelSyncCron()` in `app/models/user.server.ts`
- **Cron Jobs**: Three background jobs — role level sync (15s), membership billing (midnight daily), workshop occurrence status update (1s interval)
- **Door Access**: Two separate systems — Brivo (physical door lock, Level 4 only, auto-sync) and ESP32+local fobs (sign-in/out logging, admin-managed, never auto-modified by syncs)
- **Logging**: Winston logger at `app/logging/logger.ts` → writes to `logs/error.log` and `logs/all_logs.log`
- **Session**: 3-hour cookie expiry; `loginTime` stored and validated on every request
- **Emails**: Case-insensitive lookups everywhere (`mode: "insensitive"`); new registrations stored lowercase

---

**Remember: Read [PROJECT.md](./PROJECT.md) for complete details before making changes.**
