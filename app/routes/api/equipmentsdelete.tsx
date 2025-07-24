import { logger } from "~/logging/logger";
import { deleteEquipment } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server";

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const currentUserRole = await getRoleUser(request);
  if (currentUserRole?.roleName !== "Admin") {
    logger.warn(
      `[User: ${
        currentUserRole?.userId ?? "unknown"
      }] Not authorized to delete equipment`,
      {
        url: request.url,
      }
    );
    throw new Response("Access Denied", { status: 403 });
  }

  const equipmentId = parseInt(params.id);

  try {
    await deleteEquipment(equipmentId);
    logger.info(
      `[User: ${
        currentUserRole?.userId ?? "unknown"
      }] Equipment ${equipmentId} deleted successfully`,
      {
        url: request.url,
      }
    );
    return { success: true };
  } catch (error) {
    logger.error(`Failed to delete equipment: ${error}`, {
      url: request.url,
    });
    return { success: false, error: "Failed to delete equipment" };
  }
}
