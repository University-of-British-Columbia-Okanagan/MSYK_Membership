# Implementation Notes

One-off write-ups for individual implementations — a feature, a migration, an integration — captured at the time the work was done.

## What belongs here

A file in this folder documents **a single piece of work**: what was built, the decisions taken, the schema or API surface it introduced, and how to test or roll it back. It is written once, when the work lands.

## What these files are not

**They are point-in-time records, not maintained documentation.** They are deliberately *not* kept in sync with later code changes, and they may describe behavior that has since moved on. Do not treat a file here as a description of how the system works today.

For current, maintained documentation, use the three root-level docs instead:

- [README.md](../../README.md) — the single source of truth: setup, env vars, architecture, database schema, model functions, route map, development patterns
- [CLAUDE.md](../../CLAUDE.md) — quick reference and critical gotchas for agentic coding tools
- [MSYK-OVERVIEW.md](../../MSYK-OVERVIEW.md) — functional overview, end-to-end workflows, test plan

## Conventions

- One file per implementation, named after the thing that was built (e.g. `stripe-product-sync.md`)
- Do not link to individual files here from the maintained docs — those links go stale as the code moves. Link to this folder instead
- When a feature documented here becomes permanent behavior, describe that behavior in the maintained docs; leave the file here as the historical record
