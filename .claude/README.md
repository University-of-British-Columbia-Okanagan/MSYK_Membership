# MSYK Membership Claude Code

**Last Updated:** August 23, 2026

Claude Code configuration for this repository. Contains custom slash commands and local settings.

---

## Documentation set

Three markdown files at the repo root are the maintained documentation for this project. Commands below refer to them by name:

- `README.md` — the single source of truth: setup, env vars, user documentation, architecture, database schema, model functions, route map, development patterns
- `CLAUDE.md` — quick reference and critical gotchas for agentic coding tools
- `MSYK-OVERVIEW.md` — functional overview, end-to-end workflows, test plan, and acceptance criteria

`tests/README.md` documents the test suite: layout, fixture conventions, and the workflow above as it applies to writing tests.

Supporting material lives in `docs/` — the root is reserved for the three docs above, so anything else worth reading goes there. `docs/README.md` indexes the folder and records whether each file is maintained. Today it holds a vendor Brivo API snapshot (never edited) and `docs/implementations/`, a folder of frozen one-off implementation write-ups.

---

## MCP servers

Configured in `.mcp.json` at the repo root. Project-scoped, so anyone who opens this repo in Claude Code gets them.

### playwright

**Package:** `@playwright/mcp@latest` (run via `npx`, stdio transport)

Drives a real Chromium browser. Use it to **verify a change actually works in the running app** rather than inferring it from the code — click through a flow, fill a form, read what the page renders, take a screenshot, check the console for errors.

Reach for it when:
- You changed a route, form, or component and want to confirm the rendered result
- A bug is described in terms of what the user sees ("the cancel button does nothing")
- You need to check a flow end to end — register, log in, book a slot — across pages
- You want to confirm an admin-only route actually redirects a non-admin

Notes for using it here:
- Start the app first (`npm run dev`) and browse to `http://localhost:5173`. The MCP server does not start the app for you
- `npm run dev` runs both the client and the cron server; the cron server is what flips workshop occurrence status, so start both when timing matters
- You need a seeded database to log in — `npx tsx seed.ts` (requires `NODE_ENV=development`)
- Chromium is already installed locally. If it is ever missing, `npx playwright install chromium`
- This is for **interactive verification**, not an automated test suite. Regression tests belong in `tests/` under Jest

---

## commands/

Custom slash commands defined as markdown files. Invoke them in Claude Code by typing the command name prefixed with `/`.

### /read-docs

**File:** `commands/read-docs.md`

Onboards Claude to the codebase at the start of a conversation by reading the docs *and* the source, then reporting where they disagree. Use this when starting fresh work on the repo.

What it does:
- Enumerates every markdown in the repo with `find`, then reads them all in full — the three primary docs, both folder indexes (`docs/README.md`, `docs/implementations/README.md`), and all five `.claude` files
- Reads the Prisma schema, every model, service, util, config, `entry.server.ts`, `seed.ts`, `package.json`, `app/routes.ts`, and every route file
- Skips exactly two things, deliberately: the frozen write-ups in `docs/implementations/` (reading them builds a false picture of current behavior) and the ~12,700-line Brivo API snapshot (read on demand instead, so it does not eat the context needed for the source)
- Verifies specific high-risk claims against the code — cron schedules, session behavior, role level logic, seed guard, Stripe sync hooks, Brivo degradation, `AdminSettings` keys, route map completeness, unique constraints, whether documented functions are actually exported
- Reports a verified understanding, an explicit list of discrepancies found (or states there were none), and which markdowns it skipped and why

### /update-all-docs

**File:** `commands/update-all-docs.md`

Audits and updates all affected markdown documentation after a code change. Invoke this whenever source code, schema, config, or scripts are modified and docs need to be kept in sync.

What it does:
- Detects changed files automatically via `git diff` and `git status`
- Reads every changed source file in full before writing anything (code is the source of truth)
- Enumerates every markdown with `find` so a newly added file cannot be missed, and updates all of them: the three primary docs, both folder indexes, and the `.claude` files when the command set or doc set changed
- Treats `docs/implementations/*.md` and the Brivo API snapshot as frozen and never rewrites them to match later code — a stale reference in a historical record is correct. `docs/implementations/README.md` is the exception and is maintained
- Greps all other markdowns for cross-references and updates or asks for confirmation on each
- Runs mechanical verification passes: every referenced path exists, every route is in the route map, every route file is registered, every documented function is actually exported, and every in-scope markdown was actually opened
- If a change introduces something with no existing doc home, notifies the user rather than creating files unilaterally
- Leaves all changes unstaged — does not auto-commit

### /commit

**File:** `commands/commit.md`

Groups changed files into logical commits, one at a time. Key rules it enforces:

- Reads `git status` and the full `git diff` before staging anything, and refuses to proceed on `main`
- Runs `npm run typecheck` before the first commit
- Never uses `git add .` or `git add -A` — always adds files by name
- Never commits `.env` or `.claude/settings.local.json`; **does** commit `.claude/README.md` and `.claude/commands/*.md`, which are shared config tracked in this repo
- Keeps coupled files together: a Prisma migration with its `schema.prisma` change, a route file with its entry in `app/routes.ts`
- Maximises the number of commits while keeping each one logically coherent — PRs here are merged, not squashed, so every commit lands on `main` and must stand alone. Documentation commits stay separate from code commits
- Writes commit messages in the format `type: description` — type is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`; description is imperative present tense, full message under 72 chars
- Does not add a Co-Authored-By line or any AI attribution
- Shows `git log --oneline -10` after all commits are done

### /make-pr

**File:** `commands/make-pr.md`

Creates a pull request into `main` for the current branch. Key rules it enforces:

- Reads `git log main..HEAD --oneline` and the full `git diff main...HEAD` before writing anything
- Runs `npm run typecheck` and `npm test` first, and flags a red branch rather than quietly opening the PR
- Flags when behavior, env vars, routes, schema, or `AdminSettings` keys changed but the docs were not touched — doc updates belong in the same PR
- Title follows the commit convention: `type: lowercase imperative description`, under 72 chars
- Body opens with `## Summary` or `## Overview`, then topical sections chosen to fit the change — matching how this repo actually writes PRs, rather than a fixed template
- Requires an explicit edge-cases section when the change has non-obvious boundary conditions; this is the strongest convention in the repo's PR history
- Does not include a test plan section, AI attribution, or a Co-Authored-By line
- Uses `gh pr create --base main` and returns the PR URL

---

## Typical flow

1. `/read-docs` at the start of a session to build a verified mental model
2. **Implement** the change
3. **Test it** — *add* test files for new functionality, or *update* the existing tests a change to existing functionality invalidated. Most changes are the latter
4. **Verify end to end** in a browser via the Playwright MCP server — a green unit test says the function behaves, only the browser says the feature works
5. **Run the full suite** (`npm test`) — it is currently fully green, so any failure is yours
6. `/update-all-docs` to bring the documentation back in line with the code
7. `/commit` to split the work into logical commits
8. `/make-pr` to open the pull request

Steps 2–5 are mandatory for every implementation. The full rules are in `CLAUDE.md`; `tests/README.md` covers the test folder itself.
