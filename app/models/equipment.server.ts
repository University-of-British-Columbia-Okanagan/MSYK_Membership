import { db } from "../utils/db.server";
interface EquipmentData {
  name: string;
  description: string;
  availability: boolean;
}
console.log(db.equipment);

/**
 * Fetch equipment details by ID
 */
export async function getEquipmentById(equipmentId: number) {
  return await db.equipment.findUnique({
    where: { id: equipmentId },
    include: { bookings: true }, // Include related bookings if needed
  });
}

/**
 * Fetch all available equipment
 */
export async function getAvailableEquipment() {
  return await db.equipment.findMany({
    where: { availability: true },
    include: { bookings: true },
  });
}

/**
 * Check if a booking conflicts with existing bookings
 */
async function checkBookingConflict(
  equipmentId: number,
  startTime: Date,
  endTime: Date
) {
  const existingBooking = await db.equipmentBooking.findFirst({
    where: {
      equipmentId,
      OR: [{ startTime: { lte: endTime }, endTime: { gte: startTime } }],
    },
  });
  return !!existingBooking;
}

/**
 * Book equipment
 */
export async function bookEquipment(
  userId: number,
  equipmentId: number,
  startTime: string,
  endTime: string
) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Check if user exists
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { roleUser: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if user has a membership plan
  const membership = await db.membershipPlan.findFirst({
    where: { id: user.roleUserId },
  });

  if (!membership) {
    throw new Error("Membership plan not found");
  }

  // Enforce booking hours for limited members
  if (membership.accessHours) {
    const { start: allowedStart, end: allowedEnd } = membership.accessHours;
    const bookingHour = start.getHours();

    if (
      bookingHour < Number(allowedStart) ||
      bookingHour >= Number(allowedEnd)
    ) {
      throw new Error("Booking time is outside your membership hours");
    }
  }

  // Prevent double booking for the same time slot
  if (await checkBookingConflict(equipmentId, start, end)) {
    throw new Error("Equipment is already booked for this time slot");
  }

  // Create booking
  return await db.equipmentBooking.create({
    data: {
      userId,
      equipmentId,
      startTime: start,
      endTime: end,
      status: "pending", // Requires admin approval
    },
  });
}

/**
 * Cancel a booking
 */
export async function cancelEquipmentBooking(bookingId: number) {
  const booking = await db.equipmentBooking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error("Booking not found");
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
