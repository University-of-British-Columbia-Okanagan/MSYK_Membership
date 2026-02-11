# GEMINI.md

This file provides guidance to GEMINI when working with code in this repository.

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
- Common tasks and workflows

## Quick Reference

### Essential Commands
```bash
npm run dev                           # Start dev server (localhost:5173)
npx prisma generate --schema prisma/schema.prisma  # Generate Prisma client
npx prisma migrate dev                # Run migrations
npx tsx seed.ts                       # Seed database
npx prisma studio                     # Open database GUI
```

### Key Documentation Files
- **[PROJECT.md](./PROJECT.md)** - Complete technical documentation (READ THIS FIRST)
- **[README.md](./README.md)** - Project overview, setup instructions, user documentation
- **[docs/msyk-overview.md](./docs/msyk-overview.md)** - Detailed functional overview and workflows
- **[docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./docs/apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md)** - Brivo API reference

### Project Structure
```
app/
├── routes/              # File-based routing (React Router 7)
├── models/              # Server-side business logic (*.server.ts)
├── utils/               # Utilities (*.server.ts)
├── components/ui/       # UI components
└── schemas/            # Zod validation schemas

prisma/
└── schema.prisma       # Database schema
```

### Critical Notes
- **Server-side code**: Use `*.server.ts` naming convention
- **Routing**: File-based from `app/routes/` with loaders/actions
- **Alias**: `~` points to `app/` directory
- **Database**: PostgreSQL with Prisma ORM
- **Stripe**: Live keys start with `sk_live_`/`pk_live_`, test with `sk_test_`/`pk_test_`
- **Role Levels**: Dynamically calculated (1=basic, 2=orientation, 3=membership, 4=advanced+flag)

---

**Remember: Read [PROJECT.md](./PROJECT.md) for complete details before making changes.**
