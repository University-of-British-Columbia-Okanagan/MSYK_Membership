import "tests/fixtures/session/setup";

import { getSessionMocks, resetSessionMocks } from "tests/fixtures/session/setup";
import type { SessionDbMock } from "tests/fixtures/session/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  login,
  logout,
  getUserId,
  getUser,
  getRoleUser,
  createUserSession,
  findUserByEmail,
  updateUserPassword,
} from "~/utils/session.server";

/**
 * Builds a Request carrying the session cookie that createUserSession issued.
 * This exercises the real cookie round-trip rather than stubbing the session,
 * which is the only way to meaningfully test expiry and password invalidation.
 */
const requestWithSessionCookie = (setCookieHeader: string) =>
  new Request("http://localhost:5173/dashboard", {
    headers: { Cookie: setCookieHeader.split(";")[0] },
  });

const sessionCookieFor = async (userId: number, password: string) => {
  const response = await createUserSession(userId, password, "/dashboard/user");
  const setCookie = response.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("createUserSession did not set a cookie");
  return setCookie;
};

describe("session.server - authentication and session lifecycle", () => {
  let db: SessionDbMock;
  let bcryptCompareMock: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    resetSessionMocks();
    const mocks = getSessionMocks();
    db = mocks.db;
    bcryptCompareMock = mocks.bcryptCompareMock as unknown as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("login", () => {
    it("looks up the email case-insensitively", async () => {
      db.user.findFirst.mockResolvedValue({
        id: 1,
        email: "person@example.com",
        password: "hashed:correct-horse",
        roleUserId: 1,
      });

      await login({ email: "PERSON@EXAMPLE.COM", password: "correct-horse" });

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { equals: "PERSON@EXAMPLE.COM", mode: "insensitive" },
          },
        })
      );
    });

    it("returns the raw submitted password so it can be stored in the session", async () => {
      db.user.findFirst.mockResolvedValue({
        id: 7,
        email: "person@example.com",
        password: "hashed:correct-horse",
        roleUserId: 2,
      });

      const result = await login({
        email: "person@example.com",
        password: "correct-horse",
      });

      expect(result).toEqual({
        id: 7,
        email: "person@example.com",
        roleUserId: 2,
        password: "correct-horse",
      });
    });

    it("rejects an unregistered email without comparing a password", async () => {
      db.user.findFirst.mockResolvedValue(null);

      const result = await login({
        email: "nobody@example.com",
        password: "whatever",
      });

      expect(result).toEqual({
        errors: { email: ["This email is not registered."] },
      });
      expect(bcryptCompareMock).not.toHaveBeenCalled();
    });

    it("rejects an incorrect password", async () => {
      db.user.findFirst.mockResolvedValue({
        id: 1,
        email: "person@example.com",
        password: "hashed:correct-horse",
        roleUserId: 1,
      });

      const result = await login({
        email: "person@example.com",
        password: "wrong-password",
      });

      expect(result).toEqual({ errors: { password: ["Incorrect password"] } });
    });

    it("returns field errors when the payload fails schema validation", async () => {
      const result = (await login({ email: "not-an-email", password: "" })) as {
        errors: Record<string, string[]>;
      };

      expect(result.errors).toBeDefined();
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("createUserSession", () => {
    it("redirects to the requested destination with a session cookie", async () => {
      const response = await createUserSession(1, "correct-horse", "/dashboard/user");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard/user");
      expect(response.headers.get("Set-Cookie")).toContain("RJ_session");
    });
  });

  describe("getUserId", () => {
    it("returns the user id for a valid, fresh session", async () => {
      const cookie = await sessionCookieFor(1, "correct-horse");
      db.user.findUnique.mockResolvedValue({
        id: 1,
        password: "hashed:correct-horse",
      });

      const userId = await getUserId(requestWithSessionCookie(cookie));

      expect(userId).toBe("1");
    });

    it("logs out when there is no session cookie at all", async () => {
      const userId = await getUserId(new Request("http://localhost:5173/dashboard"));

      expect(userId).toBeNull();
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("logs out once the session passes the 3 hour limit", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const cookie = await sessionCookieFor(1, "correct-horse");
      db.user.findUnique.mockResolvedValue({
        id: 1,
        password: "hashed:correct-horse",
      });

      // 2h59m — still inside the window
      jest.setSystemTime(new Date("2026-01-01T02:59:00Z"));
      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBe("1");

      // 3h01m — past it
      jest.setSystemTime(new Date("2026-01-01T03:01:00Z"));
      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("logs out when the account no longer exists", async () => {
      const cookie = await sessionCookieFor(1, "correct-horse");
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("invalidates the session when the stored password no longer matches", async () => {
      const cookie = await sessionCookieFor(1, "old-password");

      // Session still carries "old-password"; the account has since been changed.
      db.user.findUnique.mockResolvedValue({
        id: 1,
        password: "hashed:new-password",
      });

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
      expect(bcryptCompareMock).toHaveBeenCalledWith(
        "old-password",
        "hashed:new-password"
      );
    });
  });

  describe("getUser", () => {
    it("returns the id, email and role level for a valid session", async () => {
      const cookie = await sessionCookieFor(4, "correct-horse");
      db.user.findUnique
        .mockResolvedValueOnce({ id: 4, password: "hashed:correct-horse" })
        .mockResolvedValueOnce({
          id: 4,
          email: "person@example.com",
          roleLevel: 3,
        });

      const user = await getUser(requestWithSessionCookie(cookie));

      expect(user).toEqual({
        id: 4,
        email: "person@example.com",
        roleLevel: 3,
      });
    });

    it("returns null when the session is invalid", async () => {
      const user = await getUser(new Request("http://localhost:5173/dashboard"));

      expect(user).toBeNull();
    });
  });

  describe("getRoleUser", () => {
    it("flattens the role relation into userId, roleId and roleName", async () => {
      const cookie = await sessionCookieFor(2, "correct-horse");
      db.user.findUnique
        .mockResolvedValueOnce({ id: 2, password: "hashed:correct-horse" })
        .mockResolvedValueOnce({
          id: 2,
          roleUser: { id: 2, name: "Admin" },
        });

      const roleUser = await getRoleUser(requestWithSessionCookie(cookie));

      expect(roleUser).toEqual({ userId: 2, roleId: 2, roleName: "Admin" });
    });

    it("returns null when there is no valid session", async () => {
      const roleUser = await getRoleUser(
        new Request("http://localhost:5173/dashboard")
      );

      expect(roleUser).toBeNull();
    });
  });

  describe("logout", () => {
    it("redirects to login and clears the cookie", async () => {
      const response = await logout(new Request("http://localhost:5173/dashboard"));

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toContain("RJ_session=");
    });
  });

  describe("findUserByEmail", () => {
    it("matches case-insensitively", async () => {
      db.user.findFirst.mockResolvedValue({ id: 1 });

      await findUserByEmail("Person@Example.COM");

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { equals: "Person@Example.COM", mode: "insensitive" },
          },
        })
      );
    });

    it("returns null for an empty email without querying", async () => {
      await expect(findUserByEmail("")).resolves.toBeNull();
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("updateUserPassword", () => {
    it("hashes the new password and updates the matched account", async () => {
      db.user.findFirst.mockResolvedValue({ id: 9 });
      db.user.update.mockResolvedValue({
        id: 9,
        email: "person@example.com",
        password: "hashed:new-password",
      });

      const result = await updateUserPassword(
        "PERSON@example.com",
        "new-password"
      );

      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { equals: "PERSON@example.com", mode: "insensitive" },
          },
        })
      );
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: { password: "hashed:new-password" },
        select: { id: true, email: true, password: true },
      });
      expect(result?.id).toBe(9);
    });

    it("returns null when no account matches the email", async () => {
      db.user.findFirst.mockResolvedValue(null);

      await expect(
        updateUserPassword("nobody@example.com", "new-password")
      ).resolves.toBeNull();
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("returns null when email or password is missing", async () => {
      await expect(updateUserPassword("", "pw")).resolves.toBeNull();
      await expect(updateUserPassword("a@b.com", "")).resolves.toBeNull();
      expect(db.user.findFirst).not.toHaveBeenCalled();
    });
  });
});
