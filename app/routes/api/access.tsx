import jwt from "jsonwebtoken";
import { ActionFunctionArgs } from "react-router-dom";
import { logger } from "~/logging/logger";
import { getUserIdByAccessCard, hasPermissionForType } from "~/models/access_card.server";
import { logAccessEvent } from "~/models/accessLog.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const accessCardId = formData.get("accessCardId") as string;
  const accessToken = formData.get("accessToken") as string;
  const state = formData.get("state") as string;

  if (!accessToken) {
    return {
      success: false,
      message: "Access token is required.",
    };
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET as string, {
      algorithms: ["HS256"],
    });

    const type = (decoded as any).type;
    const tag = (decoded as any).tag;

    const userId = await getUserIdByAccessCard(accessCardId);

    const allowed = await hasPermissionForType(accessCardId, type);

    if (!allowed) {
      await logAccessEvent(accessCardId, userId, `${type} - ${tag}`, "denied");
      return { success: false, message: `User does not have permission for ${type}.` };
    }

    await logAccessEvent(accessCardId, userId, `${type} - ${tag}`, state);

    return {
      success: true,
      data: decoded,
      message: "Access granted and logged successfully.",
    };
  } catch (err) {
    logger.error(`Error updating access card: ${err}`, {
      url: request.url,
      accessCardId,
    });
    return {
      success: false,
      message: err instanceof Error ? err.message : "Invalid access token.",
    };
  }
}