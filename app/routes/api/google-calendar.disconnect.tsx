import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { clearGoogleCalendarAuth } from "~/models/admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized Google disconnect attempt", { url: request.url });
    throw new Response("Not Authorized", { status: 401 });
  }

  await clearGoogleCalendarAuth();
  return redirect("/dashboard/admin/settings");
}


