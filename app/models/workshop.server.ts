import { db } from "../utils/db.server";
import { format } from "date-fns";

interface WorkshopData {
  name: string;
  description: string;
  price: number;
  eventDate: Date; // Expecting formatted string "YYYY-MM-DD HH:mm:ss"
  location: string;
  capacity: number;
  status: "upcoming" | "ongoing" | "completed";
}

export async function getWorkshops() {
  const workshops = await db.workshop.findMany({
    orderBy: {
      id: "asc",
    },
  });
  return workshops;
}

export async function addWorkshop(data: WorkshopData) {
  try {
    // // Convert eventDate to a proper Date object
    // const eventDate = new Date(data.eventDate);
    // // Format eventDate to "YYYY-MM-DD HH:mm:ss"
    // const formattedEventDate = format(eventDate, "yyyy-MM-dd HH:mm:ss");

    const newWorkshop = await db.workshop.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        eventDate: data.eventDate, // Store as ISO-8601 automatically
        location: data.location,
        capacity: data.capacity,
        status: data.status,
      },
    });

    return newWorkshop;
  } catch (error) {
    console.error("Error adding workshop:", error);
    throw new Error("Failed to add workshop");
  }
}

export async function getWorkshopById(workshopId: number) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
    });

    return workshop;
  } catch (error) {
    console.error("Error fetching workshop by ID:", error);
    throw new Error("Failed to fetch workshop");
  }
}

export async function updateWorkshop(workshopId: number, data: WorkshopData) {
  try {
    const updatedWorkshop = await db.workshop.update({
      where: { id: workshopId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        eventDate: data.eventDate, // Ensure this is in Date format
        location: data.location,
        capacity: data.capacity,
        status: data.status,
      },
    });

    return updatedWorkshop;
  } catch (error) {
    console.error("Error updating workshop:", error);
    throw new Error("Failed to update workshop");
  }
}

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
//users should be able to register for a workshop
export async function registerForWorkshop(workshopId: number, userId: number) {
  try {
    // Check if the workshop exists and has available capacity
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: { userWorkshops: true },
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    if (workshop.userWorkshops.length >= workshop.capacity) {
      throw new Error("Workshop is full");
    }

    // Check if the user is already registered
    const existingRegistration = await db.userWorkshop.findUnique({
      where: {
        userId_workshopId: {
          userId,
          workshopId,
        },
      },
    });

    if (existingRegistration) {
      throw new Error("User already registered for this workshop");
    }

    // Create a new registration
    await db.userWorkshop.create({
      data: {
        userId,
        workshopId,
        type: "workshop",
      },
    });

    return { success: true, workshopName: workshop.name };
  } catch (error) {
    console.error("Error registering for workshop:", error);
    throw error;
  }
}
export async function checkUserRegistration(workshopId: number, userId: number) {
  const registration = await db.userWorkshop.findFirst({
    where: { workshopId, userId },
  });
  return !!registration;
}