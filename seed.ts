import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

// run npx tsx seed.ts
async function main() {
  await prisma.user.deleteMany();
  await prisma.membershipPlan.deleteMany();
  await prisma.roleUser.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "MembershipPlan_id_seq" RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE "RoleUser_id_seq" RESTART WITH 1`;

  const hashedPassword = await bcrypt.hash("password", 10);

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
        roleUser: 2,
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
        title: "Community Member",
        description: "Support Makerspace YK as a community member",
        price: 35.0,
        feature: {
          HotdeskAccess: "Hotdesk access in Artspace during drop-in times",
          SewingMachines: "Access to sewing machines and serger in Artspace",
          SocialMedia: "Social media promotion for your startup or initiative",
          Discount: "5% discount on all MSYK workshops",
        },
      }, 
      {
        title: "Makerspace Member",
        description:
          "MSYK membership now covers Artspace, Hackspace, & Shopspace for just $50/month!",
        price: 50,
        feature: [
          "Hotdesk access in Artspace during drop-in times",
          "Access to the woodshop & digital lab tools and equipment",
          "Tablesaw - Compound mitre saw - Bandsaw - Scroll saw",
          "Joiner - Planer - Disc & Belt sander - Drill Press",
          "Hand and portable tools also available (drills, jigsaws, etc.)",
          "Laser cutters, 3D printers, CNC milling, circuits, soldering",
          "Access to MSYK laptops with software subscriptions",
          "2 hours of 3D print time per month ($5/30 min after)",
          "60 minutes of laser/CNC cut time per month ($1/min after)",
          "Additional Hackspace and Shop orientations required",
        ],
      },
      {
        title: "Drop-In 10 Pass",
        description:
          "Not ready for a membership? Get a Drop-In 10 pass & save $10!",
        price: 90,
        feature: [
          "10 drop-in sessions for the Artspace, Shop, or Digital lab",
          "**Shop Orientation required for Wood Shop",
          "**Training may be required for Hackspace equipment",
        ],
      },
    ],
    
  });

  await prisma.roleUser.createMany({
    data: [
      { name: "User" },
      { name: "Admin" },
    ],
  });

  // const allUsers = await prisma.user.findMany({});
  // console.dir(allUsers, { depth: null });
  console.log("success!");
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
