You are onboarding yourself to this codebase at the start of a conversation. Your goal is to build an accurate, verified mental model of the system — not to read docs and accept them at face value, but to read the actual source code and confirm what is real.

Do not summarize as you go. Do not report progress mid-way. Read everything first, then produce one honest summary at the end.

---

## Phase 1 — Read every relevant markdown in full

Do not work from the list below alone — enumerate the markdowns that actually exist, so a file added since this command was written cannot be missed:

```bash
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | sort
```

Read **every file that command returns in full**, with exactly two carve-outs, both explained below. As of writing that means:

**Primary docs — the maintained description of the system:**
- `README.md`
- `CLAUDE.md`
- `MSYK-OVERVIEW.md`

**Folder indexes — what else exists and whether it is maintained:**
- `docs/README.md`
- `docs/implementations/README.md`

**Claude Code configuration — the workflows available to you in this repo:**
- `.claude/README.md`
- `.claude/commands/read-docs.md` (this file)
- `.claude/commands/update-all-docs.md`
- `.claude/commands/commit.md`
- `.claude/commands/make-pr.md`

### The two carve-outs

**1. `docs/implementations/*.md` (except its `README.md`) — skip.** These are frozen point-in-time records of a single past implementation. They are deliberately not maintained, so reading them builds a *false* picture of current behavior. Read one only if you are specifically investigating the history of that feature, and never treat it as a description of how the system works now. Do read `docs/implementations/README.md`, which explains the folder.

**2. `docs/apidocs.brivo.com_*.md` — do not read in Phase 1.** It is a ~12,700-line vendor API snapshot; reading it here would consume the context budget Phase 2 needs for the source. Read it on demand, when you actually work on the Brivo door access integration. Note its existence and move on.

### While reading

Note any claims that need verification against the code (e.g. "cron runs every 15s", "emails stored as lowercase", "seed only runs in development"). You will verify these in Phase 2.

Everything under `docs/` is reference material that may lag the code. When it disagrees with the source, the source wins, and that disagreement is **not** a discrepancy worth reporting — only the primary docs and the `.claude` files are held to being accurate.

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
- `app/utils/singleton.server.ts`

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
- `vite.config.ts`
- `tsconfig.json`
- `components.json`

**Routes — read all files in these directories:**

Run this to get the full list:
```bash
find app/routes -name "*.ts" -o -name "*.tsx" | sort
```

Then read every file in the list. Do not skip any route file.

---

## Phase 3 — Verify the documentation against what you read

Go through every factual claim in `README.md`, `CLAUDE.md`, and `MSYK-OVERVIEW.md` and check it against what you actually saw in the source files. Be honest. Do not rationalize discrepancies away.

Also check the `.claude` files, which must describe this repo accurately: does `.claude/README.md` list exactly the commands present in `.claude/commands/`, and do the file paths and doc names those commands reference still exist?

Do **not** report `docs/implementations/*` or the Brivo API snapshot as out of date — they are not maintained against the code by design.

Check at minimum:

- Every command listed in CLAUDE.md and README.md — does it match `package.json` scripts?
- Every `AdminSettings` key documented — does a matching string literal appear in the source? Are there keys in the source that the docs never mention?
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
- Every unique constraint claimed in the docs — does it actually exist in `schema.prisma`, or was it commented out?
- Every documented model function — is it actually `export`ed, or is it an internal helper?

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
- AdminSettings keys and their defaults

### Discrepancies Found
List every place where the documentation says something that does not match the code. Be specific: quote the doc claim and describe what the code actually does. If you found none, say so explicitly.

### Ready
One line confirming you have read all files and are ready to help with tasks in this codebase. Note explicitly which markdowns you skipped and why (the two carve-outs), so it is clear the omission was deliberate rather than an oversight.
