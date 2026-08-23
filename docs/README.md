# docs/

Supporting documentation for the MSYK Membership Management System.

The repo root is reserved for the three primary docs — [README.md](../README.md), [MSYK-OVERVIEW.md](../MSYK-OVERVIEW.md), and [CLAUDE.md](../CLAUDE.md). Everything else that is worth reading lives here.

Being in `docs/` rather than the root says nothing about how useful a file is — only that it is supporting material rather than one of the three entry points. Several files here are the best (or only) source for what they cover, and are worth reading when you touch the area they describe.

## Contents

| Path | What it is | Maintained? |
|------|-----------|-------------|
| [apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md](./apidocs.brivo.com_.2025-11-25T01_49_47.688Z.md) | Vendor snapshot of the Brivo API reference, captured 2025-11-25. The authoritative description of the endpoints `app/services/brivo.server.ts` calls — read it before changing the door access integration | No — vendor content, never edit |
| [implementations/](./implementations/) | Point-in-time write-ups of individual implementations, each written once when the work landed | No — see [implementations/README.md](./implementations/README.md) |

## What belongs in docs/

- **Vendor and third-party references** — API snapshots, spec exports, integration guides pulled from an external provider
- **Implementation write-ups** — one-off records of a specific piece of work, in [implementations/](./implementations/)
- **Any long-form supporting material** that a developer would want when working in a particular area, but that would crowd the root if promoted there

## What does not belong in docs/

- **Current system behavior.** How the system works today belongs in the root docs: architecture, schema, model functions, env vars, and the route map in [README.md](../README.md); workflows and business logic in [MSYK-OVERVIEW.md](../MSYK-OVERVIEW.md); gotchas and quick reference in [CLAUDE.md](../CLAUDE.md)
- **Anything that must stay in sync with the code.** If it needs updating every time the code changes, it belongs in a root doc where the `/update-all-docs` command will keep it honest

## Adding a file here

Add a row to the Contents table above, and say plainly in the new file whether it is maintained. If it is a one-off implementation record, put it in [implementations/](./implementations/) instead and follow that folder's conventions.

Do not link to an individual unmaintained file from the root docs — those links go stale as the code moves. Link to the folder instead.
