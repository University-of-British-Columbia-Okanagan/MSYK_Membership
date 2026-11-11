jest.mock("~/utils/session.server", () => ({ getUser: jest.fn() }));
jest.mock("~/models/payment.server", () => ({ createCheckoutSession: jest.fn() }));
jest.mock("~/logging/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { getUser } from "~/utils/session.server";
import { createCheckoutSession } from "~/models/payment.server";
import { action } from "~/routes/api/paymentprocess";

const post = (body: Record<string, unknown>) =>
  new Request("http://localhost/dashboard/paymentprocess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("paymentprocess: purchases are made by the signed-in member", () => {
  beforeEach(() => jest.clearAllMocks());

  it("hands the session user's id to the checkout, whatever the body claims", async () => {
    (getUser as jest.Mock).mockResolvedValue({ id: 4, email: "m@example.com" });
    (createCheckoutSession as jest.Mock).mockResolvedValue(new Response("{}"));
    const request = post({ useSavedCard: true, userId: 99, workshopId: 1, occurrenceId: 10 });

    await action({ request });

    expect(createCheckoutSession).toHaveBeenCalledWith(request, 4);
  });

  it("refuses a signed-out visitor", async () => {
    (getUser as jest.Mock).mockResolvedValue(null);

    const res = (await action({ request: post({ workshopId: 1 }) })) as Response;

    expect(res.status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
