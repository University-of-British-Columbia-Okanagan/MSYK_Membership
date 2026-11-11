import crypto from "crypto";
import { createCookieSessionStorage } from "react-router";
import type { SessionDbMock } from "./setup";

// Cookie helpers for session tests. Import after tests/fixtures/session/setup so
// SESSION_SECRET is set before anything reads it.

/** The "name=value" pair from a Set-Cookie header, ready for a Cookie header. */
export const cookiePair = (setCookieHeader: string) =>
  setCookieHeader.split(";")[0];

export const requestWithCookie = (setCookieHeader: string, init?: RequestInit) =>
  new Request("http://localhost:5173/dashboard", {
    ...init,
    headers: { Cookie: cookiePair(setCookieHeader) },
  });

/**
 * Reads the session payload out of a signed RJ_session cookie. The value is
 * base64 JSON followed by ".signature", so signing does not hide anything.
 */
export const decodeSessionCookie = (setCookieHeader: string) => {
  const raw = decodeURIComponent(cookiePair(setCookieHeader).split("=").slice(1).join("="));
  const payload = raw.slice(0, raw.lastIndexOf("."));
  const json = Buffer.from(payload, "base64").toString("utf8");
  return { json, data: JSON.parse(json) as Record<string, unknown> };
};

/**
 * Signs an arbitrary payload with the real secret, so a test can present a
 * cookie the server would accept as genuine (tampered fields, old formats).
 */
export const forgeSessionCookie = async (data: Record<string, unknown>) => {
  const storage = createCookieSessionStorage({
    cookie: { name: "RJ_session", secrets: [process.env.SESSION_SECRET!], path: "/" },
  });
  const session = await storage.getSession();
  for (const [key, value] of Object.entries(data)) session.set(key, value);
  return storage.commitSession(session);
};

export const expectedPwf = (passwordHash: string) =>
  crypto
    .createHmac("sha256", process.env.SESSION_SECRET!)
    .update(passwordHash)
    .digest("hex");

export type FakeUserRow = { id: number; password: string; sessionVersion: number };

/**
 * Backs user.findUnique and user.update with one mutable row, so a sessionVersion
 * bump or a password change made by one call is seen by the next.
 */
export const useFakeUserRow = (db: SessionDbMock, row: FakeUserRow) => {
  db.user.findUnique.mockImplementation(async ({ where }: any) =>
    where?.id === row.id ? { ...row } : null
  );
  db.user.update.mockImplementation(async ({ where, data }: any) => {
    if (where?.id !== row.id) throw new Error("Record to update not found.");
    if (data?.sessionVersion?.increment) row.sessionVersion += data.sessionVersion.increment;
    if (typeof data?.password === "string") row.password = data.password;
    return { ...row };
  });
  return row;
};
