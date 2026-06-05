You are updating the project documentation after a feature branch has been implemented. Your job is to make the docs truthful — not aspirational, not stale. Every claim you write must be traceable to code you personally read during this session.

## Rules

1. **Read before you write.** Do not update any documentation file until you have read the source files that justify the update.
2. **Branch-scoped.** You are documenting what changed in *this branch* vs main. Focus on the diff. Do not rewrite sections unrelated to the changes.
3. **Cite your evidence.** For every update you make, you must have read the relevant file. If you're unsure, re-read it.
4. **Remove stale content.** If existing docs describe something the new code contradicts or replaces, correct or remove it.
5. **Do not invent.** Do not document features, flags, patterns, or behaviors you did not observe in actual files.

---

## Phase 1 — Understand what changed in this branch

Run these commands to get the full picture of what this branch adds or modifies:

```bash
# What branch are we on and what commits are new
git log main..HEAD --oneline

# What files were changed vs main
git diff main..HEAD --name-only

# Full diff for context (to understand intent, not to substitute for reading files)
git diff main..HEAD --stat
```

Study the output carefully before proceeding. Build a mental model of what this branch does.

---

## Phase 2 — Read every changed source file in full

From the file list in Phase 1, read every changed or added source file (`.ts`, `.tsx`, `.prisma`) in full. Do not skip files. If a file is long, read it in chunks.

Pay special attention to:
- New or modified Prisma models in `prisma/schema.prisma`
- New or modified model functions in `app/models/`
- New or modified services in `app/services/`
- New or modified utilities in `app/utils/`
- New or modified routes in `app/routes/`
- New environment variables referenced in any file
- New cron jobs, background tasks, or startup hooks
- New or changed auth/session behavior
- New or changed role/permission logic

For each file you read, note:
- What it does now
- What it used to do (based on the diff)
- What doc sections are affected

---

## Phase 3 — Read the existing documentation

Read all four documentation files in full before making any changes:

- `CLAUDE.md`
- `PROJECT.md`
- `README.md`
- `docs/msyk-overview.md`

Note which sections are outdated, missing the new feature, or contradicted by what you read in Phase 2.

---

## Phase 4 — Update the docs

Update only the sections affected by this branch's changes. Do not rewrite unrelated sections.

| File | What to focus on |
|------|-----------------|
| `CLAUDE.md` | Quick-reference commands, critical notes, project structure if it changed |
| `PROJECT.md` | Architecture, models, services, integrations, route map, env vars |
| `README.md` | Setup instructions, user documentation, system architecture, database schema |
| `docs/msyk-overview.md` | Functional workflows, feature descriptions, business logic |

For each affected section:
- Add documentation for real features/patterns/flows introduced in this branch
- Correct any commands, file paths, model names, or descriptions made wrong by this branch
- Remove or update any content that the new code replaces or contradicts

If this branch adds a new database migration, document the new models and fields.
If this branch adds a new env var, add it to the env var tables in PROJECT.md and README.md.
If this branch adds a new route, add it to the route map in PROJECT.md.
If this branch adds a new cron job or background task, add it to the cron jobs table in PROJECT.md and CLAUDE.md.

---

## Phase 5 — Verify

After updating, re-read each doc you changed. For every claim, ask: "Can I point to a specific file that justifies this?" If not, fix it.

Then run:

```bash
# Confirm the docs you changed
git diff --name-only
```

List the files you updated and one-line summary of what changed in each.
