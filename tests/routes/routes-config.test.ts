import routes from "~/routes";

/** Flattens the route config into "path -> file" pairs. */
const entries = (list: any[]): Array<{ path?: string; file: string }> =>
  list.flatMap((r) => [{ path: r.path, file: r.file }, ...entries(r.children ?? [])]);

describe("route config", () => {
  const all = entries(routes as any[]);

  // Both took a booking or registration with no payment check and nothing in the UI used them.
  it.each([
    ["/dashboard/equipments/book-slot", "routes/api/bookequipmentslot.tsx"],
    ["/dashboard/register/:id", "routes/api/register.tsx"],
  ])("no longer exposes %s", (path, file) => {
    expect(all.find((r) => r.path === path)).toBeUndefined();
    expect(all.find((r) => r.file === file)).toBeUndefined();
  });

  it("still routes purchases through paymentprocess and the success page", () => {
    expect(all.find((r) => r.path === "dashboard/paymentprocess")?.file).toBe("routes/api/paymentprocess.tsx");
    expect(all.find((r) => r.path === "dashboard/payment/success")?.file).toBe("routes/dashboard/paymentsuccess.tsx");
  });
});
