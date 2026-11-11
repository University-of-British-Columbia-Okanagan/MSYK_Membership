// Mailgun env is read at module load and sendMail asserts it, so set it before import.
process.env.MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? "test-mailgun-key";
process.env.MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? "test.example.com";
process.env.MAILGUN_FROM_EMAIL =
  process.env.MAILGUN_FROM_EMAIL ?? "noreply@test.example.com";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
process.env.BASE_URL = process.env.BASE_URL ?? "http://localhost:5173/";

const createMessageMock = jest.fn().mockResolvedValue({ id: "msg_1" });

jest.mock("mailgun.js", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    client: () => ({ messages: { create: createMessageMock } }),
  })),
}));
jest.mock("form-data", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("~/logging/logger");

import { sendResetEmail } from "~/utils/email.server";
import { logger } from "~/logging/logger";

const mockInfo = logger.info as jest.Mock;
const RECIPIENT = "real.member@example.com";
const REDIRECT = "dev.inbox@example.com";

// sendResetEmail is the thinnest wrapper over sendMail, so it exercises the guard directly.
const send = () => sendResetEmail(RECIPIENT);

describe("sendMail development guard", () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_DEV_REDIRECT: process.env.EMAIL_DEV_REDIRECT,
  };
  const setEnv = (key: keyof typeof saved, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeEach(() => {
    createMessageMock.mockClear();
    mockInfo.mockClear();
  });
  afterEach(() => {
    setEnv("NODE_ENV", saved.NODE_ENV);
    setEnv("EMAIL_DEV_REDIRECT", saved.EMAIL_DEV_REDIRECT);
  });

  it("redirects to EMAIL_DEV_REDIRECT and names the original recipient in the subject", async () => {
    setEnv("NODE_ENV", "development");
    setEnv("EMAIL_DEV_REDIRECT", REDIRECT);

    await send();

    expect(createMessageMock).toHaveBeenCalledTimes(1);
    const message = createMessageMock.mock.calls[0][1];
    expect(message.to).toBe(REDIRECT);
    expect(JSON.stringify(message)).not.toContain(`"to":"${RECIPIENT}"`);
    expect(message.subject).toBe(`[DEV for ${RECIPIENT}] Password Reset Request`);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining(REDIRECT),
      expect.anything()
    );
  });

  it("redirects in production too when EMAIL_DEV_REDIRECT is set", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("EMAIL_DEV_REDIRECT", REDIRECT);

    await send();

    expect(createMessageMock).toHaveBeenCalledTimes(1);
    expect(createMessageMock.mock.calls[0][1].to).toBe(REDIRECT);
  });

  it("sends nothing in development without a redirect", async () => {
    setEnv("NODE_ENV", "development");
    setEnv("EMAIL_DEV_REDIRECT", undefined);

    await send();

    expect(createMessageMock).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining(RECIPIENT),
      expect.objectContaining({ subject: "Password Reset Request" })
    );
  });

  it("treats an empty EMAIL_DEV_REDIRECT as unset", async () => {
    setEnv("NODE_ENV", "development");
    setEnv("EMAIL_DEV_REDIRECT", "");

    await send();

    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("sends to the real recipient unchanged in production", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("EMAIL_DEV_REDIRECT", undefined);

    await send();

    expect(createMessageMock).toHaveBeenCalledTimes(1);
    const message = createMessageMock.mock.calls[0][1];
    expect(message.to).toBe(RECIPIENT);
    expect(message.subject).toBe("Password Reset Request");
  });

  it("still sends when NODE_ENV is unset, so the billing cron keeps emailing", async () => {
    setEnv("NODE_ENV", undefined);
    setEnv("EMAIL_DEV_REDIRECT", undefined);

    await send();

    expect(createMessageMock).toHaveBeenCalledTimes(1);
    expect(createMessageMock.mock.calls[0][1].to).toBe(RECIPIENT);
  });
});
