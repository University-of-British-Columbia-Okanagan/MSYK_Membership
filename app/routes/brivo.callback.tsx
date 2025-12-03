import crypto from "crypto";
import type { ActionFunctionArgs } from "react-router";
import { logger } from "~/logging/logger";
import {
  getAccessCardByBrivoCredentialId,
  getUserIdByAccessCard,
} from "~/models/access_card.server";
import { logAccessEvent } from "~/models/accessLog.server";

type SecurityAction = {
  securityActionId: number;
  action: string;
  exception: boolean;
};

type ApiObject = {
  id: number;
  objectType?: string;
  name?: string;
  email?: string;
  deviceType?: {
    id: number;
    name: string;
  };
};

type Site = {
  id: number;
  siteName: string;
};

type Credential = {
  id?: number;
  reference_id?: string;
};

type EventData = {
  actorName?: string;
  actorUserTypeId?: number;
  objectName?: string;
  objectGroupName?: string;
  objectTypeId?: number;
  actionAllowed?: boolean;
  credentials?: Credential[];
  [key: string]: any;
};

type BrivoEvent = {
  uuid?: string;
  securityAction?: SecurityAction;
  actor?: ApiObject;
  eventObject?: ApiObject;
  site?: Site;
  occurred?: string;
  eventData?: EventData;
  credentials?: Credential[];
};

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

function resolveState(
  securityAction?: SecurityAction,
  eventData?: EventData,
): "enter" | "exit" | "denied" {
  if (eventData?.actionAllowed === false) {
    return "denied";
  }

  if (!securityAction?.action) {
    return "enter";
  }

  const actionLower = securityAction.action.toLowerCase();
  if (actionLower.includes("denied") || actionLower.includes("rejected")) {
    return "denied";
  }
  if (actionLower.includes("egress") || actionLower.includes("exit")) {
    return "exit";
  }
  if (actionLower.includes("ingress") || actionLower.includes("enter")) {
    return "enter";
  }

  return "enter";
}

async function resolveAccessCardId(event: BrivoEvent): Promise<string | null> {
  const credentials = event.credentials ?? event.eventData?.credentials ?? [];

  for (const credential of credentials) {
    if (credential.id !== undefined) {
      const credentialIdStr = String(credential.id);
      const card = await getAccessCardByBrivoCredentialId(credentialIdStr);
      if (card) return card.id;
    }

    if (credential.reference_id) {
      const card = await getAccessCardByBrivoCredentialId(credential.reference_id);
      if (card) return card.id;
    }
  }

  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ status: "method_not_allowed" }, { status: 405 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-brivo-signature");
  const webhookSecret = process.env.BRIVO_WEBHOOK_SECRET;

  if (webhookSecret) {
    if (!signatureHeader) {
      logger.warn("Received Brivo webhook without signature header", {
        path: request.url,
      });
      return Response.json({ status: "missing_signature" }, { status: 401 });
    }
    const valid = verifySignature(rawBody, signatureHeader, webhookSecret);
    if (!valid) {
      logger.warn("Received Brivo webhook with invalid signature", {
        path: request.url,
      });
      return Response.json({ status: "invalid_signature" }, { status: 401 });
    }
  }
  let event: BrivoEvent;
  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    logger.error("Failed to parse Brivo webhook payload", { error });
    return Response.json({ status: "invalid_payload" }, { status: 400 });
  }

  const securityActionId = event.securityAction?.securityActionId ?? 0;
  const action = event.securityAction?.action ?? "unknown";
  const cardId = await resolveAccessCardId(event);
  const state = resolveState(event.securityAction, event.eventData);
  const equipment =
    event.eventObject?.name ??
    event.eventData?.objectName ??
    "door";

  if (!cardId) {
    logger.warn("Brivo webhook received for unknown access card", {
      securityActionId,
      action,
      uuid: event.uuid,
      credentials: event.credentials ?? event.eventData?.credentials,
    });
    return Response.json({ status: "ignored" });
  }

  const userId = await getUserIdByAccessCard(cardId);

  await logAccessEvent(cardId, userId, equipment, state);
  logger.info("Brivo access event recorded", {
    securityActionId,
    action,
    uuid: event.uuid,
    cardId,
    userId,
    equipment,
    state,
  });

  return Response.json({ status: "ok" });
}