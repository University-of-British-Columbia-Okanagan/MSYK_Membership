import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

// run npx tsx seed.ts
async function main() {
  await prisma.adminSettings.deleteMany();
  await prisma.userMembershipPayment.deleteMany();
  await prisma.userMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.roleUser.deleteMany();
  await prisma.workshop.deleteMany();
  await prisma.workshopOccurrence.deleteMany();
  await prisma.equipment.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "MembershipPlan_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "RoleUser_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "Workshop_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "WorkshopOccurrence_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "Equipment_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "AdminSettings_id_seq" RESTART WITH 1`;

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
        address: "123 Main St",
        over18: true,
        parentGuardianName: "John Doe",
        parentGuardianPhone: "9876543210",
        parentGuardianEmail: "guardian1@example.com",
        guardianSignedConsent: "Base64Placeholder1",
        photoRelease: true,
        dataPrivacy: true,
        emergencyContactName: "Jane Doe",
        emergencyContactPhone: "5551234567",
        emergencyContactEmail: "emergency1@example.com",
        trainingCardUserNumber: 1001,
        // roleUser and roleLevel default to 1 but will put roleUser 2 to make admin
        roleUserId: 2,
      },
      {
        email: "testuser2@gmail.com",
        password: hashedPassword,
        firstName: "Test2",
        lastName: "User2",
        phone: "2233445566",
        address: "456 Maple Ave",
        over18: false,
        parentGuardianName: "Mary Smith",
        parentGuardianPhone: "5566778899",
        parentGuardianEmail: "guardian2@example.com",
        guardianSignedConsent: "Base64Placeholder2",
        photoRelease: false,
        dataPrivacy: true,
        emergencyContactName: "Mark Smith",
        emergencyContactPhone: "5559876543",
        emergencyContactEmail: "emergency2@example.com",
        trainingCardUserNumber: 1002,
      },
      {
        email: "testuser3@gmail.com",
        password: hashedPassword,
        firstName: "Test3",
        lastName: "User3",
        phone: "3344556677",
        address: "789 Oak Blvd",
        over18: true,
        parentGuardianName: "Peter Parker",
        parentGuardianPhone: "6677889900",
        parentGuardianEmail: "guardian3@example.com",
        guardianSignedConsent: "Base64Placeholder3",
        photoRelease: true,
        dataPrivacy: false,
        emergencyContactName: "Bruce Wayne",
        emergencyContactPhone: "5551122334",
        emergencyContactEmail: "emergency3@example.com",
        trainingCardUserNumber: 1003,
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
        accessHours: {
          start: "00:00", // 24/7 Access
          end: "23:59",
        },
        type: "monthly",
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
        accessHours: {
          start: "10:00", // Example: 10 AM start
          end: "16:00", // Example: 4 PM end
        },
        type: "monthly",
        needAdminPermission: true,
      },
    ],
  });

  await prisma.workshop.createMany({
    data: [
      {
        name: "Laser Cutting Basics",
        description: "Learn how to use a laser cutter safely.",
        price: 30.0,
        location: "Makerspace YK",
        capacity: 15,
        type: "workshop",
      },
      {
        name: "Pottery Workshop",
        description: "Hands-on pottery techniques for beginners.",
        price: 35.0,
        location: "Makerspace YK",
        capacity: 20,
        type: "workshop",
      },
      {
        name: "Knitting for Beginners",
        description: "Learn the basics of knitting.",
        price: 22.0,
        location: "Makerspace YK",
        capacity: 25,
        type: "orientation",
      },
    ],
  });

  const baseOccurrencesData = [
    {
      workshopId: 1, // Laser Cutting
      startDate: new Date("2025-02-10T10:00:00Z"),
      endDate: new Date("2025-02-10T12:00:00Z"),
    },
    {
      workshopId: 1, // Laser Cutting again
      startDate: new Date("2025-03-17T10:00:00Z"),
      endDate: new Date("2025-03-17T12:00:00Z"),
    },
    {
      workshopId: 2, // Pottery
      startDate: new Date("2025-06-10T14:00:00Z"),
      endDate: new Date("2025-06-10T16:00:00Z"),
    },
    {
      workshopId: 3, // Knitting
      startDate: new Date("2025-08-10T10:00:00Z"),
      endDate: new Date("2025-08-10T12:00:00Z"),
    },
  ];

  // Map over each occurrence to set status based on startDate
  const workshopOccurrencesData = baseOccurrencesData.map((occ) => {
    const isFuture = occ.startDate > now;
    return {
      ...occ,
      status: isFuture ? "active" : "past",
    };
  });

  // Now insert them into the database
  await prisma.workshopOccurrence.createMany({
    data: workshopOccurrencesData,
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
    where: { key: "equipment_visible_registrable_days" },
    update: { value: "7" },
    create: {
      key: "equipment_visible_registrable_days",
      value: "7",
      description: "Max number of days ahead that equipment is visible and registrable",
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
