import { db } from "../utils/db.server";
import { getUser } from "~/utils/session.server";

interface WorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  prerequisites?: number[];
  equipments?: number[];
  occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST?: Date;
    endDatePST?: Date;
  }[];
}

interface OccurrenceData {
  id?: number;
  status?: string;
  userCount?: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date;
  endDatePST?: Date;
}

interface UpdateWorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  prerequisites?: number[];
  equipments?: number[];
  occurrences: OccurrenceData[];
}

/**
 * Fetch all workshops with their occurrences sorted by date.
 */
export async function getWorkshops() {
  const workshops = await db.workshop.findMany({
    orderBy: {
      id: "asc", // or "asc" if you prefer oldest-first
    },
    include: {
      occurrences: {
        orderBy: { startDate: "asc" },
      },
    },
  });

  return workshops.map((workshop) => {
    // Get the latest status from the most recent occurrence
    const latestStatus =
      workshop.occurrences.length > 0
        ? workshop.occurrences[workshop.occurrences.length - 1].status
        : "expired"; // Default to expired if no occurrences exist

    // Keep all existing fields in 'workshop',
    // then add/override status, and ensure 'type' is included.
    return {
      ...workshop,
      status: latestStatus,
      type: workshop.type, // explicitly include workshop.type
    };
  });
}

/**
 * Add a new workshop along with its occurrences and equipment.
 */
export async function addWorkshop(data: WorkshopData) {
  try {
    // Create the workshop first
    const newWorkshop = await db.workshop.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        location: data.location,
        capacity: data.capacity,
        type: data.type,
      },
    });

    // Insert occurrences
    const occurrences = await Promise.all(
      data.occurrences.map((occ) =>
        db.workshopOccurrence.create({
          data: {
            workshopId: newWorkshop.id,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status: occ.startDate >= new Date() ? "active" : "past",
          },
        })
      )
    );

    // Check if equipment is available before assigning it
    if (data.equipments && data.equipments.length > 0) {
      for (const equipmentId of data.equipments) {
        // Fetch all slots for this equipment
        const availableSlots = await db.equipmentSlot.findMany({
          where: {
            equipmentId,
            isBooked: false, // Fetch only available slots
          },
        });

        if (availableSlots.length === 0) {
          throw new Error(
            `Equipment ID ${equipmentId} has no available slots.`
          );
        }

        // Assign the first available slot
        const selectedSlot = availableSlots[0];

        await db.equipmentSlot.update({
          where: { id: selectedSlot.id },
          data: {
            workshopId: newWorkshop.id,
            isBooked: true, // Mark as booked
          },
        });
      }
    }

    return { ...newWorkshop, occurrences };
  } catch (error) {
    console.error("Error adding workshop:", error);
    throw new Error("Failed to add workshop");
  }
}


/**
 * Fetch a single workshop by ID including its occurrences order by startDate ascending.
 */
export async function getWorkshopById(workshopId: number) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        occurrences: {
          orderBy: {
            startDate: "asc",
          },
          include: {
            userWorkshops: true,
          },
        },
        prerequisites: {
          select: {
            prerequisiteId: true,
          },
        },
        equipmentSlots: {
          select: {
            equipmentId: true,
          },
        },
      },
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Flatten prerequisites and equipmentIds
    const prerequisites = workshop.prerequisites.map((p) => p.prerequisiteId);
    const equipments = workshop.equipmentSlots.map((e) => e.equipmentId);

    return {
      ...workshop,
      prerequisites,
      equipments,
    };
  } catch (error) {
    console.error("Error fetching workshop by ID:", error);
    throw new Error("Failed to fetch workshop");
  }
}

/**
 * Update a workshop, including modifying occurrences.
 */
export async function updateWorkshop(workshopId: number, data: WorkshopData) {
  try {
    // Update workshop details
    const updatedWorkshop = await db.workshop.update({
      where: { id: workshopId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        location: data.location,
        capacity: data.capacity,
        type: data.type,
      },
    });

    // Delete occurrences not included in the update
    await db.workshopOccurrence.deleteMany({ where: { workshopId } });

    // Add new occurrences
    await db.workshopOccurrence.createMany({
      data: data.occurrences.map((occ) => ({
        workshopId,
        startDate: occ.startDate,
        endDate: occ.endDate,
      })),
    });

    return updatedWorkshop;
  } catch (error) {
    console.error("Error updating workshop:", error);
    throw new Error("Failed to update workshop");
  }
}

/**
 * Update the workshop table, then remove all old occurrences and insert new ones.
 */
export async function updateWorkshopWithOccurrences(
  workshopId: number,
  data: UpdateWorkshopData
) {
  await db.workshop.update({
    where: { id: workshopId },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      location: data.location,
      capacity: data.capacity,
      type: data.type,
    },
  });

  if (data.prerequisites) {
    await db.workshopPrerequisite.deleteMany({ where: { workshopId } });

    if (data.prerequisites.length > 0) {
      const sortedPrereqs = [...data.prerequisites].sort((a, b) => a - b);
      await db.workshopPrerequisite.createMany({
        data: sortedPrereqs.map((prereqId) => ({
          workshopId,
          prerequisiteId: prereqId,
        })),
      });
    }
  }


  // 3) Update occurrences
  const existingOccurrences = await db.workshopOccurrence.findMany({
    where: { workshopId },
  });
  const existingIds = existingOccurrences.map((occ) => occ.id);

  const updateOccurrences = data.occurrences.filter((o) => o.id);
  const createOccurrences = data.occurrences.filter((o) => !o.id);
  const updateIds = updateOccurrences.map((o) => o.id!);
  const deleteIds = existingIds.filter((id) => !updateIds.includes(id));

  if (createOccurrences.length > 0) {
    const now = new Date();
    await db.workshopOccurrence.createMany({
      data: createOccurrences.map((occ) => {
        const status =
          occ.status === "cancelled"
            ? "cancelled"
            : occ.startDate >= now
            ? "active"
            : "past";
        return {
          workshopId,
          startDate: occ.startDate,
          endDate: occ.endDate,
          startDatePST: occ.startDatePST,
          endDatePST: occ.endDatePST,
          status,
        };
      }),
    });
  }

  for (const occ of updateOccurrences) {
    const now = new Date();
    const status =
      occ.status === "cancelled"
        ? "cancelled"
        : occ.startDate >= now
        ? "active"
        : "past";

    await db.workshopOccurrence.update({
      where: { id: occ.id },
      data: {
        startDate: occ.startDate,
        endDate: occ.endDate,
        startDatePST: occ.startDatePST,
        endDatePST: occ.endDatePST,
        status,
      },
    });
  }

  if (deleteIds.length > 0) {
    await db.workshopOccurrence.deleteMany({
      where: { id: { in: deleteIds } },
    });
  }

  // 4) Return updated workshop
  return db.workshop.findUnique({ where: { id: workshopId } });
}

/**
 * Delete a workshop and its occurrences.
 */
export async function deleteWorkshop(workshopId: number) {
  try {
    await db.workshop.delete({
      where: { id: workshopId },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting workshop:", error);
    throw new Error("Failed to delete workshop");
  }
}

/**
 * Register a user for a specific workshop occurrence.
 */
export async function registerForWorkshop(
  workshopId: number,
  occurrenceId: number,
  userId: number
) {
  try {
    // Validate occurrence exists and belongs to the specified workshop
    const occurrence = await db.workshopOccurrence.findUnique({
      where: { id: occurrenceId },
      include: { workshop: true },
    });

    if (!occurrence || occurrence.workshop.id !== workshopId) {
      throw new Error(
        "Workshop occurrence not found for the specified workshop"
      );
    }

    // Prevent registrations for past occurrences
    const now = new Date();
    if (new Date(occurrence.startDate) < now) {
      throw new Error("Cannot register for past workshops.");
    }

    // Check if the user is already registered for this occurrence
    const existingRegistration = await db.userWorkshop.findFirst({
      where: { userId, occurrenceId },
    });

    if (existingRegistration) {
      throw new Error("User already registered for this session.");
    }

    // Determine registration result based on workshop type.
    // If the workshop type is "orientation", set result to "pending".
    const registrationResult =
      occurrence.workshop.type.toLowerCase() === "orientation"
        ? "pending"
        : undefined;

    // Register user for this occurrence, including the result field if applicable.
    await db.userWorkshop.create({
      data: {
        userId,
        workshopId: occurrence.workshop.id,
        occurrenceId,
        ...(registrationResult ? { result: registrationResult } : {}),
      },
    });

    return {
      success: true,
      workshopName: occurrence.workshop.name,
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
    };
  } catch (error) {
    console.error("Error registering for workshop:", error);
    throw error;
  }
}

/**
 * Check if a user is registered for a specific workshop occurrence.
 */
export async function checkUserRegistration(
  workshopId: number,
  userId: number,
  occurrenceId: number
): Promise<{ registered: boolean; registeredAt: Date | null }> {
  // Example: find the row in the UserWorkshop table
  const userWorkshop = await db.userWorkshop.findFirst({
    where: {
      userId: userId,
      workshopId: workshopId,
      occurrenceId: occurrenceId,
      // possibly filter by some "status": "active" if you track canceled status
    },
  });

  if (!userWorkshop) {
    return { registered: false, registeredAt: null };
  }

  return { registered: true, registeredAt: userWorkshop.date };
  // or userWorkshop.createdAt, whichever column holds the registration time
}

export async function duplicateWorkshop(workshopId: number) {
  try {
    return await db.$transaction(async (prisma) => {
      // 1. Get original workshop with occurrences
      const originalWorkshop = await prisma.workshop.findUnique({
        where: { id: workshopId },
        include: { occurrences: true },
      });

      if (!originalWorkshop) {
        throw new Error("Workshop not found");
      }

      // 2. Create copied workshop with "(Copy)" suffix
      const newWorkshop = await prisma.workshop.create({
        data: {
          name: originalWorkshop.name,
          description: originalWorkshop.description,
          price: originalWorkshop.price,
          location: originalWorkshop.location,
          capacity: originalWorkshop.capacity,
          type: originalWorkshop.type,
        },
      });

      // 3. Duplicate all occurrences with new workshopId
      if (originalWorkshop.occurrences.length > 0) {
        await prisma.workshopOccurrence.createMany({
          data: originalWorkshop.occurrences.map((occ) => ({
            workshopId: newWorkshop.id,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
          })),
        });
      }

      // Return the duplicated workshop with occurrences
      return prisma.workshop.findUnique({
        where: { id: newWorkshop.id },
        include: { occurrences: true },
      });
    });
  } catch (error) {
    console.error("Error duplicating workshop:", error);
    throw new Error("Failed to duplicate workshop");
  }
}

/**
 * Fetch a single occurrence by workshopId and occurrenceId.
 */
export async function getWorkshopOccurrence(
  workshopId: number,
  occurrenceId: number
) {
  try {
    const occurrence = await db.workshopOccurrence.findFirst({
      where: {
        id: occurrenceId,
        workshopId: workshopId,
      },
    });

    if (!occurrence) {
      throw new Error("Occurrence not found");
    }
    return occurrence;
  } catch (error) {
    console.error("Error fetching workshop occurrence:", error);
    throw new Error("Failed to fetch workshop occurrence");
  }
}

/**
 * Duplicate an occurrence with new start/end dates.
 * This creates a new occurrence for the given workshop.
 */
export async function duplicateOccurrence(
  workshopId: number,
  occurrenceId: number,
  newDates: {
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }
) {
  // Fetch the original occurrence for reference
  const original = await db.workshopOccurrence.findUnique({
    where: { id: occurrenceId },
  });
  if (!original) {
    throw new Error("Occurrence not found");
  }

  // Calculate new status based on the new startDate
  const now = new Date();
  let newStatus: "active" | "past" | "cancelled" = "active";
  if (newDates.startDate < now) {
    newStatus = "past";
  }
  // (Optionally, you can also add logic to preserve a cancelled flag,
  //  if you want cancelled occurrences to require special handling.)

  // Create a new occurrence with the new dates and computed status.
  const newOccurrence = await db.workshopOccurrence.create({
    data: {
      workshopId,
      startDate: newDates.startDate,
      endDate: newDates.endDate,
      startDatePST: newDates.startDatePST,
      endDatePST: newDates.endDatePST,
      status: newStatus,
      // Copy additional fields as needed (capacity, etc.)
    },
  });

  return newOccurrence;
}

export async function getRegistrationCountForOccurrence(occurrenceId: number) {
  return db.userWorkshop.count({
    where: { occurrenceId },
  });
}

export async function cancelWorkshopOccurrence(occurrenceId: number) {
  return db.workshopOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "cancelled" },
  });
}

/**
 * Get the list of prerequisite workshop IDs that a user has successfully completed
 */
export async function getUserCompletedPrerequisites(
  userId: number,
  workshopId: number
) {
  if (!userId) return [];

  // First, get all prerequisite IDs for the workshop
  const workshop = await db.workshop.findUnique({
    where: { id: workshopId },
    include: {
      prerequisites: {
        select: { prerequisiteId: true },
      },
    },
  });

  if (!workshop || !workshop.prerequisites.length) return [];

  // Get the list of prerequisite IDs
  const prerequisiteIds = workshop.prerequisites.map((p) => p.prerequisiteId);

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
export async function getUserWorkshops(request: Request) {
  // Get the logged-in user
  const user = await getUser(request);

  if (!user) {
    throw new Response("Not authenticated", { status: 401 });
  }

  // Fetch workshops the user is registered for
  const userWorkshops = await db.userWorkshop.findMany({
    where: { userId: user.id },
    include: { workshop: true },
  });

  return userWorkshops.map((entry) => entry.workshop);
}

export async function getAllRegistrations() {
  return db.userWorkshop.findMany({
    orderBy: {
      date: "asc", // or "asc" if you prefer oldest-first
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      workshop: {
        select: {
          name: true,
          type: true, // Include the workshop type
        },
      },
      occurrence: {
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });
}

export async function updateRegistrationResult(
  registrationId: number,
  newResult: string
) {
  // newResult should be one of "passed", "failed", or "pending"
  return db.userWorkshop.update({
    where: { id: registrationId },
    data: { result: newResult },
  });
}

export async function updateMultipleRegistrations(
  registrationIds: number[],
  newResult: string
) {
  return db.userWorkshop.updateMany({
    where: {
      id: { in: registrationIds },
    },
    data: { result: newResult },
  });
}

export async function getUserWorkshopRegistrations(userId: number) {
  return db.userWorkshop.findMany({
    where: {
      userId,
    },
    select: {
      occurrenceId: true,
    },
  });
}

// This function fetches all workshops for which a user is registered,
// along with the full "occurrences" array for each workshop.
export async function getUserWorkshopsWithOccurrences(userId: number) {
  // 1. Find all userWorkshop records for the given user
  const userWorkshops = await db.userWorkshop.findMany({
    where: { userId },
    // 2. Include the occurrence -> workshop -> occurrences
    include: {
      occurrence: {
        include: {
          workshop: {
            include: {
              occurrences: true,
            },
          },
        },
      },
    },
  });

  // 3. userWorkshops is an array of { occurrence: { workshop: { ... } } }.
  //    Transform it into a simple array of workshop objects with an occurrences array.
  const workshopMap = new Map<number, any>();

  for (const uw of userWorkshops) {
    const w = uw.occurrence.workshop;
    // If we haven't seen this workshop yet, store it
    if (!workshopMap.has(w.id)) {
      workshopMap.set(w.id, {
        id: w.id,
        name: w.name,
        description: w.description,
        price: w.price,
        type: w.type,
        // "occurrences" is already included because we used { include: { occurrences: true } }
        occurrences: w.occurrences ?? [],
      });
    }
  }

  // Return a deduplicated array of workshop objects (each has an occurrences array)
  return Array.from(workshopMap.values());
}

export async function getUserWorkshopRegistrationsByWorkshopId(
  workshopId: number
) {
  return db.userWorkshop.findMany({
    where: {
      occurrence: {
        workshopId, // Only registrations for occurrences belonging to this workshop
      },
    },
    include: {
      user: true,
      occurrence: true,
      workshop: true,
      // Optionally include workshop data if needed:
      // occurrence: { include: { workshop: true } }
    },
  });
}
