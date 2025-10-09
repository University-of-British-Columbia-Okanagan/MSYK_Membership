export const createDbMock = () => ({
  db: {
    workshop: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workshopOccurrence: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    workshopPrerequisite: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    workshopPriceVariation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userWorkshop: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    equipmentSlot: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    equipmentBooking: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workshopCancelledRegistration: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
});

export type DbMock = ReturnType<typeof createDbMock>['db'];

