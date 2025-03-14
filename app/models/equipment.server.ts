import { db } from "../utils/db.server";
import { getUserId } from "../utils/session.server"; // Adjust the path as needed

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
      slots: {
        orderBy: { startTime: "asc" }, // Ensures proper ordering
      },
    },
  });
}

/**
 * Fetch all available equipment
 */
export async function getAvailableEquipment(
  workshopStartTime: Date,
  workshopEndTime: Date
) {
  return await db.equipment.findMany({
    where: {
      id: {
        notIn: (
          await db.equipmentSlot.findMany({
            where: {
              startTime: {
                gte: workshopStartTime,
                lte: workshopEndTime, // Check if already booked
              },
              isBooked: true,
            },
            select: { equipmentId: true },
          })
        ).map((slot) => slot.equipmentId),
      },
    },
  });
}

/**
 * Book equipment using a predefined slot
 */
export async function bookEquipment(request: Request, slotId: number) {
  const userId = await getUserId(request); // Ensure we fetch the correct userId from session
  console.log("Booking Equipment for userId:", userId, "slotId:", slotId); // Debugging log

  if (!userId) {
    throw new Error("User is not authenticated.");
  }

  const slot = await db.equipmentSlot.findUnique({
    where: { id: slotId },
    include: { equipment: true },
  });

  if (!slot) throw new Error("Slot not found.");
  if (slot.isBooked) throw new Error("Slot is already booked.");
  if (slot.workshopId !== null)
    throw new Error("This equipment is reserved for a workshop.");

  // Fetch user from database
  const user = await db.user.findUnique({
    where: { id: parseInt(userId) },
    include: { membership: true },
  });

  console.log("User Found in DB:", user);

  if (!user || !user.membership || user.membership.type !== "monthly") {
    throw new Error("You need an active monthly membership to book.");
  }

  await db.equipmentSlot.update({
    where: { id: slotId },
    data: { isBooked: true },
  });

  console.log("Final Booking for userId:", userId, "slotId:", slotId);

  const booking = await db.equipmentBooking.create({
    data: {
      userId: parseInt(userId),
      equipmentId: slot.equipment.id,
      slotId,
      status: "pending",
    },
  });

  console.log("Created Booking:", booking);
  return booking;
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
export async function addEquipment(data: {
  name: string;
  description: string;
  price: number;
  availability: boolean;
  slots: { startTime: Date }[];
}) {
  try {
    // Create Equipment
    const newEquipment = await db.equipment.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        availability: data.availability,
      },
    });

    console.log("New Equipment Created:", newEquipment);

    // Ensure slots exist before adding
    if (data.slots && data.slots.length > 0) {
      console.log("Adding Equipment Slots:", data.slots);

      await db.equipmentSlot.createMany({
        data: data.slots.map((slot) => ({
          equipmentId: newEquipment.id,
          startTime: new Date(slot.startTime), // Start time as provided
          endTime: new Date(new Date(slot.startTime).getTime() + 30 * 60000), // Auto-add 30 minutes
          isBooked: false,
        })),
      });
    } else {
      console.warn("No slots were provided for this equipment.");
    }

    return newEquipment;
  } catch (error) {
    console.error("Error adding equipment:", error);
    throw new Error("Failed to add equipment.");
  }
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
      endTime: new Date(startTime.getTime() + 30 * 60000), // Auto-add 30 minutes
      isBooked: false,
    },
  });
}

export async function createEquipmentSlotForWorkshop(
  equipmentId: number,
  startTime: Date,
  workshopId: number
) {
  const existingSlot = await db.equipmentSlot.findFirst({
    where: {
      equipmentId,
      startTime,
      OR: [
        { isBooked: true }, // Booked by a user
        { workshopId: { not: null } }, // Assigned to another workshop
      ],
    },
  });

  if (existingSlot)
    throw new Error(
      "This slot is either booked by a user or already assigned to a workshop."
    );

  return await db.equipmentSlot.updateMany({
    where: { equipmentId, startTime },
    data: {
      workshopId: workshopId, // Assign to workshop
      isBooked: true, // Mark as booked
    },
  });
}

/**
 * Fetch available slots for a particular equipment
 */
export async function getAvailableSlots(equipmentId: number) {
  return await db.equipmentSlot.findMany({
    where: {
      equipmentId,
      isBooked: false, // Ensure the slot is not booked by a user
      workshop: null, // Ensure the slot is not reserved for a workshop
    },
    orderBy: { startTime: "asc" },
  });
}
export async function getEquipmentByName(name: string) {
  return await db.equipment.findUnique({
    where: { name },
  });
}

export async function getAvailableEquipmentForAdmin() {
  return db.equipment.findMany({
    include: {
      slots: {
        where: { isBooked: false }, //this will show only available slots.
        orderBy: { startTime: "asc" },
      },
    },
  });
}

export async function getEquipmentSlotsWithStatus() {
  const equipment = await db.equipment.findMany({
    include: {
      slots: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          isBooked: true,
          workshop: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  return equipment.map((eq) => ({
    id: eq.id,
    name: eq.name,
    slots: eq.slots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isBooked: slot.isBooked,
      workshopName: slot.workshop ? slot.workshop.name : null,
    })),
  }));
}

/**
 * Update existing equipment (Admin only)
 */
export async function updateEquipment(
  equipmentId: number,
  data: {
    name?: string;
    description?: string;
    price?: number;
    availability?: boolean;
  }
) {
  try {
    return await db.equipment.update({
      where: { id: equipmentId },
      data,
    });
  } catch (error) {
    console.error("Error updating equipment:", error);
    throw new Error("Failed to update equipment.");
  }
}

/**
 * Delete equipment (Admin only)
 */
export async function deleteEquipment(equipmentId: number) {
  try {
    // Ensure the equipment exists before deleting
    const existingEquipment = await db.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!existingEquipment) {
      throw new Error("Equipment not found.");
    }

    // Delete associated slots first (to prevent foreign key constraint issues)
    await db.equipmentSlot.deleteMany({
      where: { equipmentId },
    });

    // Delete the equipment
    return await db.equipment.delete({
      where: { id: equipmentId },
    });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    throw new Error("Failed to delete equipment.");
  }
}

/**
 * Duplicate existing equipment (Admin only)
 */
export async function duplicateEquipment(equipmentId: number) {
  try {
    const existingEquipment = await db.equipment.findUnique({
      where: { id: equipmentId },
    });

    if (!existingEquipment) {
      throw new Error("Equipment not found.");
    }

    // Create a new equipment entry with the same details
    const duplicatedEquipment = await db.equipment.create({
      data: {
        name: `${existingEquipment.name} (Copy)`,
        description: existingEquipment.description,
        price: existingEquipment.price,
        availability: existingEquipment.availability,
      },
    });

    return duplicatedEquipment;
  } catch (error) {
    console.error("Error duplicating equipment:", error);
    throw new Error("Failed to duplicate equipment.");
  }
}
// Fetch booked equipment for a user
export async function getUserBookedEquipments(userId: number) {
  return await db.equipmentBooking.findMany({
    where: { userId },
    include: {
      equipment: {
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
        },
      },
      slot: {
        select: {
          startTime: true,
          endTime: true,
        },
      },
    },
    orderBy: {
      slot: {
        startTime: "asc",
      },
    },
  });
}