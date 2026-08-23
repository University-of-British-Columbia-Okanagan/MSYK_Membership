You are orienting yourself in this codebase at the start of a conversation. The goal is a **working** mental model — accurate about the things that bite, and honest about what you have not looked at — reached without spending the context budget the actual task needs.

**Budget: aim to finish this in well under 10% of your context window.** If you find yourself reading a third large source file directly, stop — that is what the subagents in Phase 2 are for.

The old version of this command read every markdown and all ~52,000 lines of source into the main context. That produced a great summary and left almost no room to do the work. Do not do that. The rule now is:

> **Read cheap, structured things yourself. Delegate expensive, unstructured reading to subagents. Read a specific file in full only when the task actually touches it.**

---

## Phase 0 — Orientation (do this yourself, it is cheap)

`CLAUDE.md` is already in your context — it is loaded automatically. **Do not read it again.**

Read these two in full. They are short and they govern how you are expected to work:

- `tests/README.md` — test layout, fixture conventions, the import-ordering rule, the failure modes that have actually bitten here
- `.claude/README.md` — the slash commands and MCP servers available in this repo

Then enumerate what else exists, so a file added since this command was written cannot be missed:

```bash
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | sort
```

Do **not** read `README.md` or `MSYK-OVERVIEW.md` cover to cover. Instead, index them so you can jump straight to the right section later:

```bash
grep -n '^#\{1,3\} ' README.md MSYK-OVERVIEW.md
```

Treat that heading index as a table of contents. When a task touches memberships, you read the membership section then — not now.

### Files you deliberately do not read

- **`docs/implementations/*.md`** (except its `README.md`) — frozen point-in-time records of one past implementation. They are not maintained, so reading them builds a *false* picture of current behaviour. Open one only when investigating that feature's history.
- **`docs/apidocs.brivo.com_*.md`** — a ~12,700-line vendor API snapshot. Read it on demand, when you actually work on the Brivo door access integration.
- **The six largest route files** — `adminsettings.tsx` (~7.8k lines), `editworkshop.tsx` (~3.9k), `workshopdetails.tsx` (~2.5k), `addworkshop.tsx` (~2.3k), `profile.tsx` (~2.2k), `adminreports.tsx` (~1.7k). Their loaders and actions are worth reading when relevant; their JSX almost never is. Use `awk '/^export async function (loader|action)/,/^export default/'` to pull just the server logic.

---

## Phase 1 — Generate a structural map (cheap, high signal)

These commands produce a dense picture of the system for a tiny fraction of the tokens that reading the source costs. Run them and keep the output.

```bash
# Scripts, deps, and the shape of the data model
sed -n '/"scripts"/,/}/p' package.json
grep -n '^model \|^  @@unique\|^  @@index' prisma/schema.prisma

# Every route path → file, in one table
grep -oE 'route\("[^"]+", "[^"]+"' app/routes.ts | sed 's/route(//;s/"//g'

# The public surface of the business logic
grep -rn '^export \(async \)\?\(function\|const\) ' app/models app/services app/utils app/config

# The things the docs most often get wrong
grep -rn 'cron.schedule\|setInterval(' app/ entry.server.ts
grep -rhoE 'process\.env\.[A-Z0-9_]+' app/ entry.server.ts seed.ts | sed 's/process\.env\.//' | sort -u
grep -rhoE 'getAdminSetting\(\s*"[a-z0-9_]+"|key: "[a-z0-9_]+"' app/ | grep -oE '"[a-z0-9_]+"' | sort -u
```

Between the heading index and this map you now know *what exists and where*. That is enough to start most tasks.

---

## Phase 2 — Delegate the deep reading to subagents

Spawn these **in parallel**, in the background, as `Explore` agents. The point is that ~50k lines get read in *their* context and only a compact brief comes back to yours.

Give every one of them this instruction verbatim: **"Return at most 40 lines. Dense prose or bullets, no code blocks, no file dumps. Cite `file.ts:line` for anything specific. Report what the code actually does, not what you would expect it to do."**

1. **Business logic** — read `app/models/*.server.ts` and `app/services/*.server.ts`. Report: how role levels are computed and synced; the membership lifecycle (subscribe, upgrade, downgrade, cancel, resubscribe, revoke) and what the billing cron does; workshop registration, capacity, and cancellation; equipment booking and refund rules; where Stripe and Brivo are called from.
2. **Request layer** — read `app/routes/**`, prioritising every `loader` and `action`. Report: how each route authorises (`getRoleUser` / `getUser` / `getUserId` and what it redirects to on failure); which routes are admin-only; the payment routes and what they gate on; anything that looks inconsistent between sibling branches.
3. **Auth, session, and config** — read `app/utils/session.server.ts`, `app/config/access-control.ts`, `entry.server.ts`, `seed.ts`, and `app/utils/email.server.ts` exports only. Report: exact session behaviour, the seed guard, what starts at boot, and the list of transactional emails with their triggers.

Wait for all three, then reconcile their briefs against the heading index from Phase 0. Where a brief and a doc disagree, **the code wins** — note it for Phase 4.

If the task you were given is narrow and you already know which subsystem it touches, run only the subagent that covers it. Three is the maximum, not a quota.

---

## Phase 3 — Mechanical verification (seconds, near-zero tokens)

These catch the drift that matters most and cost almost nothing. Run them:

```bash
# Every route file registered, and every route in the README map
find app/routes -name "*.ts" -o -name "*.tsx" | sed 's|^app/||' | sort | while read f; do
  grep -qF "\"$f\"" app/routes.ts || echo "UNREGISTERED ROUTE FILE: $f"; done
grep -oE '"routes/[^"]+"' app/routes.ts | tr -d '"' | sort -u | while read f; do
  grep -qF "$f" README.md || echo "MISSING FROM ROUTE MAP: $f"; done

# Documented functions that are not actually exported
grep -oE '`[a-z][A-Za-z0-9_]+\(\)`' README.md | tr -d '`()' | sort -u | while read fn; do
  grep -rqE "export (async )?(function|const) $fn\b|export \{[^}]*\b$fn\b" app/ || echo "NOT EXPORTED: $fn"; done

# Referenced paths that do not exist
for doc in README.md CLAUDE.md MSYK-OVERVIEW.md tests/README.md .claude/README.md; do
  grep -ohE '`?(app|prisma|tests|test-scripts|public|docs)/[A-Za-z0-9_./:*-]+' "$doc" \
    | tr -d '`' | sed 's/[.,)]*$//' | sort -u | while read p; do
        case "$p" in *'*'*) continue;; esac
        [ -e "$p" ] || echo "$doc: MISSING PATH $p"
      done; done
```

Three false positives are expected and are **not** findings: `redirect` (a framework import), `requireAuth` (README names it precisely to say it does not exist), and the "Need Jest Tests" paths in `MSYK-OVERVIEW.md` (tests not yet written, deliberately absent).

**Do not** run a claim-by-claim audit of the prose. `/update-all-docs` keeps the docs honest as code changes; a full audit is something the user asks for explicitly.

---

## Phase 4 — Report, briefly

Keep the whole report under ~40 lines. You are confirming readiness, not demonstrating effort.

**How it works** — one tight paragraph per area you actually covered: stack, auth/session, role levels, cron jobs, workshops, equipment, memberships, payments, door access. Cite `file.ts:line` for anything a reader might want to check.

**Worth knowing** — the gotchas that would cause you to write wrong code: constraints that are commented out, misspelled settings keys, values the schema comment describes wrongly, guards that exist in one branch but not its sibling.

**Drift found** — anything Phase 2 or Phase 3 surfaced where a maintained doc disagrees with the code. Quote the claim, state what the code does. Say "none" if there was none. Do not report `docs/implementations/*` or the Brivo snapshot — they are unmaintained by design.

**Not read** — name what you skipped: the two carve-outs above, the JSX of the large route files, and any subsystem whose subagent you chose not to run. Being explicit here is what makes the rest of the report trustworthy.

Then stop and start the actual work. Read the specific files that work touches, when you touch them.
