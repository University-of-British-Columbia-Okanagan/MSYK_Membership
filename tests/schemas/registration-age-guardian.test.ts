import { registerSchema } from "~/schemas/registrationSchema";

/**
 * Registration used to reject anyone under 18 outright. It now accepts 14+, and 14-17
 * must name a legal guardian. This suite pins both edges of that band plus the cases
 * where the guardian field should be ignored entirely.
 *
 * Time is frozen because every assertion here is a statement about an age on a date.
 */
describe("registerSchema - age gate and guardian name", () => {
  const TODAY = new Date("2026-08-28T12:00:00");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(TODAY);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const baseValues = {
    firstName: "Robin",
    lastName: "Maker",
    email: "robin@example.com",
    password: "password",
    confirmPassword: "password",
    phone: "867-555-0100",
    emergencyContactName: "Sam Contact",
    emergencyContactPhone: "867-555-0101",
    emergencyContactEmail: "sam@example.com",
    mediaConsent: true,
    dataPrivacy: true,
    communityGuidelines: true,
    operationsPolicy: true,
    waiverSignature: "data:image/png;base64,abc",
  };

  const parse = (overrides: Record<string, unknown>) =>
    registerSchema.safeParse({ ...baseValues, ...overrides });

  /** Field errors keyed by field, as register() hands them back to the route. */
  const errorsFor = (result: ReturnType<typeof parse>) => {
    if (result.success) throw new Error("expected the payload to be rejected");
    return result.error.flatten().fieldErrors;
  };

  describe("the 14+ gate", () => {
    it("accepts an adult with no guardian name", () => {
      expect(parse({ dateOfBirth: "1990-01-01" }).success).toBe(true);
    });

    it("accepts someone who turns 18 today", () => {
      expect(parse({ dateOfBirth: "2008-08-28" }).success).toBe(true);
    });

    it("accepts a 17 year old who names a guardian", () => {
      expect(
        parse({ dateOfBirth: "2008-08-29", guardianName: "Alex Guardian" })
          .success
      ).toBe(true);
    });

    it("accepts someone who turns 14 today and names a guardian", () => {
      expect(
        parse({ dateOfBirth: "2012-08-28", guardianName: "Alex Guardian" })
          .success
      ).toBe(true);
    });

    it("rejects someone one day short of 14", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2012-08-29" }));
      expect(errors.dateOfBirth?.[0]).toMatch(/under 14/i);
    });

    it("rejects a young child", () => {
      expect(errorsFor(parse({ dateOfBirth: "2020-01-01" })).dateOfBirth)
        .toBeDefined();
    });

    it("does not ask a rejected under-14 for a guardian name as well", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2020-01-01" }));
      expect(errors.guardianName).toBeUndefined();
    });

    it("no longer mentions 18 in the age message", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2020-01-01" }));
      expect(errors.dateOfBirth?.[0]).not.toMatch(/18/);
    });

    it("requires a date of birth at all", () => {
      expect(errorsFor(parse({ dateOfBirth: "" })).dateOfBirth).toBeDefined();
    });

    it("rejects a malformed date of birth", () => {
      const errors = errorsFor(parse({ dateOfBirth: "not-a-date" }));
      expect(errors.dateOfBirth?.[0]).toMatch(/valid date of birth/i);
    });

    it("rejects a calendar date that does not exist", () => {
      // The day dropdown offers 31 days in every month, so this is reachable.
      const errors = errorsFor(parse({ dateOfBirth: "2011-02-31" }));
      expect(errors.dateOfBirth?.[0]).toMatch(/valid date of birth/i);
    });

    it("rejects a date of birth in the future", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2027-01-01" }));
      expect(errors.dateOfBirth?.[0]).toMatch(/valid date of birth/i);
    });
  });

  describe("guardian name for 14-17", () => {
    it("rejects a 14 year old with no guardian name", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2012-01-01" }));
      expect(errors.guardianName?.[0]).toMatch(/legal guardian/i);
    });

    it("rejects a 17 year old with no guardian name", () => {
      const errors = errorsFor(parse({ dateOfBirth: "2008-08-29" }));
      expect(errors.guardianName?.[0]).toMatch(/legal guardian/i);
    });

    it("rejects a guardian name that is only whitespace", () => {
      const errors = errorsFor(
        parse({ dateOfBirth: "2012-01-01", guardianName: "   " })
      );
      expect(errors.guardianName?.[0]).toMatch(/legal guardian/i);
    });

    it("trims the stored guardian name", () => {
      const result = parse({
        dateOfBirth: "2012-01-01",
        guardianName: "  Alex Guardian  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guardianName).toBe("Alex Guardian");
      }
    });

    it("puts the age error on dateOfBirth and the guardian error on guardianName", () => {
      // Both fields must be able to render their own message under the right input.
      const minor = parse({ dateOfBirth: "2012-01-01" });
      expect(errorsFor(minor).dateOfBirth).toBeUndefined();
      expect(errorsFor(minor).guardianName).toBeDefined();
    });
  });

  describe("guardian name for adults", () => {
    it("does not require one", () => {
      expect(parse({ dateOfBirth: "1990-01-01" }).success).toBe(true);
    });

    it("drops a stale guardian name rather than storing it", () => {
      // The field is only rendered for 14-17, but a user can pick a minor birthday, type a
      // guardian, then change the year. The value must not follow them into an adult account.
      const result = parse({
        dateOfBirth: "1990-01-01",
        guardianName: "Left Over",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guardianName).toBeUndefined();
      }
    });
  });

  describe("everything else still applies to a minor", () => {
    const minor = { dateOfBirth: "2012-01-01", guardianName: "Alex Guardian" };

    it("still requires the waiver signature", () => {
      expect(
        errorsFor(parse({ ...minor, waiverSignature: "" })).waiverSignature
      ).toBeDefined();
    });

    it("still requires the policy agreements", () => {
      const errors = errorsFor(
        parse({
          ...minor,
          dataPrivacy: false,
          communityGuidelines: false,
          operationsPolicy: false,
        })
      );
      expect(errors.dataPrivacy).toBeDefined();
      expect(errors.communityGuidelines).toBeDefined();
      expect(errors.operationsPolicy).toBeDefined();
    });

    it("still requires emergency contact details separate from the guardian", () => {
      const errors = errorsFor(parse({ ...minor, emergencyContactName: "" }));
      expect(errors.emergencyContactName).toBeDefined();
    });

    it("still requires matching passwords", () => {
      const errors = errorsFor(parse({ ...minor, confirmPassword: "other" }));
      expect(errors.confirmPassword).toBeDefined();
    });
  });
});
