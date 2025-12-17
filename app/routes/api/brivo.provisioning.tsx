import type { ActionFunctionArgs } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { brivoClient } from "~/services/brivo.server";
import { db } from "~/utils/db.server";
import { logger } from "~/logging/logger";

type ProvisioningResponse = {
  statuses: Record<string, boolean | null>;
};

function jsonResponse(payload: ProvisioningResponse, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseUserIds(input: FormDataEntryValue | null): number[] {
  if (typeof input !== "string" || input.trim() === "") return [];
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) return [];
  const ids = parsed
    .filter((v) => typeof v === "number" && Number.isInteger(v) && v > 0)
    .slice(0, 500);
  return Array.from(new Set(ids));
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toUpperCase() !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized Brivo provisioning access", { url: request.url });
    return jsonResponse({ statuses: {} }, 401);
  }

  const formData = await request.formData();
  const groupIdRaw = formData.get("groupId");
  const groupId = typeof groupIdRaw === "string" ? groupIdRaw.trim() : "";
  const userIds = parseUserIds(formData.get("userIds"));

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

  const checks = await mapWithConcurrency(
    eligible,
    8,
    async (u): Promise<[string, boolean]> => {
      const inGroup = await brivoClient.isUserInGroup(String(u.brivoPersonId), groupId);
      return [String(u.id), inGroup];
    },
  );

  const statuses: Record<string, boolean | null> = {};
  for (const [id, inGroup] of checks) {
    statuses[id] = inGroup;
  }

  return jsonResponse({ statuses });
}


