import { db } from "../utils/db.server";
import { getUserId } from "../utils/session.server";

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
export async function getAvailableEquipment(startTime: Date, endTime: Date) {
  return await db.equipment
    .findMany({
      include: {
        slots: {
          select: { id: true, isBooked: true },
        },
      },
    })
    .then((equipments) =>
      equipments.map((eq) => ({
        id: eq.id,
        name: eq.name,
        description: eq.description,
        imageUrl: eq.imageUrl,
        totalSlots: eq.slots.length,
        bookedSlots: eq.slots.filter((slot) => slot.isBooked).length,
        status:
          eq.slots.length === 0
            ? "unavailable" // No slots exist
            : eq.slots.every((slot) => slot.isBooked)
            ? "unavailable" // All slots taken
            : "available", // Some slots are free
      }))
    );
}

/**
 * Book equipment using a predefined slot
 */
export async function bookEquipment(
  request: Request,
  equipmentId: number,
  startTime: string,
  endTime: string
) {
  console.log("Raw startTime and endTime from frontend:", {
    startTime,
    endTime,
  });
  const userId = await getUserId(request);
  if (!userId) throw new Error("User is not authenticated.");

  //Ensure startTime & endTime are properly converted
  const parsedStartTime = new Date(startTime);
  const parsedEndTime = new Date(endTime);

  console.log("After parsing:", { parsedStartTime, parsedEndTime });
  if (isNaN(parsedStartTime.getTime()) || isNaN(parsedEndTime.getTime())) {
    throw new Error("Invalid date format for startTime or endTime.");
  }

  console.log("Validated Booking Time:", { parsedStartTime, parsedEndTime });

  // Step 1: Check if a slot already exists
  let slot = await db.equipmentSlot.findFirst({
    where: {
      equipmentId,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
    },
  });

  // Step 2: If slot doesn't exist, create it
  if (!slot) {
    slot = await db.equipmentSlot.create({
      data: {
        equipmentId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        isBooked: false, // Default to available
      },
    });
  }

  // Step 3: Check if the slot is available for booking
  if (slot.isBooked) throw new Error("Slot is already booked.");

  // Step 4: Mark slot as booked
  await db.equipmentSlot.update({
    where: { id: slot.id },
    data: { isBooked: true },
  });

  // Step 5: Create the booking record
  return await db.equipmentBooking.create({
    data: {
      userId: parseInt(userId),
      equipmentId,
      slotId: slot.id,
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

  // Delete booking record
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
}) {
  try {
    // Create Equipment Without Slots
    const newEquipment = await db.equipment.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        availability: data.availability, // 24/7 available unless changed by admin
      },
    });

    console.log(" New Equipment Created:", newEquipment);

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
        { workshopOccurrenceId: { not: null } }, // Assigned to another workshop
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
      workshopOccurrenceId: workshopId, // Assign to workshop
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
      isBooked: false,
      workshopOccurrenceId: null,
    },
    orderBy: { startTime: "asc" },
  });
}
export async function getEquipmentByName(name: string) {
  return await db.equipment.findFirst({
    where: { name },
  });
}

export async function getAvailableEquipmentForAdmin() {
  const equipment = await db.equipment.findMany({
    include: {
      slots: {
        where: {
          isBooked: false,
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  console.log("Available Equipment for Admin:", equipment);

  if (!equipment || equipment.length === 0) {
    console.warn("⚠ No available equipment found in the database!");
  }

  return equipment;
}

export async function getEquipmentSlotsWithStatus() {
  const equipment = await db.equipment.findMany({
    include: {
      slots: {
        select: {
          id: true,
          startTime: true,
          isBooked: true,
          workshopOccurrenceId: true,
          workshopOccurrence: {
            select: { workshop: { select: { name: true } } },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  console.log("Raw Slots Data from DB:", JSON.stringify(equipment, null, 2));

  // ✅ Generate Full 24/7 Grid
  const generate24_7Slots = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const times = Array.from({ length: 48 }, (_, i) => {
      const hours = Math.floor(i / 2);
      const minutes = i % 2 === 0 ? "00" : "30";
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    });

    const fullSlots: { [key: string]: { [key: string]: any } } = {};
    for (const day of days) {
      fullSlots[day] = {};
      for (const time of times) {
        fullSlots[day][time] = {
          id: null, // Default: No slot in DB
          isBooked: false, // Default: Not booked
          isAvailable: true, // Default: Available
          workshopName: null,
        };
      }
    }
    return fullSlots;
  };

  return equipment.map((eq) => {
    const fullSlots = generate24_7Slots();

    eq.slots.forEach((slot) => {
      const date = new Date(slot.startTime);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const time = `${hours}:${minutes}`;

      const dayIndex = date.getDay(); // 0 - Sunday, 6 - Saturday
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const day = days[dayIndex];

      if (fullSlots[day] && fullSlots[day][time]) {
        fullSlots[day][time] = {
          id: slot.id,
          isBooked: slot.isBooked,
          isAvailable: !slot.isBooked && !slot.workshopOccurrenceId,
          workshopName: slot.workshopOccurrence?.workshop?.name || null,
        };
      }
    });

    return {
      id: eq.id,
      name: eq.name,
      slotsByDay: fullSlots,
    };
  });
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
  const bookings = await db.equipmentBooking.findMany({
    where: { userId },
    include: {
      equipment: {
        include: {
          slots: {
            select: { id: true, isBooked: true },
          },
        },
      },
    },
  });

  return bookings.map((booking) => ({
    id: booking.id,
    name: booking.equipment.name,
    description: booking.equipment.description,
    imageUrl: booking.equipment.imageUrl,
    totalSlots: booking.equipment.slots.length,
    bookedSlots: booking.equipment.slots.filter((slot) => slot.isBooked).length,
    status: "booked", // Since this is user's booking, it's always "booked"
    bookingId: booking.id,
  }));
}

export async function bulkBookEquipment(workshopId: number, slots: number[]) {
  const availableSlots = await db.equipmentSlot.findMany({
    where: {
      id: { in: slots },
      isBooked: false,
    },
  });

  if (availableSlots.length !== slots.length) {
    throw new Error("One or more slots are already booked.");
  }

  return await db.equipmentSlot.updateMany({
    where: { id: { in: slots } },
    data: {
      isBooked: true,
      workshopOccurrenceId: workshopId,
    },
  });
}

export async function setSlotAvailability(
  slotId: number,
  isAvailable: boolean
) {
  return await db.equipmentSlot.update({
    where: { id: slotId },
    data: {
      isAvailable,
    },
  });
}

export async function getAvailableEquipmentSlotsForWorkshopRange(
  startDate: Date,
  endDate: Date
) {
  console.log(" Fetching available equipment slots for workshop...");
  console.log("Workshop Date Range:", { startDate, endDate });

  try {
    const slots = await db.equipmentSlot.findMany({
      where: {
        startTime: { gte: startDate },
        endTime: { lte: endDate },
        isBooked: false,
        isAvailable: true,
        workshopOccurrenceId: null, // Ensure not assigned to a workshop
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    console.log("Slots Retrieved:", slots.length);
    return slots;
  } catch (error) {
    console.error(" Error fetching available slots:", error);
    throw new Error("Failed to fetch available slots");
  }
}
