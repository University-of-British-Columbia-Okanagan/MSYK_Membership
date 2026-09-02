import "tests/fixtures/payment/setup";

import { getPaymentMocks, resetPaymentMocks } from "tests/fixtures/payment/setup";
import type { PaymentDbMock } from "tests/fixtures/payment/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import { createPaymentIntentWithSavedCard } from "~/models/payment.server";

describe("payment.server - GST on saved-card payment intents", () => {
  let db: PaymentDbMock;
  let stripePaymentIntentsCreateMock: jest.Mock;
  let mockGetSavedPaymentMethod: jest.Mock;
  let mockGetAdminSetting: jest.Mock;

  const savedCard = {
    stripeCustomerId: "cus_123",
    stripePaymentMethodId: "pm_123",
  };

  beforeEach(() => {
    clearAllMocks();
    resetPaymentMocks();
    const mocks = getPaymentMocks();
    db = mocks.db;
    stripePaymentIntentsCreateMock = mocks.stripePaymentIntentsCreateMock;
    mockGetSavedPaymentMethod = mocks.mockGetSavedPaymentMethod;
    mockGetAdminSetting = mocks.mockGetAdminSetting;

    mockGetSavedPaymentMethod.mockResolvedValue(savedCard);
    stripePaymentIntentsCreateMock.mockResolvedValue({
      id: "pi_test",
      status: "succeeded",
    });
  });

  /** Returns the single argument payment.server passed to stripe.paymentIntents.create. */
  const createCallArg = () => stripePaymentIntentsCreateMock.mock.calls[0][0];

  it("adds the default 5% GST and charges in cents", async () => {
    await createPaymentIntentWithSavedCard(1, 100, "Workshop", {});

    expect(createCallArg().amount).toBe(10500);
    expect(createCallArg().currency).toBe("cad");
  });

  it("uses the configured GST percentage instead of the default", async () => {
    mockGetAdminSetting.mockResolvedValue("12");

    await createPaymentIntentWithSavedCard(1, 100, "Workshop", {});

    expect(createCallArg().amount).toBe(11200);
  });

  it("reads gst_percentage with 5 as the fallback", async () => {
    await createPaymentIntentWithSavedCard(1, 100, "Workshop", {});

    expect(mockGetAdminSetting).toHaveBeenCalledWith("gst_percentage", "5");
  });

  it("handles a zero GST rate", async () => {
    mockGetAdminSetting.mockResolvedValue("0");

    await createPaymentIntentWithSavedCard(1, 80, "Workshop", {});

    expect(createCallArg().amount).toBe(8000);
  });

  it("rounds to the nearest cent rather than truncating", async () => {
    // 49.99 * 1.05 = 52.4895 -> 5248.95 cents -> rounds to 5249
    await createPaymentIntentWithSavedCard(1, 49.99, "Workshop", {});

    expect(createCallArg().amount).toBe(5249);
    expect(Number.isInteger(createCallArg().amount)).toBe(true);
  });

  it("records the GST breakdown in metadata for later reconciliation", async () => {
    await createPaymentIntentWithSavedCard(1, 100, "Workshop", {
      workshopId: "7",
    });

    const metadata = createCallArg().metadata;
    expect(metadata).toEqual(
      expect.objectContaining({
        workshopId: "7",
        original_amount: "100",
        gst_percentage: "5",
      })
    );
    // Stored as strings; compare numerically to avoid float formatting noise.
    expect(Number(metadata.gst_amount)).toBeCloseTo(5, 6);
    expect(Number(metadata.total_with_gst)).toBeCloseTo(105, 6);
  });

  it("names the GST rate in the payment description", async () => {
    await createPaymentIntentWithSavedCard(1, 100, "Laser Cutting", {});

    expect(createCallArg().description).toBe(
      "Laser Cutting (Includes 5% GST)"
    );
  });

  it("charges the saved card off-session and confirms immediately", async () => {
    await createPaymentIntentWithSavedCard(1, 100, "Workshop", {});

    expect(createCallArg()).toEqual(
      expect.objectContaining({
        customer: "cus_123",
        payment_method: "pm_123",
        confirm: true,
        off_session: true,
        payment_method_types: ["card"],
      })
    );
  });

  describe("missing payment method", () => {
    it.each([
      ["no record at all", null],
      ["no payment method id", { stripeCustomerId: "cus_123" }],
      ["no customer id", { stripePaymentMethodId: "pm_123" }],
    ])("throws when there is %s", async (_label, saved) => {
      mockGetSavedPaymentMethod.mockResolvedValue(saved);

      await expect(
        createPaymentIntentWithSavedCard(1, 100, "Workshop", {})
      ).rejects.toThrow("No saved payment method found");

      expect(stripePaymentIntentsCreateMock).not.toHaveBeenCalled();
    });
  });
});
