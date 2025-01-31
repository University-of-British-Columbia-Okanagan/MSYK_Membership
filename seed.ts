import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany();

  await prisma.$executeRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1`;

  await prisma.user.createMany({
    data: [
      {
        email: "testuser1@gmail.com",
        password: "password",
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
      },
      {
        email: "testuser2@gmail.com",
        password: "password",
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
        password: "password",
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

  const allUsers = await prisma.user.findMany({});
  console.dir(allUsers, { depth: null });
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
