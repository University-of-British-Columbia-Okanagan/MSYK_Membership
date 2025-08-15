import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";

export const action: ActionFunction = async ({ request }) => {
  const body = await request.json();
  console.log("Received Brivo callback:", body);
  return json({ status: "ok" });
};