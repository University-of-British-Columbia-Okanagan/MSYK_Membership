import { logger } from "~/logging/logger";
import { bookEquipment } from "~/models/equipment.server";

export async function action({ request }: { request: Request }) {
  try {
    const body = await request.json();
    const { equipmentId, startTime, endTime, paymentIntentId } = body;

    if (!equipmentId || !startTime || !endTime) {
      return new Response(JSON.stringify({ error: "Missing required data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info("Attempting to book equipment slot", {
      url: request.url,
    });

    await bookEquipment(
      request,
      equipmentId,
      startTime,
      endTime,
      paymentIntentId
    );

    logger.info("Equipment booked successfully", {
      url: request.url,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error(`Equipment booking failed ${error}`, {
      url: request.url,
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
