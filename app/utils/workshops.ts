import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Fetch all workshops
export async function loader() {
  try {
    const workshops = await prisma.Workshop.findMany();
    return json(workshops);
  } catch (error) {
    return json({ error: "Failed to fetch workshops" }, { status: 500 });
  }
}

// POST: Add a new workshop
export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    const newWorkshop = await prisma.workshop.create({
      data: {
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        eventDate: new Date(data.eventDate),
        location: data.location,
        capacity: parseInt(data.capacity),
        status: data.status || "upcoming",
      },
    });

    return json(newWorkshop, { status: 201 });
  } catch (error) {
    return json({ error: "Failed to create workshop" }, { status: 500 });
  }
}
