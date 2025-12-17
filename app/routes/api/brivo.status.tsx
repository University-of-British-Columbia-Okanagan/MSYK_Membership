import type { LoaderFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { brivoClient } from "~/services/brivo.server";
import { getAdminSetting } from "~/models/admin.server";
import { logger } from "~/logging/logger";

type BrivoStatusResponse = {
  enabled: boolean;
  accessGroupLevel4: string;
  subscriptions: Array<{
    id: number;
    name: string;
    url: string;
    errorEmail: string;
  }>;
  groups: Array<{ id: number; name: string }>;
};

function jsonResponse(payload: BrivoStatusResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized Brivo status access", { url: request.url });
    return jsonResponse(
      { enabled: false, accessGroupLevel4: "", subscriptions: [], groups: [] },
      401,
    );
  }

  const enabled = brivoClient.isEnabled();
  const accessGroupLevel4 = await getAdminSetting(
    "brivo_access_group_level4",
    process.env.BRIVO_ACCESS_GROUP_LEVEL4 ?? "",
  );

  if (!enabled) {
    return jsonResponse({
      enabled,
      accessGroupLevel4,
      subscriptions: [],
      groups: [],
    });
  }

  const [subscriptions, groups] = await Promise.all([
    brivoClient.listEventSubscriptions().catch((err) => {
      logger.error("Failed to fetch Brivo event subscriptions", { error: err });
      return [];
    }),
    brivoClient.listGroups().catch((err) => {
      logger.error("Failed to fetch Brivo groups", { error: err });
      return [];
    }),
  ]);
  return jsonResponse({
    enabled,
    accessGroupLevel4,
    subscriptions,
    groups,
  });
}


