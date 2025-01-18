import { PrismaClient } from '@prisma/client';
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
      },
      {
        email: "testuser2@gmail.com",
        password: "password",
        firstName: "Test2",
        lastName: "User2",
      },
      {
        email: "testuser3@gmail.com",
        password: "password",
        firstName: "Test3",
        lastName: "User3",
      },
    ],
  });

  const allUsers = await prisma.user.findMany({});
  console.dir(allUsers, { depth: null });
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })