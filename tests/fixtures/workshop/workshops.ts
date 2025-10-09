/**
 * Workshop test fixtures and factory functions
 *
 * This file contains both pre-defined fixtures (like getWorkshopsFixture)
 * and factory functions for creating custom test data.
 */

/**
 * Pre-defined workshop fixtures for integration/route tests
 */
export const getWorkshopsFixture = [
  {
    id: 1,
    name: 'Laser Cutting Basics',
    description: 'Learn how to use a laser cutter safely.',
    price: 30,
    createdAt: new Date('2025-07-11T17:11:02.999Z'),
    updatedAt: new Date('2025-07-11T17:11:02.999Z'),
    location: 'Makerspace YK',
    capacity: 15,
    type: 'workshop',
    imageUrl: null,
    cancellationPolicy:
      "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours of registration.",
    registrationCutoff: 60,
    occurrences: [
        {
            id: 1,
            workshopId: 1,
            startDate: new Date('2025-02-10T10:00:00.000Z'),
            endDate: new Date('2025-02-10T12:00:00.000Z'),
            startDatePST: null,
            endDatePST: null,
            status: 'past',
            connectId: null,
            offerId: 1,
            registrationCount: 0
        },
        {
            id: 2,
            workshopId: 1,
            startDate: new Date('2025-03-17T10:00:00.000Z'),
            endDate: new Date('2025-03-17T12:00:00.000Z'),
            startDatePST: null,
            endDatePST: null,
            status: 'past',
            connectId: null,
            offerId: 1,
            registrationCount: 0
        }
    ],
    status: 'past',
  },
  {
    id: 2,
    name: 'Pottery Workshop',
    description: 'Hands-on pottery techniques for beginners.',
    price: 35,
    createdAt: new Date('2025-07-11T17:11:02.999Z'),
    updatedAt: new Date('2025-07-11T17:11:02.999Z'),
    location: 'Makerspace YK',
    capacity: 20,
    type: 'workshop',
    imageUrl: null,
    cancellationPolicy:
      "Can't make it? Email info@makerspaceyk.com. Full refunds are only available if canceled within 48 hours of registration.",
    registrationCutoff: 60,
    occurrences: [],
    status: 'past',
  },
];

/**
 * Factory functions for creating workshop test data
 * Use these in unit tests for flexible test data creation
 */

export const createMockWorkshop = (overrides?: Partial<any>) => ({
  id: 1,
  name: "Test Workshop",
  description: "Test Description",
  price: 100,
  location: "Test Location",
  capacity: 20,
  type: "workshop",
  hasPriceVariations: false,
  occurrences: [],
  priceVariations: [],
  prerequisites: [],
  equipments: [],
  ...overrides,
});

export const createMockOccurrence = (overrides?: Partial<any>) => ({
  id: 1,
  workshopId: 1,
  startDate: new Date("2025-12-01T10:00:00Z"),
  endDate: new Date("2025-12-01T12:00:00Z"),
  startDatePST: null,
  endDatePST: null,
  status: "active",
  connectId: null,
  offerId: 1,
  googleEventId: null,
  equipmentSlots: [],
  userWorkshops: [],
  ...overrides,
});

export const createMockUserWorkshop = (overrides?: Partial<any>) => ({
  id: 1,
  userId: 1,
  workshopId: 1,
  occurrenceId: 1,
  result: "passed",
  date: new Date("2025-01-01"),
  priceVariationId: null,
  paymentIntentId: null,
  ...overrides,
});

export const createMockPriceVariation = (overrides?: Partial<any>) => ({
  id: 1,
  workshopId: 1,
  name: "Student",
  price: 50,
  description: "Student rate",
  capacity: 10,
  status: "active",
  ...overrides,
});

export const createMockWorkshopWithOccurrences = (
  numOccurrences: number = 1,
  overrides?: Partial<any>
) => {
  const occurrences = Array.from({ length: numOccurrences }, (_, i) =>
    createMockOccurrence({
      id: i + 1,
      startDate: new Date(`2025-12-0${i + 1}T10:00:00Z`),
      endDate: new Date(`2025-12-0${i + 1}T12:00:00Z`),
    })
  );

  return createMockWorkshop({
    occurrences,
    ...overrides,
  });
};

export const createMockMultiDayWorkshop = (
  numOccurrences: number = 2,
  connectId: number = 1
) => {
  return createMockWorkshopWithOccurrences(numOccurrences, {
    occurrences: Array.from({ length: numOccurrences }, (_, i) =>
      createMockOccurrence({
        id: i + 1,
        connectId,
        startDate: new Date(`2025-12-0${i + 1}T10:00:00Z`),
        endDate: new Date(`2025-12-0${i + 1}T12:00:00Z`),
      })
    ),
  });
};

