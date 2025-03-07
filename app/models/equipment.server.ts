import { db } from "../utils/db.server";

interface EquipmentData {
  name: string;
  description: string;
  availability: boolean;
  price: number;
}

console.log(db.equipment);

/**
 * Fetch equipment details by ID
 */
export async function getEquipmentById(equipmentId: number) {
  return await db.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      bookings: {
        include: {
          user: true, 
        },
      },
      slots: true, 
    },
  });
}

/**
 * Fetch all available equipment
 */
export async function getAvailableEquipment() {
  return await db.equipment.findMany({
    where: { availability: true },
    include: {
      bookings: {
        include: {
          user: true, 
          slot: true, 
        },
      },
      slots: true, 
    },
  });
}

/**
 * Book equipment using a predefined slot
 */
export async function bookEquipment(userId: number, slotId: number) {
  const slot = await db.equipmentSlot.findUnique({
    where: { id: slotId },
    include: { equipment: true }, 
  });

  if (!slot) {
    throw new Error("Slot not found.");
  }

  if (slot.isBooked) {
    throw new Error("Slot is already booked or unavailable.");
  }

  // Check user's membership eligibility
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { membership: true },
  });

  if (!user || !user.membership || user.membership.type !== "monthly") {
    throw new Error("You need an active monthly membership to book.");
  }

  // Mark slot as booked
  await db.equipmentSlot.update({
    where: { id: slotId },
    data: { isBooked: true },
  });

  // Create the booking
  return await db.equipmentBooking.create({
    data: {
      userId,
      equipmentId: slot.equipment.id,
      slotId,
      status: "pending",
    },
  });
}

/**
 * Cancel a booking
 */
export async function cancelEquipmentBooking(bookingId: number) {
  const booking = await db.equipmentBooking.findUnique({
    where: { id: bookingId },
    include: { slot: true }, 
  });

  if (!booking) {
    throw new Error("Booking not found.");
  }

  // Free up the slot
  if (booking.slot) {
    await db.equipmentSlot.update({
      where: { id: booking.slot.id },
      data: { isBooked: false },
    });
  }

  return await db.equipmentBooking.delete({ where: { id: bookingId } });
}

/**
 * Approve a booking (Admin only)
 */
export async function approveEquipmentBooking(bookingId: number) {
  return await db.equipmentBooking.update({
    where: { id: bookingId },
    data: { status: "approved" },
  });
}

/**
 * Add new equipment (Admin only)
 */
export async function addEquipment({
  name,
  description,
  price,
  availability,
}: {
  name: string;
  description: string;
  price: number;
  availability: boolean;
}) {
  return await db.equipment.create({
    data: {
      name,
      description,
      price,
      availability,
    },
  });
}

/**
 * Create an equipment slot (Admin only)
 */
export async function createEquipmentSlot(
  equipmentId: number,
  startTime: Date
) {
  // Ensure the equipment exists before creating a slot
  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!equipment) {
    throw new Error("Equipment not found.");
  }

  return await db.equipmentSlot.create({
    data: {
      equipmentId,
      startTime,
      isBooked: false,
    },
  });
}

/**
 * Fetch available slots for a particular equipment
 */
export async function getAvailableSlots(equipmentId: number) {
  return await db.equipmentSlot.findMany({
    where: { equipmentId, isBooked: false },
    orderBy: { startTime: "asc" },
  });
}
