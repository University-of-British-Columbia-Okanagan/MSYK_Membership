import "tests/fixtures/session/setup";

import { getSessionMocks, resetSessionMocks } from "tests/fixtures/session/setup";
import type { SessionDbMock } from "tests/fixtures/session/setup";
import {
  decodeSessionCookie,
  expectedPwf,
  forgeSessionCookie,
  requestWithCookie as requestWithSessionCookie,
  useFakeUserRow,
} from "tests/fixtures/session/cookie";
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
 * Issues a real session cookie through createUserSession, which reads the user's
 * current hash and sessionVersion. Tests then replay it as a Request, which is the
 * only way to meaningfully test expiry, password changes and sign out.
 */
const sessionCookieFor = async (
  db: SessionDbMock,
  userId: number,
  passwordHash = "hashed:correct-horse",
  sessionVersion = 0
) => {
  db.user.findUnique.mockResolvedValueOnce({
    id: userId,
    password: passwordHash,
    sessionVersion,
  });
  const response = await createUserSession(userId, "/dashboard/user");
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

    it("returns the account without the submitted password", async () => {
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
      db.user.findUnique.mockResolvedValueOnce({
        id: 1,
        password: "hashed:correct-horse",
        sessionVersion: 0,
      });

      const response = await createUserSession(1, "/dashboard/user");

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard/user");
      expect(response.headers.get("Set-Cookie")).toContain("RJ_session");
    });

    it("never puts the password into the cookie", async () => {
      const setCookie = await sessionCookieFor(db, 1, "hashed:correct-horse");

      const { json, data } = decodeSessionCookie(setCookie);

      expect(data).not.toHaveProperty("userPassword");
      expect(json).not.toContain("correct-horse");
      expect(json).not.toContain("hashed:correct-horse");
    });

    it("stores the user id, login time, session version and a fingerprint of the hash", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      const setCookie = await sessionCookieFor(db, 3, "hashed:correct-horse", 5);

      expect(decodeSessionCookie(setCookie).data).toEqual({
        userId: "3",
        loginTime: String(new Date("2026-01-01T00:00:00Z").getTime()),
        sessionVersion: 5,
        pwf: expectedPwf("hashed:correct-horse"),
      });
      expect(db.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 } })
      );
    });

    it("issues no cookie when the account cannot be found", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      const response = await createUserSession(99, "/dashboard/user");

      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toBeNull();
    });
  });

  describe("getUserId", () => {
    it("returns the user id for a valid, fresh session without a bcrypt compare", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);

      const userId = await getUserId(requestWithSessionCookie(cookie));

      expect(userId).toBe("1");
      expect(bcryptCompareMock).not.toHaveBeenCalled();
    });

    it("logs out when there is no session cookie at all", async () => {
      const userId = await getUserId(new Request("http://localhost:5173/dashboard"));

      expect(userId).toBeNull();
      expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("logs out once the session passes the 3 hour limit", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);

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
      const cookie = await sessionCookieFor(db, 1);
      db.user.findUnique.mockResolvedValue(null);

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("invalidates the session after a password change", async () => {
      const row = useFakeUserRow(db, {
        id: 1,
        password: "hashed:old-password",
        sessionVersion: 0,
      });
      const cookie = await sessionCookieFor(db, 1, "hashed:old-password");
      await expect(getUserId(requestWithSessionCookie(cookie))).resolves.toBe("1");

      row.password = "hashed:new-password";

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("rejects a signed cookie whose password fingerprint was tampered with", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const real = decodeSessionCookie(await sessionCookieFor(db, 1)).data;
      const flipped = String(real.pwf).replace(/^./, (c) => (c === "0" ? "1" : "0"));

      for (const pwf of [flipped, "short", expectedPwf("hashed:other-password")]) {
        const forged = await forgeSessionCookie({ ...real, pwf });
        await expect(
          getUserId(requestWithSessionCookie(forged))
        ).resolves.toBeNull();
      }
    });

    it("rejects a session whose sessionVersion no longer matches the account", async () => {
      const row = useFakeUserRow(db, {
        id: 1,
        password: "hashed:correct-horse",
        sessionVersion: 0,
      });
      const cookie = await sessionCookieFor(db, 1);

      row.sessionVersion = 1;

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("rejects an old-format cookie that carries only the raw password", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const legacy = await forgeSessionCookie({
        userId: "1",
        userPassword: "correct-horse",
        loginTime: Date.now().toString(),
      });

      await expect(
        getUserId(requestWithSessionCookie(legacy))
      ).resolves.toBeNull();
    });

    it("rejects a cookie missing any one of the required fields", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const real = decodeSessionCookie(await sessionCookieFor(db, 1)).data;

      for (const field of ["userId", "loginTime", "pwf", "sessionVersion"]) {
        const { [field]: _dropped, ...rest } = real;
        const forged = await forgeSessionCookie(rest);
        await expect(
          getUserId(requestWithSessionCookie(forged))
        ).resolves.toBeNull();
      }
    });

    it("does not bump sessionVersion when it rejects a session", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);
      jest.setSystemTime(new Date("2026-01-01T04:00:00Z"));

      await expect(getUserId(requestWithSessionCookie(cookie))).resolves.toBeNull();

      expect(db.user.update).not.toHaveBeenCalled();
    });
  });

  describe("getUser", () => {
    it("returns the id, email and role level for a valid session", async () => {
      const cookie = await sessionCookieFor(db, 4);
      db.user.findUnique
        .mockResolvedValueOnce({
          id: 4,
          password: "hashed:correct-horse",
          sessionVersion: 0,
        })
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
      const cookie = await sessionCookieFor(db, 2);
      db.user.findUnique
        .mockResolvedValueOnce({
          id: 2,
          password: "hashed:correct-horse",
          sessionVersion: 0,
        })
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
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("bumps sessionVersion exactly once and destroys the cookie", async () => {
      const row = useFakeUserRow(db, {
        id: 1,
        password: "hashed:correct-horse",
        sessionVersion: 0,
      });
      const cookie = await sessionCookieFor(db, 1);

      const response = await logout(requestWithSessionCookie(cookie));

      expect(db.user.update).toHaveBeenCalledTimes(1);
      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { sessionVersion: { increment: 1 } },
        })
      );
      expect(row.sessionVersion).toBe(1);
      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toMatch(/^RJ_session=;/);
    });

    it("makes a copy of the pre-logout cookie useless", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);
      await expect(getUserId(requestWithSessionCookie(cookie))).resolves.toBe("1");

      await logout(requestWithSessionCookie(cookie));

      await expect(
        getUserId(requestWithSessionCookie(cookie))
      ).resolves.toBeNull();
    });

    it("does not bump sessionVersion for an expired session", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);
      jest.setSystemTime(new Date("2026-01-01T04:00:00Z"));

      const response = await logout(requestWithSessionCookie(cookie));

      expect(db.user.update).not.toHaveBeenCalled();
      expect(response.headers.get("Set-Cookie")).toMatch(/^RJ_session=;/);
    });

    it("still clears the cookie when the sessionVersion update fails", async () => {
      useFakeUserRow(db, { id: 1, password: "hashed:correct-horse", sessionVersion: 0 });
      const cookie = await sessionCookieFor(db, 1);
      db.user.update.mockRejectedValueOnce(new Error("db down"));
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      const response = await logout(requestWithSessionCookie(cookie));

      expect(response.headers.get("Location")).toBe("/login");
      expect(response.headers.get("Set-Cookie")).toMatch(/^RJ_session=;/);
      consoleError.mockRestore();
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
