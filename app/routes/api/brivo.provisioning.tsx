import type { ActionFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { brivoClient } from "~/services/brivo.server";
import { db } from "~/utils/db.server";
import { logger } from "~/logging/logger";

type ProvisioningResponse = { statuses: Record<string, boolean> };

function jsonResponse(payload: ProvisioningResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 401 });
  }

  const formData = await request.formData();
  const groupId = String(formData.get("groupId") ?? "").trim();

  let userIds: number[];
  try {
    userIds = JSON.parse(String(formData.get("userIds") ?? "[]")) as number[];
  } catch {
    return new Response("Invalid userIds", { status: 400 });
  }

  userIds = userIds
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 500);

  if (!brivoClient.isEnabled() || !groupId || userIds.length === 0) {
    return jsonResponse({ statuses: {} });
  }

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, brivoPersonId: true, roleLevel: true, membershipStatus: true },
  });

  const eligible = users.filter(
    (u) =>
      u.roleLevel >= 4 &&
      u.membershipStatus !== "revoked" &&
      u.brivoPersonId !== null &&
      u.brivoPersonId !== "",
  );

  const statuses: Record<string, boolean> = {};
  const CONCURRENCY = 8;

  for (let i = 0; i < eligible.length; i += CONCURRENCY) {
    const chunk = eligible.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (u) => {
        try {
          const inGroup = await brivoClient.isUserInGroup(
            String(u.brivoPersonId),
            groupId,
          );
          return [String(u.id), inGroup] as const;
        } catch (error) {
          // Log error for debugging but continue processing other users
          logger.error(`Failed to check group membership for user ${u.id}:`, error);
          return [String(u.id), false] as const;
        }
      }),
    );

    for (const [id, inGroup] of results) {
      statuses[id] = inGroup;
    }
  }
  return jsonResponse({ statuses });
}


