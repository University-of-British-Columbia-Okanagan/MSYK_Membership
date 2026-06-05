import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

// Run npx tsx seed.ts (only in development)
async function main() {
  const env = process.env.NODE_ENV;
  if (env !== "development") {
    console.error(`Seed aborted: NODE_ENV is "${env}". Only runs in development.`);
    process.exit(1);
  }

  await prisma.adminSettings.deleteMany();
  await prisma.userMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.roleUser.deleteMany();
  await prisma.workshopPriceVariation.deleteMany();
  await prisma.workshopOccurrence.deleteMany();
  await prisma.workshop.deleteMany();
  await prisma.equipment.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "MembershipPlan_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "RoleUser_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "Workshop_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "WorkshopOccurrence_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "Equipment_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "AdminSettings_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "WorkshopPriceVariation_id_seq" RESTART WITH 1`;

  const hashedPassword = await bcrypt.hash("password", 10);
  const now = new Date();

  await prisma.roleUser.createMany({
    data: [{ name: "User" }, { name: "Admin" }],
  });

  await prisma.user.createMany({
    data: [
      {
        email: "testuser1@gmail.com",
        password: hashedPassword,
        firstName: "Test1",
        lastName: "User1",
        phone: "1234567890",
        dateOfBirth: "1990-01-15",
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "5551234567",
        emergencyContactEmail: "emergency1@example.com",
        mediaConsent: true,
        dataPrivacy: true,
        communityGuidelines: true,
        operationsPolicy: true,
        waiverSignature: "EncryptedWaiverPlaceholder1",
        roleUserId: 2,
      },
      {
        email: "testuser2@gmail.com",
        password: hashedPassword,
        firstName: "Test2",
        lastName: "User2",
        phone: "2233445566",
        dateOfBirth: "1995-06-22",
        emergencyContactName: "Mark Smith",
        emergencyContactPhone: "5559876543",
        emergencyContactEmail: "emergency2@example.com",
        mediaConsent: false,
        dataPrivacy: true,
        communityGuidelines: true,
        operationsPolicy: true,
        waiverSignature: "EncryptedWaiverPlaceholder2",
      },
      {
        email: "testuser3@gmail.com",
        password: hashedPassword,
        firstName: "Test3",
        lastName: "User3",
        phone: "3344556677",
        dateOfBirth: "1988-12-03",
        emergencyContactName: "Bruce Wayne",
        emergencyContactPhone: "5551122334",
        emergencyContactEmail: "emergency3@example.com",
        mediaConsent: true,
        dataPrivacy: true,
        communityGuidelines: true,
        operationsPolicy: true,
        waiverSignature: "EncryptedWaiverPlaceholder3",
      },
    ],
  });

  await prisma.membershipPlan.createMany({
    data: [
      {
        title: "Makerspace Member",
        description:
          "MSYK membership now covers Artspace, Hackspace, & Shopspace for just $50/month!",
        price: 50,
        feature: {
          Feature1: "Hotdesk access in Artspace during drop-in times",
          Feature2: "Access to the woodshop & digital lab tools and equipment",
          Feature3: "Tablesaw - Compound mitre saw - Bandsaw - Scroll saw",
          Feature4: "Joiner - Planer - Disc & Belt sander - Drill Press",
          Feature5:
            "Hand and portable tools also available (drills, jigsaws, etc.)",
          Feature6:
            "Laser cutters, 3D printers, CNC milling, circuits, soldering",
          Feature7: "Access to MSYK laptops with software subscriptions",
          Feature8: "2 hours of 3D print time per month ($5/30 min after)",
          Feature9: "60 minutes of laser/CNC cut time per month ($1/min after)",
          Feature10: "Additional Hackspace and Shop orientations required",
        },
      },
      {
        title: "Drop-In 10 Pass",
        description:
          "Not ready for a membership? Get a Drop-In 10 pass & save $10!",
        price: 90,
        feature: {
          Feature1:
            "10 drop-in sessions for the Artspace, Shop, or Digital lab",
          Feature2: "**Shop Orientation required for Wood Shop",
          Feature3: "**Training may be required for Hackspace equipment",
        },
        needAdminPermission: true,
      },
    ],
  });

  await prisma.workshop.createMany({
    data: [
      {
        name: "Laser Cutting Basics",
        description:
          "Learn how to use the laser cutter safely and effectively. We'll cover material selection, design file preparation, and machine operation.",
        price: 30.0,
        location: "Makerspace YK — Digital Lab",
        capacity: 8,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      {
        name: "3D Printing Fundamentals",
        description:
          "Get hands-on with FDM 3D printing. Learn slicer software, print settings, and how to troubleshoot common issues.",
        price: 25.0,
        location: "Makerspace YK — Digital Lab",
        capacity: 10,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      {
        name: "Introduction to Woodworking",
        description:
          "A beginner-friendly workshop covering basic hand tools, power tool safety, and a guided small project build.",
        price: 40.0,
        location: "Makerspace YK — Shopspace",
        capacity: 6,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      {
        name: "General Orientation",
        description:
          "Required orientation for all new members. Covers safety rules, facility tour, tool overview, and membership access levels.",
        price: 0.0,
        location: "Makerspace YK",
        capacity: 20,
        type: "orientation",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
      {
        name: "Shopspace Orientation",
        description:
          "Required orientation for members who want to access the woodshop. Covers table saw, band saw, and other shop equipment.",
        price: 0.0,
        location: "Makerspace YK — Shopspace",
        capacity: 8,
        type: "orientation",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
      {
        name: "Soldering & Electronics Basics",
        description:
          "Learn to solder, read basic circuits, and assemble a small take-home electronics project.",
        price: 20.0,
        location: "Makerspace YK — Hackspace",
        capacity: 12,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      // ID 7 — Workshop: Regular (single-day, no price variations)
      {
        name: "Workshop — Regular Single-Day",
        description:
          "A standard single-session workshop. One day, one time slot, flat pricing.",
        price: 35.0,
        location: "Makerspace YK — Digital Lab",
        capacity: 10,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      // ID 8 — Workshop: Multi-Day (multiple occurrences linked by connectId, no price variations)
      {
        name: "Workshop — Multi-Day",
        description:
          "A multi-session workshop spanning three consecutive days. All days are required; registrations cover all linked sessions.",
        price: 75.0,
        location: "Makerspace YK — Shopspace",
        capacity: 8,
        type: "workshop",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      // ID 9 — Workshop: Regular with Price Variations (single-day, has member/non-member tiers)
      {
        name: "Workshop — Regular Single-Day with Price Variations",
        description:
          "A single-day workshop with tiered pricing. Members pay a reduced rate; non-members pay standard pricing.",
        price: -1,
        location: "Makerspace YK — Hackspace",
        capacity: 12,
        type: "workshop",
        hasPriceVariations: true,
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      // ID 10 — Workshop: Multi-Day with Price Variations
      {
        name: "Workshop — Multi-Day with Price Variations",
        description:
          "A multi-day workshop spanning three sessions with tiered member/non-member pricing.",
        price: -1,
        location: "Makerspace YK — Digital Lab",
        capacity: 10,
        type: "workshop",
        hasPriceVariations: true,
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 60,
      },
      // ID 11 — Orientation: Regular (single-day, no price variations)
      {
        name: "Orientation — Regular Single-Day",
        description:
          "A standard single-session orientation. One day, one time slot, flat (free) pricing.",
        price: 0.0,
        location: "Makerspace YK",
        capacity: 20,
        type: "orientation",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
      // ID 12 — Orientation: Multi-Day (multiple occurrences linked by connectId)
      {
        name: "Orientation — Multi-Day",
        description:
          "A multi-session orientation spanning two consecutive days. Both days are required to complete the orientation.",
        price: 0.0,
        location: "Makerspace YK",
        capacity: 15,
        type: "orientation",
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
      // ID 13 — Orientation: Regular with Price Variations (single-day, has student/standard tiers)
      {
        name: "Orientation — Regular Single-Day with Price Variations",
        description:
          "A single-day orientation with tiered pricing. Students pay a reduced fee; standard pricing otherwise.",
        price: -1,
        location: "Makerspace YK — Shopspace",
        capacity: 12,
        type: "orientation",
        hasPriceVariations: true,
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
      // ID 14 — Orientation: Multi-Day with Price Variations
      {
        name: "Orientation — Multi-Day with Price Variations",
        description:
          "A two-day orientation with tiered student/standard pricing. Both days required.",
        price: -1,
        location: "Makerspace YK",
        capacity: 15,
        type: "orientation",
        hasPriceVariations: true,
        cancellationPolicy:
          "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours before the scheduled start time of the workshop/orientation.",
        registrationCutoff: 30,
      },
    ],
  });

  const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const baseOccurrencesData = [
    // Laser Cutting — two upcoming sessions
    {
      workshopId: 1,
      startDate: addDays(now, 7),
      endDate: addDays(now, 7),
    },
    {
      workshopId: 1,
      startDate: addDays(now, 21),
      endDate: addDays(now, 21),
    },
    // 3D Printing — upcoming session
    {
      workshopId: 2,
      startDate: addDays(now, 10),
      endDate: addDays(now, 10),
    },
    // Woodworking — upcoming session
    {
      workshopId: 3,
      startDate: addDays(now, 14),
      endDate: addDays(now, 14),
    },
    // General Orientation — two upcoming sessions
    {
      workshopId: 4,
      startDate: addDays(now, 5),
      endDate: addDays(now, 5),
    },
    {
      workshopId: 4,
      startDate: addDays(now, 19),
      endDate: addDays(now, 19),
    },
    // Shopspace Orientation — upcoming session
    {
      workshopId: 5,
      startDate: addDays(now, 12),
      endDate: addDays(now, 12),
    },
    // Soldering — upcoming session
    {
      workshopId: 6,
      startDate: addDays(now, 28),
      endDate: addDays(now, 28),
    },
    // Past occurrences (for "past events" section)
    {
      workshopId: 1,
      startDate: addDays(now, -30),
      endDate: addDays(now, -30),
    },
    {
      workshopId: 2,
      startDate: addDays(now, -14),
      endDate: addDays(now, -14),
    },
    // Workshop — Regular Single-Day (ID 7)
    {
      workshopId: 7,
      startDate: addDays(now, 8),
      endDate: addDays(now, 8),
    },
    // Workshop — Regular Single-Day with Price Variations (ID 9)
    {
      workshopId: 9,
      startDate: addDays(now, 11),
      endDate: addDays(now, 11),
    },
    // Orientation — Regular Single-Day (ID 11)
    {
      workshopId: 11,
      startDate: addDays(now, 6),
      endDate: addDays(now, 6),
    },
    // Orientation — Regular Single-Day with Price Variations (ID 13)
    {
      workshopId: 13,
      startDate: addDays(now, 16),
      endDate: addDays(now, 16),
    },
  ];

  // Set start/end times: each occurrence is 2 hours; past ones explicitly past status
  const workshopOccurrencesData = baseOccurrencesData.map((occ) => {
    const start = new Date(occ.startDate);
    start.setHours(10, 0, 0, 0);
    const end = new Date(occ.endDate);
    end.setHours(12, 0, 0, 0);
    return {
      workshopId: occ.workshopId,
      startDate: start,
      endDate: end,
      status: start > now ? "active" : "past",
    };
  });

  await prisma.workshopOccurrence.createMany({
    data: workshopOccurrencesData,
  });

  // Multi-day occurrences need connectId — create individually so the grouped IDs are consistent.
  // connectId 1 → Workshop — Multi-Day (ID 8), 3 days
  for (let day = 0; day < 3; day++) {
    const start = addDays(now, 15 + day);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(14, 0, 0, 0);
    await prisma.workshopOccurrence.create({
      data: {
        workshopId: 8,
        startDate: start,
        endDate: end,
        connectId: 1,
        status: "active",
      },
    });
  }

  // connectId 2 → Workshop — Multi-Day with Price Variations (ID 10), 3 days
  for (let day = 0; day < 3; day++) {
    const start = addDays(now, 22 + day);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(14, 0, 0, 0);
    await prisma.workshopOccurrence.create({
      data: {
        workshopId: 10,
        startDate: start,
        endDate: end,
        connectId: 2,
        status: "active",
      },
    });
  }

  // connectId 3 → Orientation — Multi-Day (ID 12), 2 days
  for (let day = 0; day < 2; day++) {
    const start = addDays(now, 9 + day);
    start.setHours(13, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    await prisma.workshopOccurrence.create({
      data: {
        workshopId: 12,
        startDate: start,
        endDate: end,
        connectId: 3,
        status: "active",
      },
    });
  }

  // connectId 4 → Orientation — Multi-Day with Price Variations (ID 14), 2 days
  for (let day = 0; day < 2; day++) {
    const start = addDays(now, 18 + day);
    start.setHours(13, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    await prisma.workshopOccurrence.create({
      data: {
        workshopId: 14,
        startDate: start,
        endDate: end,
        connectId: 4,
        status: "active",
      },
    });
  }

  // Price variations for workshops with hasPriceVariations=true
  await prisma.workshopPriceVariation.createMany({
    data: [
      // Workshop — Regular Single-Day with Price Variations (ID 9)
      {
        workshopId: 9,
        name: "Member",
        price: 20.0,
        description: "Discounted rate for active MSYK members.",
        capacity: 8,
      },
      {
        workshopId: 9,
        name: "Non-Member",
        price: 40.0,
        description: "Standard rate for non-members.",
        capacity: 4,
      },
      // Workshop — Multi-Day with Price Variations (ID 10)
      {
        workshopId: 10,
        name: "Member",
        price: 50.0,
        description: "Discounted multi-day rate for active MSYK members.",
        capacity: 7,
      },
      {
        workshopId: 10,
        name: "Non-Member",
        price: 90.0,
        description: "Standard multi-day rate for non-members.",
        capacity: 3,
      },
      // Orientation — Regular Single-Day with Price Variations (ID 13)
      {
        workshopId: 13,
        name: "Student",
        price: 0.0,
        description: "Free for enrolled students with valid student ID.",
        capacity: 8,
      },
      {
        workshopId: 13,
        name: "Standard",
        price: 15.0,
        description: "Standard orientation fee for community members.",
        capacity: 4,
      },
      // Orientation — Multi-Day with Price Variations (ID 14)
      {
        workshopId: 14,
        name: "Student",
        price: 0.0,
        description: "Free two-day orientation for enrolled students.",
        capacity: 10,
      },
      {
        workshopId: 14,
        name: "Standard",
        price: 25.0,
        description: "Standard fee for the two-day orientation.",
        capacity: 5,
      },
    ],
  });
  await prisma.equipment.createMany({
    data: [
      {
        name: "3D Printer",
        description: "High-quality 3D printing machine for rapid prototyping.",
        availability: true,
        price: 10,
      },
      {
        name: "Laser Cutter",
        description:
          "Precision cutting tool for wood, plastic, and metal sheets.",
        availability: true,
        price: 15,
      },
      {
        name: "CNC Milling Machine",
        description: "Computer-controlled milling machine for detailed cuts.",
        availability: true,
        price: 20,
      },
      {
        name: "Soldering Station",
        description:
          "Professional soldering toolset for circuit board assembly.",
        availability: true,
        price: 25,
      },
      {
        name: "Vinyl Cutter",
        description:
          "Machine for cutting adhesive vinyl for signs and stickers.",
        availability: true,
        price: 30,
      },
    ],
  });

  await prisma.adminSettings.upsert({
    where: { key: "workshop_visibility_days" },
    update: { value: "60" },
    create: {
      key: "workshop_visibility_days",
      value: "60",
      description: "Max number of days ahead that workshops are visible",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "past_workshop_visibility" },
    update: { value: "180" },
    create: {
      key: "past_workshop_visibility",
      value: "180",
      description:
        "Number of days in the past to show entire workshops (in past events section as of 7/14/2025)",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "equipment_visible_registrable_days" },
    update: { value: "7" },
    create: {
      key: "equipment_visible_registrable_days",
      value: "7",
      description:
        "Max number of days ahead that equipment is visible and registrable after the current date",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "level3_start_end_hours" },
    update: {
      value: JSON.stringify({
        Sunday: { start: 9, end: 17 },
        Monday: { start: 9, end: 17 },
        Tuesday: { start: 9, end: 17 },
        Wednesday: { start: 9, end: 17 },
        Thursday: { start: 9, end: 17 },
        Friday: { start: 9, end: 17 },
        Saturday: { start: 9, end: 17 },
      }),
    },
    create: {
      key: "level3_start_end_hours",
      value: JSON.stringify({
        Sunday: { start: 9, end: 17 },
        Monday: { start: 9, end: 17 },
        Tuesday: { start: 9, end: 17 },
        Wednesday: { start: 9, end: 17 },
        Thursday: { start: 9, end: 17 },
        Friday: { start: 9, end: 17 },
        Saturday: { start: 9, end: 17 },
      }),
      description:
        "Configurable start and end hours for level 3 users to book equipment on each day of the week",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "level4_unavaliable_hours" },
    update: {
      value: JSON.stringify({
        start: 0,
        end: 0,
      }),
    },
    create: {
      key: "level4_unavaliable_hours",
      value: JSON.stringify({
        start: 0,
        end: 0,
      }),
      description:
        "Hours when level 4 users cannot book equipment. Special case: start=0, end=0 means no restrictions. If start > end (e.g. 22 to 5), it represents a period that crosses midnight.",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "max_number_equipment_slots_per_day" },
    update: { value: "4" },
    create: {
      key: "max_number_equipment_slots_per_day",
      value: "4",
      description:
        "Maximum number of 30-minute slots a user can book equipment per day (stored as slot count, 4 = 2 hours)",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "max_number_equipment_slots_per_week" },
    update: { value: "14" },
    create: {
      key: "max_number_equipment_slots_per_week",
      value: "14",
      description:
        "Maximum number of 30-minute slots a user can book equipment per week (stored as slot count, 14 = 7 hours)",
    },
  });

  await prisma.adminSettings.upsert({
    where: { key: "gst_percentage" },
    update: { value: "5" },
    create: {
      key: "gst_percentage",
      value: "5",
      description:
        "GST/HST tax percentage applied to all payments in Canada (5% for GST, varies by province for HST)",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
