export const createMockEquipment = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: "Laser Cutter",
  description: "CO2 laser cutter",
  price: 20,
  availability: true,
  imageUrl: null,
  prerequisites: [],
  slots: [],
  ...overrides,
});

export const createMockSlot = (overrides: Partial<any> = {}) => ({
  id: 1,
  equipmentId: 1,
  startTime: new Date("2025-12-01T10:00:00Z"),
  endTime: new Date("2025-12-01T10:30:00Z"),
  isBooked: false,
  isAvailable: true,
  workshopOccurrenceId: null,
  bookings: [],
  equipment: {
    id: 1,
    name: "Laser Cutter",
    price: 20,
  },
  ...overrides,
});

export const createMockBooking = (overrides: Partial<any> = {}) => ({
  id: 1,
  userId: 1,
  equipmentId: 1,
  slotId: 1,
  status: "pending",
  bookedFor: "user",
  paymentIntentId: null,
  slot: createMockSlot(),
  equipment: createMockEquipment(),
  user: {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    roleLevel: 3,
    roleUserId: 1,
  },
  ...overrides,
});

