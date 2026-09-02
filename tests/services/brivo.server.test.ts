jest.mock("~/utils/db.server", () => ({ db: {} }));

jest.mock("~/logging/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/**
 * brivo.server builds its config from process.env at construction time, and the
 * module exports a single already-constructed singleton. To test different env
 * combinations the module has to be re-imported inside an isolated registry.
 */
const loadClientWith = (env: Record<string, string | undefined>) => {
  let client: any;
  jest.isolateModules(() => {
    const saved: Record<string, string | undefined> = {};
    const keys = [
      "BRIVO_CLIENT_ID",
      "BRIVO_CLIENT_SECRET",
      "BRIVO_USERNAME",
      "BRIVO_PASSWORD",
      "BRIVO_API_KEY",
      "BRIVO_BASE_URL",
      "BRIVO_AUTH_BASE_URL",
    ];
    keys.forEach((k) => {
      saved[k] = process.env[k];
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    });

    client = require("~/services/brivo.server").brivoClient;

    keys.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });
  return client;
};

const allCredentials = {
  BRIVO_CLIENT_ID: "id",
  BRIVO_CLIENT_SECRET: "secret",
  BRIVO_USERNAME: "user",
  BRIVO_PASSWORD: "pass",
  BRIVO_API_KEY: "key",
};

describe("brivo.server - configuration and degradation", () => {
  describe("isEnabled", () => {
    it("is enabled when all five credentials are present", () => {
      expect(loadClientWith(allCredentials).isEnabled()).toBe(true);
    });

    it("is disabled when no credentials are set", () => {
      expect(loadClientWith({}).isEnabled()).toBe(false);
    });

    it.each(Object.keys(allCredentials))(
      "is disabled when %s alone is missing",
      (missing) => {
        // The docs promise the integration disables itself gracefully if any one
        // of the five required vars is absent — not just if all are.
        const env: Record<string, string | undefined> = { ...allCredentials };
        delete env[missing];

        expect(loadClientWith(env).isEnabled()).toBe(false);
      }
    );

    it("stays enabled without the optional URL overrides", () => {
      const client = loadClientWith({
        ...allCredentials,
        BRIVO_BASE_URL: undefined,
        BRIVO_AUTH_BASE_URL: undefined,
      });

      expect(client.isEnabled()).toBe(true);
    });
  });

  describe("credential guard", () => {
    // Provisioning must fail closed rather than issue a credential-less request.
    // Public methods guard with "Brivo is not configured"; the token fetch guards
    // with "Brivo credentials are not configured".
    it.each([
      ["ensurePerson", (c: any) => c.ensurePerson({ id: 1, email: "a@b.c" })],
      ["ensureMobilePass", (c: any) => c.ensureMobilePass("p1", "a@b.c")],
    ])("%s throws when not configured", async (_name, call) => {
      const client = loadClientWith({});

      await expect(call(client)).rejects.toThrow(/not configured/);
    });

    // Revocation is the opposite: on an install that never had Brivo there is
    // nothing to revoke, so it no-ops rather than erroring. This is what lets
    // syncUserDoorAccess run unconditionally on membership changes.
    it("revokeMobilePass no-ops when not configured", async () => {
      const client = loadClientWith({});

      await expect(client.revokeMobilePass("p1")).resolves.toBeUndefined();
    });
  });

  describe("base URL normalisation", () => {
    // The client appends /v1/api itself, so operators can paste any of these
    // forms into BRIVO_BASE_URL and get the same effective endpoint.
    it.each([
      ["https://api.brivo.com"],
      ["https://api.brivo.com/"],
      ["https://api.brivo.com/v1"],
      ["https://api.brivo.com/api"],
      ["https://api.brivo.com/v1/api"],
      ["https://api.brivo.com/api/v1"],
    ])("normalises %s to a single /v1/api suffix", (base) => {
      const client = loadClientWith({
        ...allCredentials,
        BRIVO_BASE_URL: base,
      });

      const configured = (client as any).env.apiBaseUrl as string;
      expect(configured).toBe("https://api.brivo.com/v1/api");
    });

    it("defaults to the public Brivo host when no base URL is set", () => {
      const client = loadClientWith({
        ...allCredentials,
        BRIVO_BASE_URL: undefined,
      });

      expect((client as any).env.apiBaseUrl).toBe(
        "https://api.brivo.com/v1/api"
      );
    });

    it("defaults the OAuth host separately from the API host", () => {
      const client = loadClientWith({
        ...allCredentials,
        BRIVO_AUTH_BASE_URL: undefined,
      });

      expect((client as any).env.authBaseUrl).toBe("https://auth.brivo.com");
    });

    it("honours a self-hosted auth base URL", () => {
      const client = loadClientWith({
        ...allCredentials,
        BRIVO_AUTH_BASE_URL: "https://auth.example.test",
      });

      expect((client as any).env.authBaseUrl).toBe("https://auth.example.test");
    });
  });
});
