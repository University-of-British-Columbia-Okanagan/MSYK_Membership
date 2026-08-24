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
- You need a seeded database to log in — `npx tsx seed.ts` (requires `NODE_ENV=development`). It creates `testuser1@gmail.com` (**admin**) through `testuser6@gmail.com`, all with the password `password`: 1–3 are role level 1, then `testuser4` is level 2, `testuser5` level 3, and `testuser6` level 4. Those levels come from real seeded rows (passed orientation, active membership, `allowLevel4`), so the sync cron leaves them alone — but for the same reason, hand-editing `roleLevel` is reverted within 15s
- **Check mobile.** Resize the browser to a phone-width viewport and look at the page. Mobile responsiveness is required of every UI change here, and it is the thing most often missed
- **Ask if you are blocked.** If driving the flow needs something you do not have — a test card, a sandbox credential, a record in a particular state, a decision about what should happen — ask for it rather than skipping the verification
- Chromium is already installed locally. If it is ever missing, `npx playwright install chromium`
- The server drops page snapshots and console logs into `.playwright-mcp/` as you drive it. That directory is gitignored — do not commit it
- This is for **interactive verification**, not an automated test suite. Regression tests belong in `tests/` under Jest

---

## commands/

Custom slash commands defined as markdown files. Invoke them in Claude Code by typing the command name prefixed with `/`.

### /read-docs

**File:** `commands/read-docs.md`

Orients Claude in the codebase at the start of a conversation, cheaply. Use this when starting fresh work on the repo.

It is explicitly budgeted: **under 10% of the context window**. An earlier version read every markdown and all ~52,000 lines of source into the main context — it produced an excellent summary and left almost nothing to actually work with. The current version keeps the coverage and moves the cost off the main thread.

What it does:
- **Phase 0 — orientation.** Skips `CLAUDE.md` (already auto-loaded), reads `tests/README.md` and `.claude/README.md` in full, enumerates every markdown with `find`, and indexes `README.md` / `MSYK-OVERVIEW.md` by heading rather than reading them cover to cover — so it can jump to the right section when a task needs it
- **Phase 1 — structural map.** A handful of `grep`/`sed` commands that yield the data model, the full route table, every exported model/service function, cron schedules, env vars, and `AdminSettings` keys — the shape of the system for a fraction of the tokens the source costs
- **Phase 2 — delegated deep reading.** Up to three `Explore` subagents in parallel (business logic, request layer, auth/config), each capped at a 40-line brief. The ~50,000 lines are read in *their* context; only the briefs reach the main one. Fewer subagents when the task is narrow
- **Phase 3 — mechanical verification.** Four cheap shell checks: every route file registered, every route in the README map, documented functions actually exported, referenced paths exist. It does **not** audit the prose claim by claim — `/update-all-docs` keeps docs honest as code changes, and a full audit is something you ask for explicitly
- **Phase 4 — a report under ~40 lines**, ending with an explicit list of what it did *not* read, then the standing invitation to ask clarifying questions before implementation begins

Deliberate omissions, in the command itself: the frozen write-ups in `docs/implementations/` (reading them builds a false picture of current behavior), the ~12,700-line Brivo API snapshot (read on demand), and the JSX of the six largest route files (their loaders and actions are read; their markup is not).

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
2. **Ask first** — put your clarifying questions to the maintainer before implementing anything non-trivial: *"ask me any clarifying questions and anything you need from me to do this, we are a team."* Scope, edge cases, a choice between two designs, credentials you lack — all cheaper to settle now
3. **Implement** the change — mobile responsive, with short comments that earn their line (see `CLAUDE.md`)
4. **Test it** — *add* test files for new functionality, or *update* the existing tests a change to existing functionality invalidated. Most changes are the latter
5. **Verify end to end** in a browser via the Playwright MCP server, at desktop *and* mobile width — a green unit test says the function behaves, only the browser says the feature works
6. **Run the full suite** (`npm test`) — it is currently fully green, so any failure is yours
7. `/update-all-docs` to bring the documentation back in line with the code
8. `/commit` to split the work into logical commits
9. `/make-pr` to open the pull request

Steps 3–6 are mandatory for every implementation, and step 2 is what keeps them from being wasted. If any of them needs something only the maintainer can supply — a credential, a seeded record, a level 3/4 account, a ruling on expected behaviour — ask for it instead of working around it. The full rules are in `CLAUDE.md`; `tests/README.md` covers the test folder itself.
