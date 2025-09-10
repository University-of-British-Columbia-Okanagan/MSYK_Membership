import { db } from "../utils/db.server";
import { getUserId } from "../utils/session.server";
import { getAdminSetting } from "../models/admin.server";

/**
 * Get equipment with prerequisites by ID
 * @param equipmentId The ID of the equipment to retrieve
 * @returns Equipment object with flattened prerequisites array
 */
export async function getEquipmentById(equipmentId: number) {
  try {
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        prerequisites: {
          select: {
            workshopPrerequisiteId: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new Error("Equipment not found");
    }

    // Flatten prerequisite workshop IDs
    const prerequisites = equipment.prerequisites.map(
      (p) => p.workshopPrerequisiteId
    );

    return {
      ...equipment,
      prerequisites,
    };
  } catch (error) {
    console.error("Error fetching equipment by ID:", error);
    throw new Error("Failed to fetch equipment");
  }
}

/**
 * Fetch all available equipment with slot status information
 * @returns Array of available equipment with slot counts and status
 */
export async function getAvailableEquipment() {
  return await db.equipment
    .findMany({
      where: { availability: true },
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
 * Book equipment using a predefined slot with role-based restrictions
 * @param request The HTTP request object for authentication
 * @param equipmentId The ID of the equipment to book
 * @param startTime Start time of the booking slot as ISO string
 * @param endTime End time of the booking slot as ISO string
 * @returns Created equipment booking record
 */
export async function bookEquipment(
  request: Request,
  equipmentId: number,
  startTime: string,
  endTime: string,
  paymentIntentId?: string,
  options?: { suppressEmail?: boolean }
) {
  const userId = await getUserId(request);
  if (!userId) throw new Error("User is not authenticated.");

  // Fetch user role level
  const user = await db.user.findUnique({ where: { id: parseInt(userId) } });
  if (!user) throw new Error("User not found.");

  const parsedStartTime = new Date(startTime);
  const parsedEndTime = new Date(endTime);

  // Role-based access restrictions
  const day = parsedStartTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = parsedStartTime.getHours();

  if (user.roleLevel === 1 || user.roleLevel === 2) {
    throw new Error("You do not have permission to book equipment.");
  }

  if (user.roleLevel === 3) {
    // Level 3 can't book on Monday (1) or Tuesday (2)
    // if (day === 1 || day === 2) {
    //   throw new Error(
    //     "Level 3 members cannot book equipment on Monday or Tuesday."
    //   );
    // }

    // Optional: Add specific hour restrictions if needed for DROP-IN HOURS
    if (hour < 9 || hour >= 17) {
      throw new Error("Level 3 members can only book between 9 AM and 5 PM.");
    }
  }

  // Find or create slot
  let slot = await db.equipmentSlot.findFirst({
    where: {
      equipmentId,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
    },
  });

  if (!slot) {
    slot = await db.equipmentSlot.create({
      data: {
        equipmentId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        isBooked: false,
      },
    });
  }

  if (slot.isBooked) throw new Error("Slot is already booked.");

  await db.equipmentSlot.update({
    where: { id: slot.id },
    data: { isBooked: true },
  });

  const booking = await db.equipmentBooking.create({
    data: {
      userId: parseInt(userId),
      equipmentId,
      slotId: slot.id,
      status: "pending",
      ...(paymentIntentId ? { paymentIntentId } : {}),
    },
  });

  // Send confirmation email unless suppressed
  if (!options?.suppressEmail) {
    try {
      const { sendEquipmentConfirmationEmail } = await import("../utils/email.server");
      const equipment = await db.equipment.findUnique({
        where: { id: equipmentId },
        select: { name: true, price: true }
      });

      if (equipment) {
        await sendEquipmentConfirmationEmail({
          userEmail: user.email,
          equipmentName: equipment.name,
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          price: equipment.price,
        });
      }
    } catch (emailError) {
      console.error("Failed to send equipment confirmation email:", emailError);
    }
  }

  return booking;
}

export async function bookEquipmentBulkByTimes(
  request: Request,
  equipmentId: number,
  times: Array<{ startTime: string; endTime: string }>,
  paymentIntentId?: string
) {
  const userId = await getUserId(request);
  if (!userId) throw new Error("User is not authenticated.");

  // Book each slot without sending individual emails
  const bookings = [] as any[];
  for (const t of times) {
    const booking = await bookEquipment(
      request,
      equipmentId,
      t.startTime,
      t.endTime,
      paymentIntentId,
      { suppressEmail: true }
    );
    bookings.push(booking);
  }

  // Send one consolidated email
  try {
    const { sendEquipmentBulkConfirmationEmail } = await import("../utils/email.server");
    const user = await db.user.findUnique({ where: { id: parseInt(userId) } });
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
      select: { name: true, price: true },
    });
    if (user?.email && equipment) {
      const slots = times.map((t) => ({
        startTime: new Date(t.startTime),
        endTime: new Date(t.endTime),
      }));
      await sendEquipmentBulkConfirmationEmail({
        userEmail: user.email,
        equipmentName: equipment.name,
        slots,
        pricePerSlot: equipment.price,
      });
    }
  } catch (emailError) {
    console.error("Failed to send bulk equipment confirmation email:", emailError);
  }

  return { count: bookings.length };
}

/**
 * Cancel an equipment booking and free up the associated slot
 * @param bookingId The ID of the booking to cancel
 * @returns Deleted booking record
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
 * Fetch the booking details required for cancellation email
 * @param bookingId The booking ID to fetch
 * @returns Object with userEmail, equipmentName, startTime, endTime or null
 */
export async function getBookingEmailDetails(bookingId: number): Promise<
  | {
      userEmail: string;
      equipmentName: string;
      startTime: Date;
      endTime: Date;
    }
  | null
> {
  const booking = await db.equipmentBooking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      equipment: true,
      user: { select: { email: true } },
    },
  });

  if (!booking || !booking.user?.email || !booking.slot || !booking.equipment) {
    return null;
  }

  return {
    userEmail: booking.user.email,
    equipmentName: booking.equipment.name,
    startTime: booking.slot.startTime,
    endTime: booking.slot.endTime,
  };
}

/**
 * Approve an equipment booking (Admin only)
 * @param bookingId The ID of the booking to approve
 * @returns Updated booking record with approved status
 */
export async function approveEquipmentBooking(bookingId: number) {
  return await db.equipmentBooking.update({
    where: { id: bookingId },
    data: { status: "approved" },
  });
}

/**
 * Add new equipment with optional workshop prerequisites (Admin only)
 * @param data Equipment data including name, description, price, availability, and prerequisites
 * @returns Created equipment record
 */
export async function addEquipment(data: {
  name: string;
  description: string;
  price: number;
  availability: boolean;
  workshopPrerequisites?: number[];
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

    if (data.workshopPrerequisites && data.workshopPrerequisites.length > 0) {
      await db.equipmentPrerequisite.createMany({
        data: data.workshopPrerequisites.map((prereqId) => ({
          equipmentId: newEquipment.id,
          workshopPrerequisiteId: prereqId,
        })),
      });
    }

    return newEquipment;
  } catch (error) {
    console.error("Error adding equipment:", error);
    throw new Error("Failed to add equipment.");
  }
}

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
 * Get available slots for a specific equipment that are not booked or assigned to workshops
 * @param equipmentId The ID of the equipment to get slots for
 * @returns Array of available equipment slots ordered by start time
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

/**
 * Find equipment by exact name match
 * @param name The exact name of the equipment to find
 * @returns Equipment record or null if not found
 */
export async function getEquipmentByName(name: string) {
  return await db.equipment.findFirst({
    where: { name },
  });
}

/**
 * Get available equipment for admin view with unbooked slots
 * @returns Array of available equipment with their unbooked slots
 */
export async function getAvailableEquipmentForAdmin() {
  const equipment = await db.equipment.findMany({
    where: { availability: true },
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

/**
 * Get equipment with comprehensive slot status information for booking interface
 * @param userId Optional user ID for personalized slot information
 * @param onlyAvailable Whether to filter for only available equipment
 * @returns Array of equipment with detailed slot information organized by day and time
 */
export async function getEquipmentSlotsWithStatus(
  userId?: number,
  onlyAvailable: boolean = false
) {
  const equipment = await db.equipment.findMany({
    where: onlyAvailable ? { availability: true } : undefined,
    include: {
      slots: {
        include: {
          bookings: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          workshopOccurrence: {
            select: {
              workshop: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });

  // Helper function to generate all possible slots for the calendar
  const generate24_7Slots = async () => {
    // Get the equipment_visible_registrable_days setting
    const visibleDaysStr = await getAdminSetting(
      "equipment_visible_registrable_days",
      "7"
    );
    const visibleDays = parseInt(visibleDaysStr, 10);

    const times = Array.from({ length: 48 }, (_, i) => {
      const hours = Math.floor(i / 2);
      const minutes = i % 2 === 0 ? "00" : "30";
      return `${hours.toString().padStart(2, "0")}:${minutes}`;
    });

    const fullSlots: { [day: string]: { [time: string]: any } } = {};
    const today = new Date();

    for (let i = 0; i < visibleDays; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayNumber = date.getDate();
      const dayKey = `${dayName} ${dayNumber}`;

      fullSlots[dayKey] = {};
      for (const time of times) {
        fullSlots[dayKey][time] = {
          id: null,
          isBooked: false,
          isAvailable: true,
          bookedByMe: false,
          workshopName: null,
          userFirstName: null,
          userLastName: null,
        };
      }
    }
    return fullSlots;
  };

  // Map each equipment to add slot status information
  return Promise.all(
    equipment.map(async (eq) => {
      const fullSlots = await generate24_7Slots();

      eq.slots.forEach((slot) => {
        const date = new Date(slot.startTime);
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const time = `${hours}:${minutes}`;

        // Format the day key to match our new format: "Day #"
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
        const dayNumber = date.getDate();
        const dayKey = `${dayName} ${dayNumber}`;

        const bookedByMe = userId
          ? slot.bookings?.some((booking) => booking.userId === userId)
          : false;

        // Get user data from the first booking for this slot (if any)
        const userBooking = slot.bookings?.find(
          (booking) =>
            booking.bookedFor === "user" || booking.bookedFor === undefined
        );
        const userFirstName = userBooking?.user?.firstName || null;
        const userLastName = userBooking?.user?.lastName || null;

        if (fullSlots[dayKey] && fullSlots[dayKey][time]) {
          fullSlots[dayKey][time] = {
            id: slot.id,
            isBooked: slot.isBooked,
            isAvailable: !slot.isBooked && !slot.workshopOccurrenceId,
            bookedByMe,
            workshopName: slot.workshopOccurrence?.workshop?.name || null,
            reservedForWorkshop: !!slot.workshopOccurrenceId,
            userFirstName,
            userLastName,
          };
        }
      });

      return {
        id: eq.id,
        name: eq.name,
        price: eq.price,
        slotsByDay: fullSlots,
      };
    })
  );
}

/**
 * Update existing equipment properties (Admin only)
 * @param equipmentId The ID of the equipment to update
 * @param data Partial equipment data to update
 * @returns Updated equipment record
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
 * Delete equipment and all associated slots (Admin only)
 * @param equipmentId The ID of the equipment to delete
 * @returns Deleted equipment record
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
 * Create a duplicate of existing equipment with "(Copy)" suffix (Admin only)
 * @param equipmentId The ID of the equipment to duplicate
 * @returns Created duplicate equipment record
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

/**
 * Fetch all equipment bookings for a specific user
 * @param userId The ID of the user whose bookings to fetch
 * @returns Array of booked equipment with booking details and status
 */
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

/**
 * Book multiple equipment slots for a workshop occurrence
 * @param workshopId The workshop occurrence ID to book equipment for
 * @param slots Array of slot IDs to book (negative IDs are filtered out)
 * @param userId The user ID making the booking
 * @returns Object with count of successfully booked slots
 */
export async function bulkBookEquipment(
  workshopId: number,
  slots: number[],
  userId: number
) {
  // Filter out negative IDs (these are the temporary IDs for workshop dates)
  const validSlots = slots.filter((id) => id > 0);

  // If no valid slots, just return success instead of proceeding
  if (validSlots.length === 0) {
    console.log("No valid slots to book - skipping bulkBookEquipment");
    return { count: 0 };
  }

  // Find which slots are actually available
  const availableSlots = await db.equipmentSlot.findMany({
    where: {
      id: { in: validSlots },
      isBooked: false,
    },
  });

  // Just log a warning and continue with available slots
  if (availableSlots.length !== validSlots.length) {
    console.warn(
      `Warning: Only ${availableSlots.length} of ${validSlots.length} requested slots are available. Proceeding with available slots.`
    );
  }

  // If no slots are available at all, return early
  if (availableSlots.length === 0) {
    console.log("No available slots found among the requested IDs - skipping");
    return { count: 0 };
  }

  // Get the IDs of the slots that are actually available
  const availableSlotIds = availableSlots.map((slot) => slot.id);

  // Update only the available slots
  await db.equipmentSlot.updateMany({
    where: { id: { in: availableSlotIds } },
    data: {
      isBooked: true,
      workshopOccurrenceId: workshopId,
    },
  });

  // Create equipment booking records only for available slots
  const bookings = await Promise.all(
    availableSlots.map((slot) =>
      db.equipmentBooking.create({
        data: {
          userId: userId,
          equipmentId: slot.equipmentId,
          slotId: slot.id,
          status: "pending",
          bookedFor: "workshop",
          workshopId: workshopId,
        },
      })
    )
  );

  return { count: bookings.length };
}

/**
 * Update the availability status of an equipment slot
 * @param slotId The ID of the slot to update
 * @param isAvailable Whether the slot should be available for booking
 * @returns Updated equipment slot record
 */
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

/**
 * Get available equipment slots within a specific date range for workshop booking
 * @param startDate Start date of the range to search
 * @param endDate End date of the range to search
 * @returns Array of available equipment slots within the date range
 */
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

/**
 * Fetch all equipment with detailed slot and booking information for admin view
 * @returns Array of all equipment with slots, bookings, and user details
 */
export async function getAllEquipmentWithBookings() {
  return await db.equipment.findMany({
    include: {
      slots: {
        include: {
          bookings: {
            select: {
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          workshopOccurrence: {
            select: {
              workshop: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Toggle the availability status of equipment (Admin only)
 * @param equipmentId The ID of the equipment to update
 * @param availability New availability status (true = available, false = disabled)
 * @returns Updated equipment record
 */
export async function toggleEquipmentAvailability(
  equipmentId: number,
  availability: boolean
) {
  return await db.equipment.update({
    where: { id: equipmentId },
    data: { availability },
  });
}

/**
 * Get schedule restrictions for level 3 users from admin settings
 * @returns Object containing daily schedule restrictions with start/end hours
 */
export async function getLevel3ScheduleRestrictions() {
  try {
    const settingStr = await getAdminSetting("level3_start_end_hours", "");
    if (!settingStr) {
      // Default schedule if setting is not found
      return {
        Sunday: { start: 9, end: 17 },
        Monday: { start: 9, end: 17 },
        Tuesday: { start: 9, end: 17 },
        Wednesday: { start: 9, end: 17 },
        Thursday: { start: 9, end: 17 },
        Friday: { start: 9, end: 17 },
        Saturday: { start: 9, end: 17 },
      };
    }

    return JSON.parse(settingStr);
  } catch (error) {
    console.error("Error fetching level 3 schedule restrictions:", error);
    // Fallback to default schedule
    return {
      Sunday: { start: 9, end: 17 },
      Monday: { start: 9, end: 17 },
      Tuesday: { start: 9, end: 17 },
      Wednesday: { start: 9, end: 17 },
      Thursday: { start: 9, end: 17 },
      Friday: { start: 9, end: 17 },
      Saturday: { start: 9, end: 17 },
    };
  }
}

/**
 * Get unavailable hours configuration for level 4 users from admin settings
 * @returns Object with start and end hours when level 4 users cannot book equipment
 */
export async function getLevel4UnavailableHours() {
  try {
    const setting = await db.adminSettings.findUnique({
      where: { key: "level4_unavaliable_hours" },
    });

    if (!setting) {
      // Return default - no restrictions
      return {
        start: 0,
        end: 0,
      };
    }

    return JSON.parse(setting.value);
  } catch (error) {
    console.error("Error fetching level 4 unavailable hours:", error);
    // Return default on error
    return {
      start: 0,
      end: 0,
    };
  }
}

/**
 * Create equipment slots for a workshop occurrence within the specified time range
 * @param equipmentId The ID of the equipment to create slots for
 * @param startTime Start time of the workshop occurrence
 * @param endTime End time of the workshop occurrence
 * @param workshopId The workshop occurrence ID to associate with slots
 * @param userId The user ID creating the slots (usually admin)
 * @returns Boolean indicating success of slot creation
 */
export async function createEquipmentSlotsForOccurrence(
  occurrenceId: number,
  equipmentId: number,
  startDate: Date,
  endDate: Date,
  userId: number // Add userId parameter
) {
  try {
    // Get the workshop ID from the occurrence first
    const occurrence = await db.workshopOccurrence.findUnique({
      where: { id: occurrenceId },
      select: { workshopId: true },
    });

    if (!occurrence) {
      throw new Error(`Workshop occurrence ${occurrenceId} not found`);
    }

    const workshopId = occurrence.workshopId;

    // Create 30-minute slots for the workshop duration
    const currentTime = new Date(startDate);
    while (currentTime < endDate) {
      // Try to find existing slot or create a new one
      try {
        // Check if slot already exists
        const existingSlot = await db.equipmentSlot.findFirst({
          where: {
            equipmentId,
            startTime: new Date(currentTime),
          },
        });

        let slotId: number;

        if (existingSlot) {
          // Update existing slot if not already booked for another workshop
          if (
            !existingSlot.workshopOccurrenceId ||
            existingSlot.workshopOccurrenceId === occurrenceId
          ) {
            await db.equipmentSlot.update({
              where: { id: existingSlot.id },
              data: {
                isBooked: true,
                workshopOccurrenceId: occurrenceId,
              },
            });
            slotId = existingSlot.id;
          } else {
            console.warn(
              `Slot already reserved for another workshop: Equipment ${equipmentId}, Time ${currentTime.toISOString()}`
            );
            // Move to next slot
            currentTime.setTime(currentTime.getTime() + 30 * 60000);
            continue;
          }
        } else {
          // Create new slot
          const slotEndTime = new Date(currentTime.getTime() + 30 * 60000);
          const newSlot = await db.equipmentSlot.create({
            data: {
              equipmentId,
              startTime: new Date(currentTime),
              endTime: slotEndTime,
              isBooked: true,
              workshopOccurrenceId: occurrenceId,
            },
          });
          slotId = newSlot.id;
        }

        // Now create a booking record in EquipmentBooking table
        try {
          // Check if booking already exists for this slot
          const existingBooking = await db.equipmentBooking.findFirst({
            where: { slotId: slotId },
          });

          if (!existingBooking) {
            await db.equipmentBooking.create({
              data: {
                userId: userId, // Use the userId of the logged-in admin
                equipmentId,
                slotId,
                status: "pending", // Keep default status as pending
                bookedFor: "workshop", // Set the new bookedFor field
                workshopId, // Connect to the workshop
              },
            });
          }
        } catch (bookingError) {
          console.error("Error creating equipment booking:", bookingError);
          // Continue even if booking creation fails
        }
      } catch (error) {
        console.error("Error creating/updating equipment slot:", error, {
          equipmentId,
          startTime: currentTime,
        });
        // Continue to next slot even if this one fails
      }

      // Move to next 30-minute slot
      currentTime.setTime(currentTime.getTime() + 30 * 60000);
    }

    return true;
  } catch (error) {
    console.error(
      "Failed to create equipment slots for workshop occurrence:",
      error
    );
    throw new Error("Failed to create equipment slots for workshop occurrence");
  }
}

/**
 * Check if a specific equipment slot is available for booking
 * @param equipmentId The ID of the equipment
 * @param startTime Start time of the slot to check
 * @param endTime End time of the slot to check
 * @returns Boolean indicating if the slot is available (true = available, false = conflicting)
 */
export async function checkSlotAvailability(
  equipmentId: number,
  startTime: Date
) {
  // Check if there's any existing slot that matches the criteria and is already booked
  const conflictingSlot = await db.equipmentSlot.findFirst({
    where: {
      equipmentId,
      startTime,
      isBooked: true,
    },
  });

  return !conflictingSlot; // Return true if no conflicting slot found
}

/**
 * Fetch all equipment regardless of availability status with slot information
 * @returns Array of all equipment with slot counts and calculated status
 */
export async function getAllEquipment() {
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
        availability: eq.availability, // Include availability status
        totalSlots: eq.slots.length,
        bookedSlots: eq.slots.filter((slot) => slot.isBooked).length,
        status: eq.availability ? "available" : "unavailable", // Only based on availability field
      }))
    );
}

/**
 * Get the list of prerequisite workshop IDs that a user has successfully completed for specific equipment
 * @param userId The ID of the user to check prerequisites for
 * @param equipmentId The ID of the equipment to check prerequisites for
 * @returns Array of completed prerequisite workshop IDs
 */
export async function getUserCompletedEquipmentPrerequisites(
  userId: number,
  equipmentId: number
) {
  if (!userId) return [];

  // First, get all prerequisite IDs for the equipment
  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      prerequisites: {
        select: { workshopPrerequisiteId: true },
      },
    },
  });

  if (!equipment || !equipment.prerequisites.length) return [];

  // Get the list of prerequisite IDs
  const prerequisiteIds = equipment.prerequisites.map(
    (p) => p.workshopPrerequisiteId
  );

  // Find all workshop occurrences the user has completed successfully
  const completedWorkshops = await db.userWorkshop.findMany({
    where: {
      userId: userId,
      workshopId: { in: prerequisiteIds },
      result: "passed",
    },
    select: {
      workshopId: true,
    },
  });

  // Return array of completed prerequisite workshop IDs
  return [...new Set(completedWorkshops.map((cw) => cw.workshopId))];
}

/**
 * Check if a user has completed all required prerequisites for specific equipment
 * @param userId The ID of the user to check
 * @param equipmentId The ID of the equipment to check prerequisites for
 * @returns Boolean indicating if all prerequisites are completed
 */
export async function hasUserCompletedEquipmentPrerequisites(
  userId: number,
  equipmentId: number
): Promise<boolean> {
  if (!userId) return false;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      prerequisites: {
        select: { workshopPrerequisiteId: true },
      },
    },
  });

  // If no prerequisites, user can use equipment
  if (!equipment || !equipment.prerequisites.length) return true;

  const completedPrerequisites = await getUserCompletedEquipmentPrerequisites(
    userId,
    equipmentId
  );
  const requiredPrerequisites = equipment.prerequisites.map(
    (p) => p.workshopPrerequisiteId
  );

  // Check if user has completed all required prerequisites
  return requiredPrerequisites.every((reqId) =>
    completedPrerequisites.includes(reqId)
  );
}
