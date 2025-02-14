import { db } from "../utils/db.server";

interface WorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  occurrences: { startDate: Date; endDate: Date }[];
}
/**
 * Fetch all workshops with their occurrences sorted by date.
 */
export async function getWorkshops() {
  const workshops = await db.workshop.findMany({
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
        occurrences: {
          create: data.occurrences.map((occ) => ({
            startDate: occ.startDate,
            endDate: occ.endDate,
          })),
        },
      },
      include: { occurrences: true }, // Ensure occurrences are returned
    });

    return newWorkshop;
  } catch (error) {
    console.error("Error adding workshop:", error);
    throw new Error("Failed to add workshop");
  }
}
/**
 * Fetch a single workshop by ID including its occurrences.
 */
export async function getWorkshopById(workshopId: number) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: { occurrences: true },
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

    // Check if the workshop is full
    const registrationCount = await db.userWorkshop.count({
      where: { workshopId: occurrence.workshop.id },
    });

    if (registrationCount >= occurrence.workshop.capacity) {
      throw new Error("Workshop is full");
    }

    // Check if the user is already registered
    const existingRegistration = await db.userWorkshop.findFirst({
      where: { userId, workshopId: occurrence.workshop.id },
    });

    if (existingRegistration) {
      throw new Error("User already registered for this workshop occurrence");
    }

    // Register user for this occurrence
    await db.userWorkshop.create({
      data: {
        userId,
        workshopId: occurrence.workshop.id,
        type: "workshop",
      },
    });

    return { success: true, workshopName: occurrence.workshop.name };
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
    where: { workshopId: occurrenceId, userId },
  });
  return !!registration;
}
