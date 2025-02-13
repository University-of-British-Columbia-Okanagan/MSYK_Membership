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