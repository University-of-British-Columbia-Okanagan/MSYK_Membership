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

  // Ensure booking follows 30-minute slot rules
  if (end.getTime() - start.getTime() !== 30 * 60 * 1000) {
    throw new Error("Bookings must be in 30-minute slots.");
  }

  // Check if user exists and fetch membership details
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { membership: true },
  });

  if (!user || !user.membership) {
    throw new Error("You need an active membership to book equipment.");
  }

  // Only allow members with a monthly subscription to book
  if (user.membership.type !== "monthly") {
    throw new Error(
      "Only members with a monthly subscription can book equipment."
    );
  }

  // Enforce booking rules for limited access members
  if (user.membership.accessHours) {
    const { start: allowedStart, end: allowedEnd } =
      user.membership.accessHours;
    const bookingHour = start.getHours();

    if (
      bookingHour < Number(allowedStart) ||
      bookingHour >= Number(allowedEnd)
    ) {
      throw new Error("Your membership only allows booking within set hours.");
    }
  }

  // Check if equipment is needed for a workshop during the requested time
  const conflictingWorkshop = await db.workshopOccurrence.findFirst({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      workshop: {
        occurrences: {
          some: { id: equipmentId }, // Assuming there's a relation between equipment and workshops
        },
      },
    },
  });

  if (conflictingWorkshop) {
    throw new Error(
      "This equipment is reserved for a workshop during this time."
    );
  }

  // Prevent double booking for the same time slot
  if (await checkBookingConflict(equipmentId, start, end)) {
    throw new Error("Equipment is already booked for this time slot.");
  }

  //Create the booking
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
//for admins to add an equipment
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
