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

import {
  sendMembershipPaymentSuccessEmail,
  sendMembershipPaymentReminderEmail,
} from "~/utils/email.server";

/** The plain-text body Mailgun was handed. */
const bodyOf = () => createMessageMock.mock.calls.at(-1)![1].text as string;

/**
 * These two emails quote money at the member, so the arithmetic is worth asserting
 * directly. GST is charged on the post-discount base, which means the tax shown cannot be
 * derived from (total - list price) once a discount exists.
 */
describe("membership emails with a recurring discount", () => {
  beforeEach(() => {
    createMessageMock.mockClear();
  });

  describe("payment success", () => {
    const base = {
      userEmail: "member@example.com",
      planTitle: "Makerspace Member",
      gstPercentage: 5,
      nextPaymentDate: new Date("2026-09-26T00:00:00Z"),
      billingCycle: "monthly" as const,
    };

    it("itemises base, discount and GST on the discounted amount", async () => {
      // $50 base, 50% off, 5% GST on the remaining $25 => $26.25
      await sendMembershipPaymentSuccessEmail({
        ...base,
        amountCharged: 26.25,
        baseAmount: 50,
        discountAmount: 25,
      });

      const body = bodyOf();
      expect(body).toContain("Base amount: $50.00");
      expect(body).toContain("Discount applied: -$25.00");
      // Not $2.50 — GST follows the discount.
      expect(body).toContain("GST (5%): $1.25");
      expect(body).toContain("Amount charged: $26.25");
    });

    it("omits the discount line when nothing was discounted", async () => {
      await sendMembershipPaymentSuccessEmail({
        ...base,
        amountCharged: 52.5,
        baseAmount: 50,
      });

      const body = bodyOf();
      expect(body).not.toContain("Discount applied");
      expect(body).toContain("GST (5%): $2.50");
      expect(body).toContain("Amount charged: $52.50");
    });

    it("still balances for a fixed-amount discount", async () => {
      // $50 base, $10 off, 5% GST on $40 => $42.00
      await sendMembershipPaymentSuccessEmail({
        ...base,
        amountCharged: 42,
        baseAmount: 50,
        discountAmount: 10,
      });

      const body = bodyOf();
      expect(body).toContain("Discount applied: -$10.00");
      expect(body).toContain("GST (5%): $2.00");
      expect(body).toContain("Amount charged: $42.00");
    });

    it("names the billing cycle", async () => {
      await sendMembershipPaymentSuccessEmail({
        ...base,
        billingCycle: "yearly",
        amountCharged: 52.5,
        baseAmount: 50,
      });

      expect(bodyOf()).toContain("Billing cycle: Yearly");
    });
  });

  describe("payment reminder", () => {
    const base = {
      userEmail: "member@example.com",
      planTitle: "Makerspace Member",
      nextPaymentDate: new Date("2026-09-26T00:00:00Z"),
      gstPercentage: 5,
    };

    it("shows the regular price and the discount alongside the amount due", async () => {
      await sendMembershipPaymentReminderEmail({
        ...base,
        amountDue: 26.25,
        baseAmount: 50,
        discountAmount: 25,
      });

      const body = bodyOf();
      expect(body).toContain("Regular price: $50.00");
      expect(body).toContain("Discount applied: -$25.00");
      expect(body).toContain("Amount due: $26.25");
    });

    it("quotes only the amount due when there is no discount", async () => {
      await sendMembershipPaymentReminderEmail({
        ...base,
        amountDue: 52.5,
        baseAmount: 50,
        discountAmount: 0,
      });

      const body = bodyOf();
      expect(body).not.toContain("Discount applied");
      expect(body).not.toContain("Regular price");
      expect(body).toContain("Amount due: $52.50");
    });

    it("still renders when the caller passes no discount fields at all", async () => {
      await sendMembershipPaymentReminderEmail({ ...base, amountDue: 52.5 });

      const body = bodyOf();
      expect(body).not.toContain("Discount applied");
      expect(body).toContain("Amount due: $52.50");
    });
  });
});
