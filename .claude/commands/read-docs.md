You are onboarding yourself to this codebase at the start of a conversation. Your goal is to build an accurate, verified mental model of the system — not to read docs and accept them at face value, but to read the actual source code and confirm what is real.

Do not summarize as you go. Do not report progress mid-way. Read everything first, then produce one honest summary at the end.

---

## Phase 1 — Read all four documentation files in full

Read every line of each file. Do not skim.

- `CLAUDE.md`
- `PROJECT.md`
- `README.md`
- `docs/msyk-overview.md`

After reading, note any claims that need verification against the code (e.g. "cron runs every 15s", "emails stored as lowercase", "seed only runs in development"). You will verify these in Phase 2.

---

## Phase 2 — Read the source code in full

Read every file listed below completely. If a file is too long to read in one call, read it in chunks — do not stop until you have read all of it.

**Schema (read first — everything else references it):**
- `prisma/schema.prisma`

**Models (all of them):**
- `app/models/user.server.ts`
- `app/models/workshop.server.ts`
- `app/models/equipment.server.ts`
- `app/models/membership.server.ts`
- `app/models/payment.server.ts`
- `app/models/profile.server.ts`
- `app/models/admin.server.ts`
- `app/models/access_card.server.ts`
- `app/models/accessLog.server.ts`
- `app/models/issue.server.ts`

**Services:**
- `app/services/brivo.server.ts`
- `app/services/access-control-sync.server.ts`
- `app/services/stripe-sync.server.ts`

**Utilities:**
- `app/utils/session.server.ts`
- `app/utils/db.server.ts`
- `app/utils/email.server.ts`
- `app/utils/googleCalendar.server.ts`

**Config and logging:**
- `app/config/access-control.ts`
- `app/logging/logger.ts`

**Server entry (cron jobs start here):**
- `entry.server.ts`

**Seed script:**
- `seed.ts`

**Root config:**
- `package.json`
- `app/routes.ts`

**Routes — read all files in these directories:**

Run this to get the full list:
```bash
find app/routes -name "*.ts" -o -name "*.tsx" | sort
```

Then read every file in the list. Do not skip any route file.

---

## Phase 3 — Verify the documentation against what you read

Go through every factual claim in the four doc files and check it against what you actually saw in the source files. Be honest. Do not rationalize discrepancies away.

Check at minimum:

- Every command listed in CLAUDE.md and PROJECT.md — does it match `package.json` scripts?
- Every cron job schedule — does it match the actual `node-cron` or `setInterval` call?
- Every env var mentioned — does it actually appear in the source files?
- Every model and field name — does it match `schema.prisma`?
- Every route in the route map — does it exist in `app/routes.ts` and the route files?
- Every model function listed — does it actually exist in the model file?
- Session behavior (3-hour timeout, `loginTime` validation) — verified in `session.server.ts`?
- Email case normalization — verified in `session.server.ts`?
- Seed guard (NODE_ENV check) — verified in `seed.ts`?
- Role level logic — verified in `user.server.ts`?
- Stripe sync hooks — are they actually called from model create/update/delete functions?
- Brivo integration — does it gracefully degrade when env vars are missing?

---

## Phase 4 — Report

After completing all three phases, produce a single report with these sections:

### Verified Understanding
A concise but complete summary of how the system actually works, based on what you read. Cover:
- Tech stack and architecture
- Auth and session behavior
- Role level system and how it's calculated and synced
- Cron jobs (exact schedules confirmed from code)
- Workshop system (offer pattern, occurrence status, multi-day, prerequisites)
- Equipment booking system
- Membership system (billing, auto-renew, revocation)
- Payment flow (Stripe Checkout vs Quick Checkout, GST)
- Stripe Product Sync
- Brivo and ESP32 door access (two separate systems)
- Email system
- Seed script behavior

### Discrepancies Found
List every place where the documentation says something that does not match the code. Be specific: quote the doc claim and describe what the code actually does. If you found none, say so explicitly.

### Ready
One line confirming you have read all files and are ready to help with tasks in this codebase.
