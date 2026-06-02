/**
 * scripts/seed-orientation-registrations.ts
 *
 * Seeds realistic test registrations for ANY workshop — orientation or regular,
 * single-day or multi-day, with or without price variations.
 *
 * What it auto-detects from the workshop record
 * ─────────────────────────────────────────────
 *   type                 → "orientation" shows passed/failed/pending dropdowns;
 *                          "workshop" shows plain text result
 *   hasPriceVariations   → true: uses/creates price variations and assigns some
 *                          false: all registrations have priceVariationId = null
 *
 * What --days controls
 * ────────────────────
 *   1 (default)  → single-day sessions; each occurrence has no connectId
 *   2+           → multi-day sessions; each session = N consecutive occurrences
 *                  all sharing the same connectId (mirrors how the app works)
 *                  Each user is registered for EVERY occurrence in their session
 *
 * Does NOT wipe existing data — safe to run alongside the main seed.
 *
 * Usage
 * ─────
 *   npx tsx scripts/seed-orientation-registrations.ts               # first orientation
 *   npx tsx scripts/seed-orientation-registrations.ts 5             # by workshop ID
 *   npx tsx scripts/seed-orientation-registrations.ts "Shopspace"   # by name (partial)
 *   npx tsx scripts/seed-orientation-registrations.ts 5 --days=3    # 3-day sessions
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Parse CLI args ─────────────────────────────────────────────────────────────
// argv[2] = workshop ID or name  (optional)
// argv[*] = --days=N             (optional, default 1)
const rawArgs = process.argv.slice(2);
const workshopArg = rawArgs.find((a) => !a.startsWith("--")) ?? null;
const daysArg = rawArgs.find((a) => a.startsWith("--days="));
const DAYS_PER_SESSION = daysArg ? Math.max(1, parseInt(daysArg.split("=")[1], 10)) : 1;
// ──────────────────────────────────────────────────────────────────────────────

// 5 past sessions — first day of each session, relative to today
const SESSION_OFFSETS: Array<{ daysAgo: number; startH: number }> = [
  { daysAgo: 90, startH: 9  },
  { daysAgo: 60, startH: 14 },
  { daysAgo: 30, startH: 9  },
  { daysAgo: 14, startH: 10 },
  { daysAgo: 3,  startH: 9  },
];

// Duration of each day/occurrence in hours
const SESSION_DURATION_H = 2;

// 20 test users spread across 5 sessions (4 per session)
// result intentionally varied so every filter value has matches
type Result = "passed" | "failed" | "pending" | "cancelled";
interface UserSpec {
  firstName: string;
  lastName: string;
  result: Result;
  regDaysBefore: number;    // registration date offset from session start
  usePriceVar?: 0 | 1;     // index into priceVariations array; omit = no variation
}

const USER_SPECS: UserSpec[] = [
  // Session 1
  { firstName: "Alice",   lastName: "Johnson",  result: "passed",    regDaysBefore: 12 },
  { firstName: "Bob",     lastName: "Smith",    result: "passed",    regDaysBefore: 8,  usePriceVar: 0 },
  { firstName: "Carol",   lastName: "Williams", result: "failed",    regDaysBefore: 5 },
  { firstName: "David",   lastName: "Brown",    result: "pending",   regDaysBefore: 3,  usePriceVar: 1 },
  // Session 2
  { firstName: "Emily",   lastName: "Jones",    result: "passed",    regDaysBefore: 14 },
  { firstName: "Frank",   lastName: "Miller",   result: "passed",    regDaysBefore: 9,  usePriceVar: 0 },
  { firstName: "Grace",   lastName: "Davis",    result: "failed",    regDaysBefore: 6 },
  { firstName: "Henry",   lastName: "Wilson",   result: "pending",   regDaysBefore: 2 },
  // Session 3
  { firstName: "Isabel",  lastName: "Moore",    result: "passed",    regDaysBefore: 10 },
  { firstName: "James",   lastName: "Taylor",   result: "passed",    regDaysBefore: 7,  usePriceVar: 1 },
  { firstName: "Karen",   lastName: "Anderson", result: "failed",    regDaysBefore: 4 },
  { firstName: "Leo",     lastName: "Thomas",   result: "pending",   regDaysBefore: 2 },
  // Session 4
  { firstName: "Maria",   lastName: "Jackson",  result: "passed",    regDaysBefore: 11 },
  { firstName: "Nathan",  lastName: "White",    result: "passed",    regDaysBefore: 6,  usePriceVar: 0 },
  { firstName: "Olivia",  lastName: "Harris",   result: "failed",    regDaysBefore: 4 },
  { firstName: "Patrick", lastName: "Martin",   result: "pending",   regDaysBefore: 1 },
  // Session 5 — includes "cancelled" to cover that filter value
  { firstName: "Quinn",   lastName: "Thompson", result: "passed",    regDaysBefore: 9 },
  { firstName: "Rachel",  lastName: "Garcia",   result: "cancelled", regDaysBefore: 5 },
  { firstName: "Sam",     lastName: "Martinez", result: "pending",   regDaysBefore: 3,  usePriceVar: 1 },
  { firstName: "Tina",    lastName: "Robinson", result: "pending",   regDaysBefore: 1 },
];

const USERS_PER_SESSION = 4; // must divide USER_SPECS.length evenly

// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.error(`Aborted: NODE_ENV="${process.env.NODE_ENV}". Only runs in development.`);
    process.exit(1);
  }

  // ── Find the workshop ────────────────────────────────────────────────────────
  const workshopId =
    workshopArg && /^\d+$/.test(workshopArg) ? Number(workshopArg) : null;
  const workshopName = workshopArg && !workshopId ? workshopArg : null;

  const workshop = workshopId
    ? await prisma.workshop.findUnique({
        where: { id: workshopId },
        include: { priceVariations: true },
      })
    : await prisma.workshop.findFirst({
        where: workshopName
          ? { name: { contains: workshopName, mode: "insensitive" } }
          : { type: "orientation" },
        orderBy: { id: "asc" },
        include: { priceVariations: true },
      });

  if (!workshop) {
    const hint = workshopId
      ? `ID ${workshopId}`
      : workshopName
      ? `"${workshopName}"`
      : "any orientation";
    console.error(`No workshop found (${hint}). Run the main seed first.`);
    process.exit(1);
  }

  const isOrientation = workshop.type === "orientation";
  console.log(
    `\nWorkshop : "${workshop.name}" (ID ${workshop.id}, type: ${workshop.type})`
  );
  console.log(`Mode     : ${DAYS_PER_SESSION > 1 ? `multi-day (${DAYS_PER_SESSION} days/session)` : "single-day"}`);
  console.log(
    `Variations: ${workshop.hasPriceVariations ? "yes" : "no"}`
  );

  // ── Price variations — only when the workshop has them ──────────────────────
  let priceVariations: { id: number; name: string }[] = [];

  if (workshop.hasPriceVariations) {
    priceVariations = workshop.priceVariations.filter((v) => v.status === "active");

    if (priceVariations.length < 2) {
      console.log("\n  Creating test price variations...");
      const toCreate = [
        { name: "Member",  price: 0,  description: "Current members",    capacity: 15 },
        { name: "Drop-in", price: 10, description: "Non-member drop-in", capacity: 5  },
      ];
      for (const v of toCreate) {
        const existing = await prisma.workshopPriceVariation.findFirst({
          where: { workshopId: workshop.id, name: v.name },
        });
        const record = existing
          ? existing
          : await prisma.workshopPriceVariation.create({
              data: { workshopId: workshop.id, ...v },
            });
        if (!existing) console.log(`    + "${v.name}"`);
        priceVariations.push(record);
      }
    }
  }
  // If hasPriceVariations is false, priceVariations stays [] and no user gets one

  // ── Determine next connectId (for multi-day grouping) ───────────────────────
  let nextConnectId = 1;
  if (DAYS_PER_SESSION > 1) {
    const maxRow = await prisma.workshopOccurrence.findFirst({
      where: { connectId: { not: null } },
      orderBy: { connectId: "desc" },
      select: { connectId: true },
    });
    nextConnectId = (maxRow?.connectId ?? 0) + 1;
  }

  // ── Create occurrence sessions ───────────────────────────────────────────────
  const now = new Date();
  console.log("\nCreating occurrence sessions...");

  // sessions[i] = array of occurrences for session i
  const sessions: Array<{ id: number; startDate: Date }[]> = [];

  for (let s = 0; s < SESSION_OFFSETS.length; s++) {
    const { daysAgo, startH } = SESSION_OFFSETS[s];
    const connectId = DAYS_PER_SESSION > 1 ? nextConnectId + s : null;
    const sessionOccs: { id: number; startDate: Date }[] = [];

    for (let d = 0; d < DAYS_PER_SESSION; d++) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysAgo + d); // consecutive days
      startDate.setHours(startH, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setHours(startH + SESSION_DURATION_H, 0, 0, 0);

      const occ = await prisma.workshopOccurrence.create({
        data: {
          workshopId: workshop.id,
          startDate,
          endDate,
          status: "past",
          ...(connectId !== null ? { connectId } : {}),
        },
      });
      sessionOccs.push({ id: occ.id, startDate });
    }

    const dayLabel = DAYS_PER_SESSION > 1
      ? `day 1: ${sessionOccs[0].startDate.toISOString().slice(0, 10)} … day ${DAYS_PER_SESSION}: ${sessionOccs.at(-1)!.startDate.toISOString().slice(0, 10)}  [connectId=${connectId}]`
      : sessionOccs[0].startDate.toISOString().slice(0, 10);
    console.log(`  Session ${s + 1}: ${dayLabel}  (occ IDs: ${sessionOccs.map((o) => o.id).join(", ")})`);
    sessions.push(sessionOccs);
  }

  // ── Hash password once ───────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("password", 10);

  // ── Create users and register them ──────────────────────────────────────────
  console.log("\nRegistering users...");
  let registered = 0;

  for (let i = 0; i < USER_SPECS.length; i++) {
    const spec = USER_SPECS[i];
    const sessionIdx = Math.floor(i / USERS_PER_SESSION);
    const sessionOccs = sessions[sessionIdx];
    const email = `seed.${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@scripttest.local`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: hashedPassword,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: "5555555555",
        dateOfBirth: "1990-01-01",
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: "5551234567",
        emergencyContactEmail: "emergency@scripttest.local",
        mediaConsent: true,
        dataPrivacy: true,
        communityGuidelines: true,
        operationsPolicy: true,
        roleUserId: 1,
      },
    });

    // Registration date = N days before the first occurrence of the session
    const registrationDate = new Date(sessionOccs[0].startDate);
    registrationDate.setDate(registrationDate.getDate() - spec.regDaysBefore);

    // Resolve price variation — only if workshop actually has them
    const priceVariationId =
      workshop.hasPriceVariations && spec.usePriceVar !== undefined
        ? (priceVariations[spec.usePriceVar]?.id ?? null)
        : null;

    // Register for EVERY occurrence in the session (multi-day: one row per day)
    for (const occ of sessionOccs) {
      await prisma.userWorkshop.upsert({
        where: { userId_occurrenceId: { userId: user.id, occurrenceId: occ.id } },
        update: { result: spec.result },
        create: {
          userId: user.id,
          workshopId: workshop.id,
          occurrenceId: occ.id,
          result: spec.result,
          date: registrationDate,
          ...(priceVariationId ? { priceVariationId } : {}),
        },
      });
    }

    const varName = priceVariationId
      ? priceVariations.find((v) => v.id === priceVariationId)?.name
      : null;
    const occLabel = sessionOccs.length > 1
      ? `${sessionOccs.length} occs`
      : `occ ${sessionOccs[0].id}`;
    console.log(
      `  ${spec.firstName.padEnd(8)} ${spec.lastName.padEnd(10)}` +
      `  session ${sessionIdx + 1}  ${occLabel}` +
      `  result: ${spec.result.padEnd(10)}` +
      (varName ? `  [${varName}]` : "")
    );
    registered++;
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalOccs = sessions.reduce((sum, s) => sum + s.length, 0);
  console.log(
    `\n✓  ${registered} users · ${totalOccs} occurrence${totalOccs > 1 ? "s" : ""} across ${sessions.length} sessions`
  );
  console.log(`\nView the page:`);
  console.log(`  /dashboard/admin/workshop/${workshop.id}/users`);

  console.log("\nDate filter values (first day of each session):");
  sessions.forEach((occs, i) => {
    const iso = occs[0].startDate.toISOString().slice(0, 10);
    console.log(`  Session ${i + 1}: ${iso}`);
  });

  if (!isOrientation) {
    console.log(
      "\nNote: this is a regular workshop — the Result column shows plain text, not a dropdown."
    );
  }
  if (DAYS_PER_SESSION > 1) {
    console.log(
      `\nNote: multi-day — each row in the table expands to show ${DAYS_PER_SESSION} individual day results.`
    );
  }
  if (!workshop.hasPriceVariations) {
    console.log(
      "\nNote: hasPriceVariations=false — Price Variation column will show N/A for all rows."
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
