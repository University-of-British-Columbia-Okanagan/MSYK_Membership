// Mailgun env is read at module load and sendMail asserts it, so set it before import.
process.env.MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? "test-mailgun-key";
process.env.MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? "test.example.com";
process.env.MAILGUN_FROM_EMAIL =
  process.env.MAILGUN_FROM_EMAIL ?? "noreply@test.example.com";

const createMessageMock = jest.fn().mockResolvedValue({ id: "msg_1" });

jest.mock("mailgun.js", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    client: () => ({ messages: { create: createMessageMock } }),
  })),
}));
jest.mock("form-data", () => ({ __esModule: true, default: jest.fn() }));

const getAdminSettingMock = jest.fn();
jest.mock("~/models/admin.server", () => ({
  getMinorNotificationEmail: (...args: unknown[]) =>
    (getAdminSettingMock as any)(...args),
}));

import { sendMinorRegistrationNotificationEmail } from "~/utils/email.server";

const lastMessage = () => createMessageMock.mock.calls.at(-1)![1];
const bodyOf = () => lastMessage().text as string;
const htmlOf = () => lastMessage().html as string;

/**
 * Staff keep a paper list at the front desk and tick a minor off when they arrive with a
 * guardian. This email is the only thing that puts a name on that list, so the three
 * facts it carries - who registered, that they are under 18, and the guardian's name -
 * are each asserted rather than checked as one blob.
 *
 * The body is deliberately just those facts. It used to close with a line telling staff
 * what to do about it; that was removed as unnecessary, so nothing here asserts it.
 */
describe("sendMinorRegistrationNotificationEmail", () => {
  beforeEach(() => {
    createMessageMock.mockClear();
    getAdminSettingMock.mockReset();
    getAdminSettingMock.mockResolvedValue("info@makerspaceyk.com");
  });

  const params = {
    firstName: "Robin",
    lastName: "Maker",
    userEmail: "robin@example.com",
    guardianName: "Alex Guardian",
    age: 15,
    dateOfBirth: "2011-03-04",
  };

  it("sends to the configured staff address, not to the registrant", async () => {
    await sendMinorRegistrationNotificationEmail(params);

    expect(lastMessage().to).toBe("info@makerspaceyk.com");
    expect(lastMessage().to).not.toBe("robin@example.com");
  });

  it("honours a staff address changed in admin settings", async () => {
    getAdminSettingMock.mockResolvedValue("frontdesk@makerspaceyk.com");

    await sendMinorRegistrationNotificationEmail(params);

    expect(lastMessage().to).toBe("frontdesk@makerspaceyk.com");
  });

  it("names the registrant in the subject so the inbox is scannable", async () => {
    await sendMinorRegistrationNotificationEmail(params);

    expect(lastMessage().subject).toContain("Robin Maker");
    expect(lastMessage().subject).toMatch(/under 18/i);
  });

  it("carries the full name, the guardian name and the age in the body", async () => {
    await sendMinorRegistrationNotificationEmail(params);

    const body = bodyOf();
    expect(body).toContain("Robin Maker");
    expect(body).toContain("Alex Guardian");
    expect(body).toContain("15");
    expect(body).toContain("robin@example.com");
  });

  it("repeats the same facts in the HTML part", async () => {
    await sendMinorRegistrationNotificationEmail(params);

    const html = htmlOf();
    expect(html).toContain("Robin Maker");
    expect(html).toContain("Alex Guardian");
  });

  it("escapes HTML in names so a crafted name cannot inject markup", async () => {
    await sendMinorRegistrationNotificationEmail({
      ...params,
      lastName: '<script>alert("x")</script>',
      guardianName: "<b>Bold</b> Guardian",
    });

    const html = htmlOf();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;Bold&lt;/b&gt;");
  });

  it("never uses an em dash, which is banned in user-facing copy", async () => {
    await sendMinorRegistrationNotificationEmail(params);

    expect(bodyOf()).not.toContain("—");
    expect(htmlOf()).not.toContain("—");
  });

  it("still sends when the guardian name is somehow missing", async () => {
    // The schema requires one, but the email must not throw if a row predates the field.
    await sendMinorRegistrationNotificationEmail({
      ...params,
      guardianName: undefined,
    });

    expect(createMessageMock).toHaveBeenCalledTimes(1);
    expect(bodyOf()).toMatch(/not provided/i);
  });

  it("propagates a Mailgun failure so the caller can log it", async () => {
    createMessageMock.mockRejectedValueOnce(new Error("mailgun down"));

    await expect(
      sendMinorRegistrationNotificationEmail(params)
    ).rejects.toThrow("mailgun down");
  });
});
