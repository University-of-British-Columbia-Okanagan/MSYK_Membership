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
      slots: {
        orderBy: { startTime: "asc" }, // Ensures proper ordering
      },
    },
  });
}

/**
 * Fetch all available equipment
 */
export async function getAvailableEquipment(workshopStartTime: Date, workshopEndTime: Date) {
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
export async function bookEquipment(userId: number, slotId: number) {
  const slot = await db.equipmentSlot.findUnique({
    where: { id: slotId },
    include: { equipment: true, workshop: true }, // Include workshop relation
  });

  if (!slot) throw new Error("Slot not found.");
  if (slot.isBooked) throw new Error("Slot is already booked.");
  if (slot.workshopId !== null)
    throw new Error("This equipment is reserved for a workshop.");

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { membership: true },
  });

  if (!user || !user.membership || user.membership.type !== "monthly") {
    throw new Error("You need an active monthly membership to book.");
  }

  await db.equipmentSlot.update({
    where: { id: slotId },
    data: { isBooked: true },
  });

  return await db.equipmentBooking.create({
    data: { userId, equipmentId: slot.equipment.id, slotId, status: "pending" },
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
export async function addEquipment(data: {
  name: string;
  description: string;
  price: number;
  availability: boolean;
  slots: { startTime: Date }[]; // No endTime needed
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
        { isBooked: true }, // Check if already booked by a user
        { workshop: { isNot: null } }, // Check if already reserved for a workshop
      ],
    },
  });

  if (existingSlot)
    throw new Error("This slot is already booked or reserved for a workshop.");

  return await db.equipmentSlot.create({
    data: {
      equipmentId,
      startTime,
      workshop: { connect: { id: workshopId } }, // Correctly link workshop relation
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
          workshop: {
            select: {
              name: true, // Show which workshop booked it
            },
          },
        },
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
      isBooked: slot.workshop !== null,
      workshopName: slot.workshop ? slot.workshop.name : null,
    })),
  }));
}

/**
 * Update existing equipment (Admin only)
 */
export async function updateEquipment(equipmentId: number, data: {
  name?: string;
  description?: string;
  price?: number;
  availability?: boolean;
}) {
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