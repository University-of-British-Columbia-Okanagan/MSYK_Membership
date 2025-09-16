import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { handleOAuthCallbackAndStore } from "~/utils/googleCalendar.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized Google callback access", { url: request.url });
    throw new Response("Not Authorized", { status: 401 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    throw new Response("Missing code", { status: 400 });
  }

  await handleOAuthCallbackAndStore(code);
  return redirect("/dashboard/admin/settings");
}


