import "tests/fixtures/session/setup";

import { getSessionMocks, resetSessionMocks } from "tests/fixtures/session/setup";
import { cookiePair, useFakeUserRow } from "tests/fixtures/session/cookie";
import { createUserSession, getUserId } from "~/utils/session.server";
import { action, loader } from "~/routes/authentication/logout";

const { db } = getSessionMocks();

async function signedInCookie() {
  const issued = await createUserSession(6, "/dashboard/user");
  return cookiePair(issued.headers.get("Set-Cookie")!);
}

const requestFor = (method: string, cookie: string) =>
  new Request("http://localhost/logout", { method, headers: { Cookie: cookie } });

describe("logout route", () => {
  let row: { id: number; password: string; sessionVersion: number };

  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionMocks();
    row = useFakeUserRow(db, { id: 6, password: "hashed:password", sessionVersion: 0 });
  });

  it("destroys the session on POST, which is what every Sign Out button sends", async () => {
    const res = (await action({
      request: requestFor("POST", await signedInCookie()),
    } as any)) as Response;

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^RJ_session=;/);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
  });

  it("bumps sessionVersion exactly once on POST, so a copied cookie stops working", async () => {
    const cookie = await signedInCookie();

    await action({ request: requestFor("POST", cookie) } as any);

    expect(db.user.update).toHaveBeenCalledTimes(1);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 6 },
        data: { sessionVersion: { increment: 1 } },
      })
    );
    expect(row.sessionVersion).toBe(1);
    await expect(getUserId(requestFor("GET", cookie))).resolves.toBeNull();
  });

  it("does not sign anyone out on GET, so another site cannot log members out with a link", async () => {
    const res = (await loader()) as Response;

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
