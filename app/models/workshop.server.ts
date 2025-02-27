import { db } from "../utils/db.server";

interface WorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST?: Date;
    endDatePST?: Date;
  }[];
}
/**
 * Fetch all workshops with their occurrences sorted by date.
 */
export async function getWorkshops() {
  const workshops = await db.workshop.findMany({
    orderBy: { id: "asc" },
    include: {
      occurrences: {
        orderBy: { startDate: "asc" },
      },
    },
  });
  return workshops;
}
/**
 * Add a new workshop along with its occurrences.
 */
export async function addWorkshop(data: WorkshopData) {
  try {
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

    // Insert occurrences separately after the workshop is created
    const occurrences = await Promise.all(
      data.occurrences.map((occ) =>
        db.workshopOccurrence.create({
          data: {
            workshopId: newWorkshop.id, // Link the occurrence to the newly created workshop
            startDate: occ.startDate, // Local time as entered.
            endDate: occ.endDate, // Local time as entered.
            startDatePST: occ.startDatePST, // UTC-converted value.
            endDatePST: occ.endDatePST, // UTC-converted value.
          },
        })
      )
    );

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
            // This includes all UserWorkshop rows for each occurrence
            userWorkshops: true,
          },
        },
      },
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    return workshop;
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
  data: {
    name: string;
    description: string;
    price: number;
    location: string;
    capacity: number;
    type: string;
    occurrences: {
      startDate: Date;
      endDate: Date;
      startDatePST?: Date;
      endDatePST?: Date;
    }[];
  }
) {
  // First, update the basic workshop details.
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

  // Optionally delete existing occurrences before re-creating them.
  await db.workshopOccurrence.deleteMany({ where: { workshopId } });

  // Get the current time for status comparison.
  const now = new Date();

  // Map each occurrence to include a computed status:
  const occurrencesData = data.occurrences.map((occ) => {
    // If the startDate is greater than or equal to now, set status to active; else past.
    const status = occ.startDate >= now ? "active" : "past";
    return {
      workshopId,
      startDate: occ.startDate,
      endDate: occ.endDate,
      startDatePST: occ.startDatePST,
      endDatePST: occ.endDatePST,
      status,
    };
  });

  // Insert the new occurrences.
  await db.workshopOccurrence.createMany({
    data: occurrencesData,
  });

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
  occurrenceId: number,
  userId: number
) {
  try {
    // Validate occurrence exists
    const occurrence = await db.workshopOccurrence.findUnique({
      where: { id: occurrenceId },
      include: { workshop: true },
    });

    if (!occurrence) {
      throw new Error("Workshop occurrence not found");
    }

    // Prevent past registrations
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

    // Register user for this occurrence
    await db.userWorkshop.create({
      data: {
        userId,
        workshopId: occurrence.workshop.id,
        occurrenceId,
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
  occurrenceId: number,
  userId: number
) {
  const registration = await db.userWorkshop.findFirst({
    where: { occurrenceId, userId }, // Check against occurrence, not just workshop
  });
  return !!registration;
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
  occurrenceId: number, // original occurrence id; you might use it for logging or additional logic if needed
  data: {
    startDate: Date;
    endDate: Date;
    startDatePST?: Date;
    endDatePST?: Date;
  }
) {
  try {
    const newOccurrence = await db.workshopOccurrence.create({
      data: {
        workshopId: workshopId,
        startDate: data.startDate,
        endDate: data.endDate,
        startDatePST: data.startDatePST, // if you need to store UTC conversion, compute it before passing
        endDatePST: data.endDatePST, // likewise for endDatePST
      },
    });
    return newOccurrence;
  } catch (error) {
    console.error("Error duplicating occurrence:", error);
    throw new Error("Failed to duplicate occurrence");
  }
}

export async function getRegistrationCountForOccurrence(occurrenceId: number) {
  return db.userWorkshop.count({
    where: { occurrenceId },
  });
}
