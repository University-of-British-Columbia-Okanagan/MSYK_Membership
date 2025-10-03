import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { getAuthUrl } from "~/utils/googleCalendar.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized Google connect attempt", { url: request.url });
    throw new Response("Not Authorized", { status: 401 });
  }

  const url = await getAuthUrl();
  return redirect(url);
}


