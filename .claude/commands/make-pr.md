Create a pull request into `main` for the work on the current branch. Follow these rules exactly.

---

## Step 1 — Understand what the branch actually does

```bash
git branch --show-current
git log main..HEAD --oneline     # every commit on this branch
git diff main...HEAD --stat      # scope of the change
git diff main...HEAD             # the full diff
```

**Read the full diff.** Do not summarize from memory or from commit messages alone — the PR body must describe what the code does, and reviewers will read the diff next to it.

If the branch is `main`, or `git log main..HEAD` is empty, stop and tell the user.

---

## Step 2 — Pre-flight checks

```bash
npm run typecheck
npm test
```

If either fails, tell the user what failed and ask whether to continue. Do not open a PR on a red branch without saying so.

Then confirm the branch is pushed:

```bash
git push -u origin HEAD
```

Also check that documentation kept up. If this branch changed behavior, env vars, routes, schema, `AdminSettings` keys, or model functions and the docs were not touched, say so — `/update-all-docs` exists for this, and doc updates belong in the same PR as the code.

---

## Step 3 — Write the title

`type: lowercase imperative description`

Same `type` vocabulary as commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Under 72 characters. Describe the change, not the implementation.

From this repo's merged PRs:

```
feat: workshop cancellation UX improvements
feat: admin ability to move users to a different workshop/orientation date
fix: edge case fixes for admin cancel registration
```

---

## Step 4 — Write the body

This repo's PR bodies are substantive prose, not a bullet dump. Match that.

**Required opening section** — `## Summary` or `## Overview`. State what changed and *why*. If the change replaces an existing workflow, say what people had to do before. One paragraph, or bullets, or both.

**Then topical sections with descriptive `##` / `###` headings** chosen to fit the change. Do not force a fixed template. Headings this repo has used:

- `## What's changing`
- `## Edge cases handled`
- `### New Behaviour`
- `### Workshop Type Coverage`
- `### Email`
- `## Bug Fixes`
- `## Files Changed`

**Document edge cases explicitly.** This is the strongest convention in the repo's PR history — reviewers expect to see which boundary conditions you considered and how each is handled (guards, validation, states that are rejected server-side). If your change has non-obvious edge cases, give them their own section.

**Style:**
- Code identifiers, file paths, routes, field names, and settings keys in backticks
- **Bold** for the key term introducing a bullet
- Reference concrete symbols and paths (`checkWorkshopCapacity`, `/dashboard/admin/workshop/:workshopId/users`, `result: { not: "cancelled" }`) rather than vague description
- If the branch adds a Prisma migration, call it out — reviewers need to know a deploy requires `prisma migrate deploy`

**Do NOT include:**
- A test plan section
- A "Generated with Claude Code" line or any other AI attribution
- A `Co-Authored-By` line

---

## Step 5 — Create it

```bash
gh pr create --base main --title "<title>" --body "<body>"
```

Return the PR URL when done.
