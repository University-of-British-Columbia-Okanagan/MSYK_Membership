# Opus 4.7 — Full Codebase Documentation Audit Prompt

Paste this entire prompt into a Claude Opus 4.7 session to run a documentation audit.

---

Use extended thinking for this entire task. Think deeply and carefully at every step before acting. Do not shortcut or skim.

You are auditing and updating the documentation for this codebase. Your job is to make the docs truthful — not aspirational, not stale. Every claim you write must be traceable to code you personally read during this session.

## Rules

1. **Read before you write.** Do not update any documentation file until you have read the source files that justify the update.
2. **Cite your evidence.** For each change you make, you must have seen the relevant logic in an actual file. If you're unsure, re-read the file.
3. **Remove stale content.** If docs describe something you cannot find in the code, remove or correct it.
4. **Do not invent.** Do not document features, flags, patterns, or behaviors you did not personally observe in the code.

## Process

**Phase 1 — Map the codebase**

Run the following to get the full file list. Study the structure before reading anything.

```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.prisma" -o -name "*.json" \) \
  | grep -v node_modules | grep -v .git | grep -v dist | sort
```

**Phase 2 — Read systematically**

Read every file in these directories in full, in order:

- `prisma/schema.prisma` — full schema
- `app/models/` — all server models
- `app/services/` — all service files
- `app/utils/` — all utilities
- `app/routes/` — all route files (loaders, actions, components)
- `app/config/` — all config files
- `app/logging/` — logger setup
- `app/layouts/` — layout components
- `app/components/` — UI components
- Root config files: `package.json`, `vite.config.ts`, `react-router.config.ts`, `tsconfig.json`

Do not skip files. If a file is long, read it in chunks until you have read all of it.

**Phase 3 — Read existing docs**

Read these four documentation files in full before making any changes:

- `CLAUDE.md`
- `PROJECT.md`
- `README.md`
- `docs/msyk-overview.md`

**Phase 4 — Update docs**

Update only these four files to match reality:

| File | What to focus on |
|------|-----------------|
| `CLAUDE.md` | Quick-reference commands, project structure, critical notes |
| `PROJECT.md` | Architecture, models, services, integrations, route map, env vars |
| `README.md` | Setup instructions, user documentation, system architecture, database schema |
| `docs/msyk-overview.md` | Functional workflows, feature descriptions, business logic |

For each file:

- Correct any commands, file paths, model names, or architectural descriptions that are wrong
- Add documentation for real features/patterns/flows you found but are not documented
- Remove documentation for things you could not find in the code

**Phase 5 — Verify**

After updating, re-read each doc you changed and ask: "Can I point to a specific file and line that justifies every claim in here?" If not, fix it.

## What to document

- Actual commands that work (verify against `package.json` scripts)
- Actual environment variables referenced in code
- Actual database models and their fields (from `schema.prisma`)
- Actual integrations and which files implement them
- Actual auth/session behavior
- Actual cron jobs and their intervals
- Actual role/permission logic
- Actual API routes and what they do
- Any TODOs, known limitations, or in-progress work found in the code

Begin now. Think carefully at each phase before proceeding.
