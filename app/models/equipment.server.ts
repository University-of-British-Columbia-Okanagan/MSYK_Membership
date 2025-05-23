import { db } from "../utils/db.server";
import { getUserId } from "../utils/session.server";
import { getAdminSetting } from "../models/admin.server";

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
    if (day === 1 || day === 2) {
      throw new Error(
        "Level 3 members cannot book equipment on Monday or Tuesday."
      );
    }

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

// equipment.server.ts

// export async function getEquipmentSlotsWithStatus(userId?: number) {
//   const equipment = await db.equipment.findMany({
//     include: {
//       slots: {
//         include: {
//           bookings: true,
//           workshopOccurrence: {
//             select: {
//               workshop: {
//                 select: { name: true },
//               },
//             },
//           },
//         },
//         orderBy: { startTime: "asc" },
//       },
//     },
//   });

//   const generate24_7Slots = () => {
//     const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     const times = Array.from({ length: 48 }, (_, i) => {
//       const hours = Math.floor(i / 2);
//       const minutes = i % 2 === 0 ? "00" : "30";
//       return `${hours.toString().padStart(2, "0")}:${minutes}`;
//     });

//     const fullSlots: { [day: string]: { [time: string]: any } } = {};
//     for (const day of days) {
//       fullSlots[day] = {};
//       for (const time of times) {
//         fullSlots[day][time] = {
//           id: null,
//           isBooked: false,
//           isAvailable: true,
//           bookedByMe: false,
//           workshopName: null,
//         };
//       }
//     }
//     return fullSlots;
//   };

//   return equipment.map((eq) => {
//     const fullSlots = generate24_7Slots();

//     eq.slots.forEach((slot) => {
//       const date = new Date(slot.startTime);
//       const hours = String(date.getHours()).padStart(2, "0");
//       const minutes = String(date.getMinutes()).padStart(2, "0");
//       const time = `${hours}:${minutes}`;
//       const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];

//       const bookedByMe = userId
//         ? slot.bookings?.some((booking) => booking.userId === userId)
//         : false;

//       fullSlots[day][time] = {
//         id: slot.id,
//         isBooked: slot.isBooked,
//         isAvailable: !slot.isBooked && !slot.workshopOccurrenceId,
//         bookedByMe,
//         workshopName: slot.workshopOccurrence?.workshop?.name || null,
//         reservedForWorkshop: !!slot.workshopOccurrenceId,

//       };
//     });

//     return {
//       id: eq.id,
//       name: eq.name,
//       price: eq.price,
//       slotsByDay: fullSlots,
//     };
//   });
// }
export async function getEquipmentSlotsWithStatus(
  userId?: number,
  onlyAvailable: boolean = false
) {
  const equipment = await db.equipment.findMany({
    where: onlyAvailable ? { availability: true } : undefined,
    include: {
      slots: {
        include: {
          bookings: true,
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

        if (fullSlots[dayKey] && fullSlots[dayKey][time]) {
          fullSlots[dayKey][time] = {
            id: slot.id,
            isBooked: slot.isBooked,
            isAvailable: !slot.isBooked && !slot.workshopOccurrenceId,
            bookedByMe,
            workshopName: slot.workshopOccurrence?.workshop?.name || null,
            reservedForWorkshop: !!slot.workshopOccurrenceId,
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

// export async function bulkBookEquipment(workshopId: number, slots: number[]) {
//   const availableSlots = await db.equipmentSlot.findMany({
//     where: {
//       id: { in: slots },
//       isBooked: false,
//     },
//   });

//   if (availableSlots.length !== slots.length) {
//     throw new Error("One or more slots are already booked.");
//   }

//   return await db.equipmentSlot.updateMany({
//     where: { id: { in: slots } },
//     data: {
//       isBooked: true,
//       workshopOccurrenceId: workshopId,
//     },
//   });
// }
// In equipment.server.ts
// Find the bulkBookEquipment function and modify it:

export async function bulkBookEquipment(workshopId: number, slots: number[]) {
  // Filter out negative IDs (these are the temporary IDs for workshop slots)
  const validSlots = slots.filter(id => id > 0);
  
  // If no valid slots, just return success
  if (validSlots.length === 0) {
    return { count: 0 };
  }

  const availableSlots = await db.equipmentSlot.findMany({
    where: {
      id: { in: validSlots },
      isBooked: false,
    },
  });

  if (availableSlots.length !== validSlots.length) {
    throw new Error("One or more slots are already booked.");
  }

  // Update the slots to be booked and associated with the workshop
  await db.equipmentSlot.updateMany({
    where: { id: { in: validSlots } },
    data: {
      isBooked: true,
      workshopOccurrenceId: workshopId,
    },
  });

  // Create equipment booking records for each slot
  const bookings = await Promise.all(
    availableSlots.map(slot => 
      db.equipmentBooking.create({
        data: {
          userId: -1, // Special ID for workshop bookings
          equipmentId: slot.equipmentId,
          slotId: slot.id,
          status: "workshop",
          workshopId: workshopId, // Connect to the workshop
        },
      })
    )
  );

  return { count: bookings.length };
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
// Fetch all equipment with slot details and disabled status
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

// Toggle availability
export async function toggleEquipmentAvailability(
  equipmentId: number,
  availability: boolean
) {
  return await db.equipment.update({
    where: { id: equipmentId },
    data: { availability },
  });
}

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
 * Create equipment slots for workshop occurrences
 * This ensures that equipment is reserved during workshop times
 */
export async function createEquipmentSlotsForWorkshop(
  workshopOccurrenceId: number,
  equipmentIds: number[],
  occurrences: { startDate: Date; endDate: Date }[]
) {
  try {
    console.log("Creating equipment slots for workshop", {
      workshopOccurrenceId,
      equipmentIds,
      occurrences: occurrences.length,
    });

    // Process each equipment and occurrence
    for (const equipmentId of equipmentIds) {
      for (const occurrence of occurrences) {
        // Skip invalid dates
        if (isNaN(occurrence.startDate.getTime()) || isNaN(occurrence.endDate.getTime())) {
          console.warn("Skipping invalid date in occurrence", occurrence);
          continue;
        }
        
        const startTime = new Date(occurrence.startDate);
        const endTime = new Date(occurrence.endDate);
        
        // Create 30-minute slots for the workshop duration
        const currentTime = new Date(startTime);
        while (currentTime < endTime) {
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
              if (!existingSlot.workshopOccurrenceId || existingSlot.workshopOccurrenceId === workshopOccurrenceId) {
                await db.equipmentSlot.update({
                  where: { id: existingSlot.id },
                  data: {
                    isBooked: true,
                    workshopOccurrenceId,
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
              const newSlot = await db.equipmentSlot.create({
                data: {
                  equipmentId,
                  startTime: new Date(currentTime),
                  endTime: new Date(currentTime.getTime() + 30 * 60000),
                  isBooked: true,
                  workshopOccurrenceId,
                },
              });
              slotId = newSlot.id;
            }
            
            // Now create a booking record in EquipmentBooking table
            // We'll create this with a special userId of -1 to indicate it's a workshop booking
            // You can adjust this based on your schema requirements
            try {
              // Check if booking already exists for this slot
              const existingBooking = await db.equipmentBooking.findFirst({
                where: {
                  slotId: slotId,
                  status: "workshop", // Use "workshop" status to differentiate
                },
              });
              
              if (!existingBooking) {
                await db.equipmentBooking.create({
                  data: {
                    userId: -1, // Special user ID for workshop (adjust as needed)
                    equipmentId,
                    slotId,
                    status: "workshop", // Use special status for workshop bookings
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
      }
    }

    return true;
  } catch (error) {
    console.error("Failed to create equipment slots for workshop:", error);
    throw new Error("Failed to create equipment slots for workshop");
  }
}

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
          if (!existingSlot.workshopOccurrenceId || existingSlot.workshopOccurrenceId === occurrenceId) {
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
                status: "workshop", // Use special status for workshop bookings
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
    console.error("Failed to create equipment slots for workshop occurrence:", error);
    throw new Error("Failed to create equipment slots for workshop occurrence");
  }
}
