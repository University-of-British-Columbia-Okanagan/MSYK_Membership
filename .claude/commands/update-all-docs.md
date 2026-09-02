You are updating all affected markdown documentation in response to code changes in this repository. Follow every step exactly — do not skip or abbreviate anything.

---

## Step 1 — Detect what changed

Run the following to understand the full scope of changes:

```bash
git diff main...HEAD --name-only      # files changed vs main
git diff --name-only                  # uncommitted changes
git status                            # untracked new files
```

If there are no changes detected, tell the user and stop.

---

## Step 2 — Read ALL changed source files in full

For every changed file (code, config, scripts — not markdowns), read it completely. Do not skim. Do not summarize from memory. The code is the source of truth. If you do not read it, you cannot update docs accurately.

This includes:
- TypeScript/TSX source under `app/` — models, services, utils, routes, components, schemas, config, logging
- `prisma/schema.prisma` and anything under `prisma/migrations/`
- `entry.server.ts`, `seed.ts`, and scripts under `test-scripts/`
- Tests under `tests/`
- Root config: `package.json`, `app/routes.ts`, `vite.config.ts`, `tsconfig.json`, `components.json`, `jest.config.*`

Pay special attention to:
- New or modified Prisma models, fields, and unique constraints
- New or modified exported functions in `app/models/` and `app/services/`
- New environment variables (`process.env.*`) referenced anywhere
- New `AdminSettings` keys (string literals passed to `getAdminSetting`/`updateAdminSetting` or used as `key:` in a Prisma query)
- New cron jobs, `setInterval` timers, or startup hooks wired into `entry.server.ts`
- New or changed auth/session behavior in `app/utils/session.server.ts`
- New or changed role level / permission logic
- New routes — every route must be registered in `app/routes.ts`
- New transactional emails in `app/utils/email.server.ts`
- New or changed tests under `tests/` — `tests/README.md`, plus the Testing Strategy section in `README.md`, quote a live suite/test count and describe the directory layout. Get the real numbers from `npm test` rather than guessing, and update `CLAUDE.md` and `MSYK-OVERVIEW.md` too if the count is cited there

For each file you read, note:
- What it does now
- What it used to do (based on the diff)
- What doc sections are affected

---

## Step 3 — Identify the docs to update

First enumerate the markdowns that actually exist, so a file added since this command was written cannot be missed:

```bash
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | sort
```

Every file that returns is in scope **except** `docs/implementations/*.md` (other than its `README.md`) and `docs/apidocs.brivo.com_*.md` — see "The `docs/` folder" below. If the command returns a markdown not covered by the table, decide where it fits and add a row for it per Step 8b.

| File | What to focus on |
|------|-----------------|
| `README.md` | The single source of truth. Setup, env vars, user documentation, architecture, core system concepts, database schema, components, model functions, development patterns, testing, route map, common tasks |
| `CLAUDE.md` | Quick-reference commands, critical notes/gotchas, condensed project structure, documentation index |
| `MSYK-OVERVIEW.md` | Functional workflows, feature descriptions, business logic, end-to-end workflows, test plan, acceptance criteria |
| `.claude/README.md` | Update if a slash command was added, removed, or changed |
| `.claude/commands/*.md` | Update if the workflow a command describes changed (e.g. a doc was renamed, a new doc joined the primary set) |
| `.mcp.json` | Not a doc, but if an MCP server is added, removed, or reconfigured, update the Playwright/MCP sections in `README.md`, `CLAUDE.md`, and `.claude/README.md` to match |
| `tests/README.md` | Documents the test suite: layout, fixture conventions, and the implement → test → verify workflow. Update when a test directory or fixture domain is added, a convention changes, or the suite/test count moves |
| `docs/README.md` | The index of the `docs/` folder. Update **only** if a file was added to, removed from, or renamed within `docs/` — add or fix its row in the Contents table. Do not update it for ordinary code changes |
| `docs/implementations/README.md` | Explains what the implementations folder is for. It is maintained (unlike the write-ups beside it). Update only if the folder's purpose or conventions change, or a file is added to or removed from it |

### The `docs/` folder

The repo root is reserved for the three primary docs, so all other supporting documentation lives in `docs/`. Its contents are **not maintained against the code** — they are reference material, not descriptions of current behavior:

- `docs/apidocs.brivo.com_*.md` — vendor API reference snapshot. **Never edit it.** Read it when working on the Brivo door access integration
- `docs/implementations/*.md` — **frozen point-in-time records** of a single implementation. Do not update them to reflect later code changes. The one exception is `docs/implementations/README.md`, which explains the folder and *is* maintained

Two rules follow from this:

1. **Never link to an individual unmaintained file from a primary doc** — those links go stale. Reference the folder (`docs/implementations/`) or the index (`docs/README.md`) instead. The one exception is the Brivo API snapshot, whose filename is fixed
2. **When behavior described in `docs/` changes, update the primary docs, not the file in `docs/`.** Leave the historical record alone

---

## Step 4 — Read each primary doc before editing it

For every doc you intend to update, read its full current content first. Never overwrite content you haven't read.

---

## Step 5 — Update primary docs

Apply the changes. Hold yourself to these standards:

- **The code is the only source of truth.** Every route, model function, field name, environment variable, `AdminSettings` key, cron schedule, and behavior you write must come directly from the source files you read in Step 2. If you are not certain about something, say so rather than guessing.
- **Do not remove accurate existing content** unless the code confirms it is now wrong or removed.
- **Do not document a function as existing unless you saw its `export`.** Internal helpers should be described as internal.
- **Follow established conventions:**
  - Sentences in doc body prose may have periods; table cells and bullets do not
  - Code identifiers, file paths, env vars, and settings keys go in backticks
  - Cron schedules are written with both the human reading and the raw expression, e.g. "every 15 seconds (`*/15 * * * * *`)"
  - Route map tables are `| Path | File |` with the file path relative to `app/`

---

## Step 6 — Search all other markdowns for cross-references

Run a grep across all markdown files for references to the changed function names, route paths, field names, env vars, and settings keys:

```bash
grep -rn "<changed-term>" . --include="*.md" --exclude-dir=node_modules
```

Run this for each changed term.

This grep intentionally covers **every** markdown in the repo, including ones not in the Step 3 table.

For every markdown file that contains a reference:
- Read the full file
- Determine whether the reference is now inaccurate
- If yes: update it — **unless** it is `docs/implementations/*.md` (other than its `README.md`) or the Brivo API snapshot. A stale reference in a frozen record is correct: it reflects what was true when the record was written. Leave it
- If you are uncertain whether it needs updating: **ask the user before editing**. Show them the current text and what you think it should say, and wait for their answer before proceeding.

---

## Step 7 — Verify the docs mechanically

Before reporting, run these checks and fix anything they surface:

```bash
# Every file path referenced in the docs must exist
for doc in README.md CLAUDE.md MSYK-OVERVIEW.md docs/README.md .claude/README.md; do
  echo "=== $doc — referenced paths that do not exist ==="
  grep -ohE '`?(app|prisma|tests|test-scripts|public|docs)/[A-Za-z0-9_./:*-]+' "$doc" \
    | tr -d '`' | sed 's/[.,)]*$//' | sort -u | while read p; do
        case "$p" in *'*'*) continue;; esac
        [ -e "$p" ] || echo "  $p"
      done
done

# Every route in routes.ts must appear in the README route map
grep -oE '"routes/[^"]+"' app/routes.ts | tr -d '"' | sort -u | while read f; do
  grep -qF "$f" README.md || echo "MISSING FROM ROUTE MAP: $f"
done

# Every route file on disk must be registered
find app/routes -name "*.ts" -o -name "*.tsx" | sed 's|^app/||' | sort | while read f; do
  grep -qF "\"$f\"" app/routes.ts || echo "UNREGISTERED ROUTE FILE: $f"
done

# Documented model functions must actually be exported
grep -oE '`[a-z][A-Za-z0-9_]+\(\)`' README.md | tr -d '`()' | sort -u | while read fn; do
  grep -rqE "export (async )?(function|const) $fn\b|export \{[^}]*\b$fn\b" app/ || echo "NOT EXPORTED: $fn"
done

# Every in-scope markdown should have been considered — list them all
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" \
  -not -path "./docs/implementations/*" -not -name "apidocs.brivo.com_*" | sort
# docs/implementations/README.md is in scope despite that exclusion — check it separately
```

Confirm you actually considered every file that last command lists. "Considered" means you opened it and concluded it needed no change — not that you never looked at it. Anything you did not open goes in the "Not changed" section of your report only if you genuinely checked it.

Two expected classes of false positive:

- A name flagged by the last check may be a legitimately internal helper (e.g. `generateSignedWaiver`, `generateResetToken`) or a framework import (`redirect`). Reword the doc to say so rather than deleting the mention — and note that a doc may legitimately mention a function *in order to say it does not exist*, as `README.md` does for `requireAuth()`.
- `MSYK-OVERVIEW.md`'s "Need Jest Tests" table names test files that have not been written yet. Those paths are supposed to be missing; leave them.

---

## Step 8 — Handle genuinely new features with no existing home

If a change introduces something that has no doc coverage anywhere:
1. First try to fit it into an existing doc (a new route goes in the README route map plus the relevant feature section; a new workflow goes in MSYK-OVERVIEW.md)
2. If it is a self-contained one-off implementation worth recording separately, that is what `docs/implementations/` is for — **notify the user** with a suggested file name and wait for confirmation before creating it

---

## Step 8b — Self-maintain this command

After all doc updates are done, check whether anything changed that should update this file itself:

1. **New markdown files added:** Run `git status` and `git diff main...HEAD --name-only` and look for newly added `.md` files that describe the system. If any exist, read the file, decide whether it belongs in Step 3's table, and add it with a one-line description of when to update it.
2. **Markdown files deleted or renamed:** If a doc in Step 3's table was deleted or renamed, remove or update its entry.
3. **Slash commands added, removed, or renamed:** Update `.claude/README.md` to match.
4. **Files added to, removed from, or renamed within `docs/`:** Update the Contents table in `docs/README.md`, and `docs/implementations/README.md` if the change was in that subfolder.

Apply these changes to `.claude/commands/update-all-docs.md` and `.claude/README.md` directly — do not ask the user for confirmation. These are mechanical structural updates, not content decisions.

---

## Step 9 — Report what you did

At the end, show a clear summary:

**Updated:**
- List every file changed and one sentence on what was updated

**Confirmed with user:**
- List any uncertain updates the user approved or rejected

**Could not fit in existing docs (user notified):**
- List anything genuinely new that has no existing doc home

**Not changed:**
- List any files that had references but were checked and confirmed accurate

Do not run `/commit` — leave all changes unstaged for the user to review.
