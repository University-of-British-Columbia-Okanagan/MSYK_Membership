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
