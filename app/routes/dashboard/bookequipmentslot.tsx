import { bookEquipment } from "~/models/equipment.server";

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { equipmentId, startTime, endTime } = body;

    if (!equipmentId || !startTime || !endTime) {
      return new Response(JSON.stringify({ error: "Missing required data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await bookEquipment(request, equipmentId, startTime, endTime);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Equipment slot booking error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}