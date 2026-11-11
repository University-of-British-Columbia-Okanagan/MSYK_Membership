/**
 * Re-anchor stored session times when the business timezone's rules change,
 * so every future session keeps the wall-clock time staff typed.
 *
 * Instants are stored in UTC. A session typed as "10:30" under one rule is a
 * different instant under another, so when the rule changes (or, as in
 * November 2026, the rule the times were saved under turns out to be wrong)
 * the stored instants must move. This reads each instant on the OLD rule's
 * clock and re-stores that same wall time on the NEW rule's clock.
 *
 * Touches WorkshopOccurrence (start/end and the PST wall-clock mirrors) and
 * EquipmentSlot. Dry run by default; --apply writes in one transaction, only
 * for the ids you list, and records a marker so it cannot be applied twice.
 *
 * --from / --to take an IANA zone, a fixed zone like Etc/GMT+6, or
 * "legacy-mountain-dst": Canada's Mountain rules before NWT dropped DST
 * (UTC-7 from the first Sunday of November to the second Sunday of March).
 * That rule is written out here rather than read from tz data, because the
 * server's tz data may since have been updated.
 *
 * Production, from /srv/www/my.makerspaceyk.com:
 *   sudo docker compose exec -T web node - --from=legacy-mountain-dst --to=Etc/GMT+6 --since=2026-11-01 < scripts/reanchor-times.cjs
 * Then, after reviewing the output, add the --apply and --ids it prints.
 */
"use strict";

const HOUR = 3600 * 1000;
const LEGACY_MOUNTAIN = "legacy-mountain-dst";

function nthSundayUtc(year, monthIndex, n, hourUtc) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const day = 1 + ((7 - first.getUTCDay()) % 7) + 7 * (n - 1);
  return Date.UTC(year, monthIndex, day, hourUtc);
}

// 02:00 MST on the second Sunday of March is 09:00Z; 02:00 MDT on the first Sunday of November is 08:00Z.
function legacyMountainOffset(ms) {
  const year = new Date(ms).getUTCFullYear();
  const dstStart = nthSundayUtc(year, 2, 2, 9);
  const dstEnd = nthSundayUtc(year, 10, 1, 8);
  return ms >= dstStart && ms < dstEnd ? -6 * HOUR : -7 * HOUR;
}

function zoneOffset(ms, timeZone) {
  const parts = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  for (const p of fmt.formatToParts(new Date(ms))) parts[p.type] = p.value;
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

function offsetFn(zone) {
  if (zone === LEGACY_MOUNTAIN) return legacyMountainOffset;
  zoneOffset(0, zone); // throws RangeError early on an unknown zone
  return (ms) => zoneOffset(ms, zone);
}

/** The wall clock of `ms` on the `from` rule, as a UTC-encoded Date value. */
function wallOf(ms, fromOffset) {
  return ms + fromOffset(ms);
}

/** The instant at which the `to` rule's clock reads `wallMs`. */
function instantOf(wallMs, toOffset) {
  const first = wallMs - toOffset(wallMs);
  return wallMs - toOffset(first);
}

function reanchor(ms, fromOffset, toOffset) {
  return instantOf(wallOf(ms, fromOffset), toOffset);
}

function parseArgs(argv) {
  const args = { apply: false, ids: null, slotIds: [] };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    else if (a.startsWith("--from=")) args.from = a.slice(7);
    else if (a.startsWith("--to=")) args.to = a.slice(5);
    else if (a.startsWith("--since=")) args.since = a.slice(8);
    else if (a.startsWith("--ids=")) args.ids = a.slice(6).split(",").filter(Boolean).map(Number);
    else if (a.startsWith("--slot-ids=")) args.slotIds = a.slice(11).split(",").filter(Boolean).map(Number);
    else if (a !== "-") throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.from || !args.to || !/^\d{4}-\d{2}-\d{2}$/.test(args.since || "")) {
    throw new Error("Required: --from=<zone> --to=<zone> --since=YYYY-MM-DD");
  }
  if (args.apply && !args.ids) throw new Error("--apply needs the --ids printed by the dry run");
  return args;
}

const fmtWall = (wallMs) => new Date(wallMs).toISOString().slice(0, 16).replace("T", " ");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = offsetFn(args.from);
  const to = offsetFn(args.to);
  const [y, m, d] = args.since.split("-").map(Number);
  const since = new Date(instantOf(Date.UTC(y, m - 1, d), to));
  const markerKey = `tz_reanchor:${args.from}:${args.to}:${args.since}`;

  const { PrismaClient } = require("@prisma/client");
  const db = new PrismaClient();
  try {
    const marker = await db.adminSettings.findUnique({ where: { key: markerKey } });
    if (marker) {
      console.log(`Already applied (${markerKey}): ${marker.value}`);
      if (args.apply) throw new Error("Refusing to apply twice.");
    }

    const occurrences = await db.workshopOccurrence.findMany({
      where: { startDate: { gte: since } },
      include: {
        workshop: { select: { name: true } },
        equipmentSlots: { select: { id: true, startTime: true, endTime: true } },
        _count: { select: { userWorkshops: true } },
      },
      orderBy: { startDate: "asc" },
    });
    const standaloneSlots = await db.equipmentSlot.findMany({
      where: { startTime: { gte: since }, workshopOccurrenceId: null },
      include: { equipment: { select: { name: true } }, bookings: { select: { status: true } } },
      orderBy: { startTime: "asc" },
    });

    const plan = occurrences.map((o) => {
      const newStart = reanchor(o.startDate.getTime(), from, to);
      const newEnd = reanchor(o.endDate.getTime(), from, to);
      const typedWall = wallOf(o.startDate.getTime(), from);
      const mirror = o.startDatePST ? o.startDatePST.getTime() : null;
      return {
        o,
        shift: newStart - o.startDate.getTime(),
        newStart,
        newEnd,
        mirrorAgrees: mirror === null ? "no mirror" : mirror === typedWall ? "yes" : `NO (${fmtWall(mirror)})`,
        slots: o.equipmentSlots.map((s) => ({
          id: s.id,
          newStart: reanchor(s.startTime.getTime(), from, to),
          newEnd: reanchor(s.endTime.getTime(), from, to),
          shift: reanchor(s.startTime.getTime(), from, to) - s.startTime.getTime(),
        })),
      };
    });
    const moving = plan.filter((p) => p.shift !== 0);

    console.log(`Re-anchor ${args.from} -> ${args.to}, sessions starting on or after ${args.since} (${since.toISOString()})`);
    console.log(`${occurrences.length} sessions found, ${moving.length} would move.\n`);
    console.log("id | workshop | status | regs | slots | now shows (new rule) | will show | typed time matches PST mirror");
    for (const p of moving) {
      const nowShows = fmtWall(wallOf(p.o.startDate.getTime(), to));
      const willShow = `${fmtWall(wallOf(p.newStart, to))}-${fmtWall(wallOf(p.newEnd, to)).slice(11)}`;
      console.log([p.o.id, p.o.workshop.name.slice(0, 30), p.o.status, p.o._count.userWorkshops, p.slots.length, nowShows, willShow, p.mirrorAgrees].join(" | "));
    }
    const unchanged = plan.length - moving.length;
    if (unchanged) console.log(`(${unchanged} sessions already correct under both rules, untouched)`);

    const movingSlots = standaloneSlots
      .map((s) => ({ s, newStart: reanchor(s.startTime.getTime(), from, to), newEnd: reanchor(s.endTime.getTime(), from, to) }))
      .filter((x) => x.newStart !== x.s.startTime.getTime());
    console.log(`\n${movingSlots.length} member equipment slots would move.`);
    for (const x of movingSlots) {
      console.log([`slot ${x.s.id}`, x.s.equipment.name, fmtWall(wallOf(x.s.startTime.getTime(), to)), "->", fmtWall(wallOf(x.newStart, to)), x.s.bookings.map((b) => b.status).join(",")].join(" | "));
    }

    if (!args.apply) {
      const ids = moving.map((p) => p.o.id).join(",");
      const slotIds = movingSlots.map((x) => x.s.id).join(",");
      console.log("\nDry run: nothing was written. To apply exactly the rows above, add:");
      console.log(`  --apply --ids=${ids}${slotIds ? ` --slot-ids=${slotIds}` : ""}`);
      return;
    }

    const wanted = new Set(args.ids);
    const chosen = moving.filter((p) => wanted.has(p.o.id));
    const unknown = args.ids.filter((id) => !moving.some((p) => p.o.id === id));
    if (unknown.length) throw new Error(`Not in the dry-run list, refusing: ${unknown.join(",")}`);
    const slotWanted = new Set(args.slotIds);
    const chosenSlots = movingSlots.filter((x) => slotWanted.has(x.s.id));
    const unknownSlots = args.slotIds.filter((id) => !movingSlots.some((x) => x.s.id === id));
    if (unknownSlots.length) throw new Error(`Slots not in the dry-run list, refusing: ${unknownSlots.join(",")}`);

    await db.$transaction(async (tx) => {
      for (const p of chosen) {
        await tx.workshopOccurrence.update({
          where: { id: p.o.id },
          data: {
            startDate: new Date(p.newStart),
            endDate: new Date(p.newEnd),
            startDatePST: new Date(wallOf(p.newStart, to)),
            endDatePST: new Date(wallOf(p.newEnd, to)),
          },
        });
        for (const s of p.slots) {
          await tx.equipmentSlot.update({
            where: { id: s.id },
            data: { startTime: new Date(s.newStart), endTime: new Date(s.newEnd) },
          });
        }
      }
      for (const x of chosenSlots) {
        await tx.equipmentSlot.update({
          where: { id: x.s.id },
          data: { startTime: new Date(x.newStart), endTime: new Date(x.newEnd) },
        });
      }
      await tx.adminSettings.create({
        data: {
          key: markerKey,
          value: JSON.stringify({ appliedAt: new Date().toISOString(), ids: args.ids, slotIds: args.slotIds }),
          description: "Applied by scripts/reanchor-times.cjs; guards against a second run.",
        },
      });
    });
    console.log(`\nApplied: ${chosen.length} sessions, ${chosen.reduce((n, p) => n + p.slots.length, 0)} of their equipment slots, ${chosenSlots.length} member slots.`);
  } finally {
    await db.$disconnect();
  }
}

module.exports = { legacyMountainOffset, offsetFn, reanchor, wallOf, instantOf, parseArgs };

// "[stdin]" is how it runs in production: `node - ... < scripts/reanchor-times.cjs`.
if (require.main === module || module.id === "[stdin]") {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}
