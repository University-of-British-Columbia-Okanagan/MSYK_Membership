import "tests/fixtures/user/setup";
import { getUserMocks, resetUserMocks } from "tests/fixtures/user/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import { getSavedPaymentMethod } from "~/models/user.server";

const fullRow = {
  userId: 1,
  stripeCustomerId: "cus_1",
  stripePaymentMethodId: "pm_1",
  cardholderName: "Test User",
  cardLast4: "4242",
  cardExpiry: "12/34",
  email: "test@example.com",
  billingAddressLine1: "1 Main St",
  billingAddressLine2: null,
  billingCity: "Yellowknife",
  billingState: "NT",
  billingZip: "X1A1N1",
  billingCountry: "CA",
};

describe("user.server - getSavedPaymentMethod", () => {
  let db: ReturnType<typeof getUserMocks>["db"];

  beforeEach(() => {
    clearAllMocks();
    resetUserMocks();
    ({ db } = getUserMocks());
  });

  it("returns the card when both Stripe ids are present", async () => {
    db.userPaymentInformation.findUnique.mockResolvedValue(fullRow);

    const result = await getSavedPaymentMethod(1);

    expect(result).toMatchObject({
      cardLast4: "4242",
      stripeCustomerId: "cus_1",
      stripePaymentMethodId: "pm_1",
    });
  });

  it("returns null when there is no row at all", async () => {
    db.userPaymentInformation.findUnique.mockResolvedValue(null);

    await expect(getSavedPaymentMethod(1)).resolves.toBeNull();
  });

  // getOrCreateStripeCustomer writes a row holding only a customer id — capturing a
  // recurring discount does exactly this before any card exists. Treating that as a
  // saved card renders Quick Checkout and the profile page with blank digits.
  it("returns null for a customer-only row with no payment method", async () => {
    db.userPaymentInformation.findUnique.mockResolvedValue({
      ...fullRow,
      stripePaymentMethodId: null,
      cardLast4: null,
      cardExpiry: null,
    });

    await expect(getSavedPaymentMethod(1)).resolves.toBeNull();
  });

  it("returns null when the customer id is missing", async () => {
    db.userPaymentInformation.findUnique.mockResolvedValue({
      ...fullRow,
      stripeCustomerId: null,
    });

    await expect(getSavedPaymentMethod(1)).resolves.toBeNull();
  });
});
