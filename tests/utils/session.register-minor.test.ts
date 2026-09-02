import "tests/fixtures/session/setup";

import { getSessionMocks, resetSessionMocks } from "tests/fixtures/session/setup";
import type { SessionDbMock } from "tests/fixtures/session/setup";
import { clearAllMocks } from "tests/helpers/test-utils";
import { register } from "~/utils/session.server";

/**
 * register() now has to do two extra things for a 14-17 year old: persist the guardian
 * name, and notify staff so the maker can be added to the front desk list. Neither may
 * fire for an adult, and neither may take the registration down with it if it fails.
 */
describe("register - 14+ age gate, guardian name and staff notification", () => {
  const TODAY = new Date("2026-08-28T12:00:00");

  let db: SessionDbMock;
  let sendWelcome: jest.Mock;
  let notifyStaff: jest.Mock;

  beforeEach(() => {
    clearAllMocks();
    resetSessionMocks();
    const mocks = getSessionMocks();
    db = mocks.db;
    sendWelcome = mocks.mockSendRegistrationConfirmationEmail;
    notifyStaff = mocks.mockSendMinorRegistrationNotificationEmail;

    sendWelcome.mockResolvedValue(undefined);
    notifyStaff.mockResolvedValue(undefined);

    jest.useFakeTimers();
    jest.setSystemTime(TODAY);

    db.user.create.mockImplementation(async ({ data }: any) => ({
      id: 42,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      waiverSignature: data.waiverSignature,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const values = (overrides: Record<string, unknown> = {}) => ({
    firstName: "Robin",
    lastName: "Maker",
    email: "Robin@Example.com",
    password: "password",
    confirmPassword: "password",
    phone: "867-555-0100",
    dateOfBirth: "1990-01-01",
    emergencyContactName: "Sam Contact",
    emergencyContactPhone: "867-555-0101",
    emergencyContactEmail: "sam@example.com",
    mediaConsent: true,
    dataPrivacy: true,
    communityGuidelines: true,
    operationsPolicy: true,
    // Not a data: URL, so no PDF generation is attempted, but it satisfies the schema.
    waiverSignature: "signed",
    ...overrides,
  });

  const minor = (overrides: Record<string, unknown> = {}) =>
    values({
      dateOfBirth: "2011-03-04",
      guardianName: "Alex Guardian",
      ...overrides,
    });

  const createdData = () => db.user.create.mock.calls.at(-1)![0].data;

  describe("who may register", () => {
    it("creates an account for a 14 year old with a guardian named", () => {
      return register(minor({ dateOfBirth: "2012-08-28" })).then((result) => {
        expect(result).toEqual(expect.objectContaining({ id: 42 }));
      });
    });

    it("refuses an account one day short of 14", async () => {
      const result = await register(values({ dateOfBirth: "2012-08-29" }));

      expect(result).toEqual({
        errors: expect.objectContaining({
          dateOfBirth: expect.arrayContaining([expect.stringMatching(/under 14/i)]),
        }),
      });
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("refuses a 15 year old who did not name a guardian", async () => {
      const result = await register(minor({ guardianName: undefined }));

      expect(result).toEqual({
        errors: expect.objectContaining({
          guardianName: expect.any(Array),
        }),
      });
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("still creates an account for an adult", async () => {
      await register(values());

      expect(db.user.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("persisting the guardian name", () => {
    it("stores it for a minor", async () => {
      await register(minor());

      expect(createdData().guardianName).toBe("Alex Guardian");
    });

    it("trims it", async () => {
      await register(minor({ guardianName: "  Alex Guardian  " }));

      expect(createdData().guardianName).toBe("Alex Guardian");
    });

    it("stores null for an adult even when a stale value is submitted", async () => {
      await register(values({ guardianName: "Left Over" }));

      expect(createdData().guardianName).toBeNull();
    });

    it("does not disturb the other fields it already stored", async () => {
      await register(minor());

      expect(createdData()).toEqual(
        expect.objectContaining({
          firstName: "Robin",
          lastName: "Maker",
          email: "robin@example.com",
          dateOfBirth: "2011-03-04",
          emergencyContactName: "Sam Contact",
        })
      );
    });
  });

  describe("notifying staff", () => {
    it("emails staff about a 15 year old", async () => {
      await register(minor());

      expect(notifyStaff).toHaveBeenCalledTimes(1);
      expect(notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "Robin",
          lastName: "Maker",
          guardianName: "Alex Guardian",
          age: 15,
        })
      );
    });

    it("emails staff at both edges of the 14-17 band", async () => {
      await register(minor({ dateOfBirth: "2012-08-28" }));
      expect(notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({ age: 14 })
      );

      notifyStaff.mockClear();
      await register(minor({ dateOfBirth: "2008-08-29" }));
      expect(notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({ age: 17 })
      );
    });

    it("does not email staff about an adult", async () => {
      await register(values());

      expect(notifyStaff).not.toHaveBeenCalled();
    });

    it("does not email staff about someone who turns 18 today", async () => {
      await register(values({ dateOfBirth: "2008-08-28" }));

      expect(notifyStaff).not.toHaveBeenCalled();
    });

    it("uses the stored lowercase email so staff can find the account", async () => {
      await register(minor());

      expect(notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: "robin@example.com" })
      );
    });

    it("still sends the welcome email to the minor", async () => {
      await register(minor());

      expect(sendWelcome).toHaveBeenCalledWith(
        expect.objectContaining({ userEmail: "robin@example.com" })
      );
    });

    it("completes the registration even if the staff notification fails", async () => {
      notifyStaff.mockRejectedValue(new Error("mailgun down"));

      const result = await register(minor());

      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it("still notifies staff when the welcome email fails", async () => {
      // The two sends are independent; one failing must not skip the other.
      sendWelcome.mockRejectedValue(new Error("mailgun down"));

      const result = await register(minor());

      expect(notifyStaff).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({ id: 42 }));
    });

    it("does not notify staff when the account was never created", async () => {
      db.user.create.mockRejectedValue(new Error("db down"));

      await register(minor());

      expect(notifyStaff).not.toHaveBeenCalled();
    });
  });
});
