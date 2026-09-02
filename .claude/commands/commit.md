Group the changed files into logical commits and commit them one at a time. Follow these rules exactly.

---

## Before staging anything

```bash
git status                 # all changed and untracked files
git diff                   # unstaged changes
git diff --staged          # anything already staged
git branch --show-current  # confirm you are not on main
```

Read the diff. Do not commit changes you have not read.

**If you are on `main`, stop and tell the user.** Work on this repo goes through a branch and a PR — see `/make-pr`. Branch names follow `type/kebab-description` (e.g. `feat/admin-move-workshop-registration`, `fix/registration-success-redirect`, `bug/equipment-booking-management-fixes`).

**Run `npm test` and `npm run typecheck` before the first commit.**

- `npm test` — the suite is fully green (37 suites / 515 tests). A failure after your change is a regression you introduced; fix it before committing rather than committing over it
- `npm run typecheck` — regenerates React Router types and type-checks the project. Three pre-existing errors in `old/webhooks.server.ts` are known and unrelated

If either fails for a reason genuinely unrelated to your change, say so explicitly and continue.

Every implementation here follows **implement → test → verify end to end**, so a feature or fix commit should normally carry its tests alongside the code — new tests for new functionality, updated tests where existing behaviour changed. If you have not driven the change in a browser via the Playwright MCP server, say so rather than implying it was verified. See the workflow in `CLAUDE.md` and the conventions in `tests/README.md`.

---

## What to stage

- **Never use `git add .` or `git add -A`.** Always add files by name
- **Never commit `.env`.** It is gitignored; if it appears in `git status`, stop and tell the user
- **Never commit `.claude/settings.local.json`** — personal machine settings, not shared config
- **Do commit `.claude/README.md` and `.claude/commands/*.md`.** These are shared team configuration and are tracked in this repo. `/update-all-docs` maintains them, so they legitimately change alongside code
- Build artifacts, `node_modules/`, `logs/*`, `public/images_custom`, `public/uploads/issues/*`, and `.playwright-mcp/` (Playwright MCP session snapshots and console logs) are gitignored — if any shows up in `git status`, something is wrong; tell the user rather than committing it

### Files that must travel together

- **A Prisma migration and the schema change that produced it.** `prisma/schema.prisma` and the new directory under `prisma/migrations/` go in the same commit — a schema change without its migration leaves the repo unmigratable
- **A route file and its registration in `app/routes.ts`.** A route that exists but is not registered is dead code
- **A new model function and the route that calls it**, only when the function is meaningless on its own; otherwise commit the model layer first

---

## How to split

Maximize the number of commits while keeping each one logically coherent. PRs in this repo are merged with merge commits, not squashed, so every commit you write lands on `main` permanently and is read on its own later. Each one must stand alone.

- If a file stands alone, commit it alone
- If two files are tightly coupled — a helper and its test, or two files changed for the same reason — commit them together
- **Keep documentation commits separate from code commits.** This repo consistently does this (e.g. `feat: add admin cancel registration to workshop users page` followed by `docs: document admin cancel registration feature`)
- When in doubt, one file per commit is fine

---

## Message format

`type: description`

- **type** is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`
- **description** is imperative present tense and says what the commit does and why — not what you did
- Keep the whole message under 72 characters
- Lowercase after the colon; no trailing period
- **Do NOT add a `Co-Authored-By` line.** This repo has never used one and does not want one
- Do not add any other AI attribution

Good, from this repo's history:

```
feat: add sendAdminWorkshopMoveEmail notification
fix: exclude cancelled registrations from capacity checks
refactor: use Response.json in issue report action
docs: document admin cancel registration feature
chore: drop unused remix json import from adminsettings
test: remove stale mocks of unimported remix module
```

---

## After all commits

```bash
git log --oneline -10
```

Show the user the final commit list. Do not push and do not open a PR unless asked — `/make-pr` handles that.
