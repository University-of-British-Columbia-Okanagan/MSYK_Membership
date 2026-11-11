// Mailgun env is read at module load and sendMail asserts it, so set it before import.
process.env.MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? "test-mailgun-key";
process.env.MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? "test.example.com";
process.env.MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL ?? "noreply@test.example.com";

const createMessageMock = jest.fn().mockResolvedValue({ id: "msg_1" });

jest.mock("mailgun.js", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    client: () => ({ messages: { create: createMessageMock } }),
  })),
}));
jest.mock("form-data", () => ({ __esModule: true, default: jest.fn() }));

import { sendMembershipResubscribeEmail } from "~/utils/email.server";

const bodyOf = () => createMessageMock.mock.calls.at(-1)![1].text as string;
// 06:00Z is midnight NWT, so the business date is Feb 10, not the UTC-day guess.
const SAVED = new Date("2027-02-10T06:00:00.000Z");

describe("resubscribe email", () => {
  beforeEach(() => createMessageMock.mockClear());

  it.each(["monthly", "quarterly", "semiannually", "yearly"] as const)(
    "tells a %s member their next billing date",
    async (billingCycle) => {
      await sendMembershipResubscribeEmail({
        userEmail: "m@example.com",
        planTitle: "Makerspace Member",
        billingCycle,
        planPrice: 140,
        nextBillingDate: SAVED,
        autoRenew: true,
      });
      expect(bodyOf()).toContain("Next billing date: 2/10/2027");
    }
  );

  it("says when membership ends instead of a billing date when auto-renew is off", async () => {
    await sendMembershipResubscribeEmail({
      userEmail: "m@example.com",
      planTitle: "Makerspace Member",
      billingCycle: "quarterly",
      planPrice: 140,
      nextBillingDate: SAVED,
      autoRenew: false,
    });
    expect(bodyOf()).toContain("Membership ends on: 2/10/2027");
    expect(bodyOf()).not.toContain("Next billing date");
  });

  it("omits the line when no date is known", async () => {
    await sendMembershipResubscribeEmail({ userEmail: "m@example.com", planTitle: "Makerspace Member", billingCycle: "yearly" });
    expect(bodyOf()).not.toMatch(/Next billing date|Membership ends on/);
  });
});
