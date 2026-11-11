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
  sendAdminWorkshopMoveEmail,
  sendEquipmentConfirmationEmail,
  sendMembershipPaymentReminderEmail,
  sendWorkshopConfirmationEmail,
} from "~/utils/email.server";

const bodyOf = () => createMessageMock.mock.calls.at(-1)![1].text as string;

/**
 * Emails are rendered on the server, whose zone and tz data are not the business's.
 * The instants below were picked so the business reading (UTC-6) differs from the
 * America/Vancouver reading on a stale-tzdata dev machine (UTC-8 in November), and
 * from UTC. Before the fix these emails said 8:30 for a 10:30 session.
 */
const SESSION_START = new Date("2026-11-14T16:30:00Z"); // 10:30 NWT
const SESSION_END = new Date("2026-11-14T18:30:00Z"); // 12:30 NWT

// Independent statement of the spec: a fixed UTC-6 wall clock.
const nwt = (d: Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(undefined, { timeZone: "Etc/GMT+6", ...options }).format(d);

describe("emails show times on the business clock", () => {
  beforeEach(() => createMessageMock.mockClear());

  it("shows a Nov 14 16:30Z workshop session as 10:30, not the host's 8:30", async () => {
    await sendWorkshopConfirmationEmail({
      userEmail: "member@example.com",
      workshopName: "Laser Cutter Basics",
      startDate: SESSION_START,
      endDate: SESSION_END,
    });

    const body = bodyOf();
    expect(body).toMatch(/Session: [^\n]*\b10:30:00\b[^\n]* - [^\n]*\b12:30:00\b/);
    expect(body).not.toMatch(/\b8:30/);
    expect(body).not.toMatch(/\b16:30/);
  });

  it("lists every session of a multi-day workshop in business time", async () => {
    await sendWorkshopConfirmationEmail({
      userEmail: "member@example.com",
      workshopName: "Woodshop Weekend",
      sessions: [
        { startDate: SESSION_START, endDate: SESSION_END },
        {
          startDate: new Date("2026-11-15T16:30:00Z"),
          endDate: new Date("2026-11-15T18:30:00Z"),
        },
      ],
    });

    const lines = bodyOf()
      .split("\n")
      .filter((l) => /^\d\. /.test(l) && l.includes(" - "));
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/10:30:00.* - .*12:30:00/);
  });

  it("keeps an evening session on its business date, not the next UTC day", async () => {
    // 19:00 NWT on Nov 14 is 01:00 UTC on Nov 15.
    const start = new Date("2026-11-15T01:00:00Z");
    await sendEquipmentConfirmationEmail({
      userEmail: "member@example.com",
      equipmentName: "3D Printer",
      startTime: start,
      endTime: new Date("2026-11-15T01:30:00Z"),
    });

    const body = bodyOf();
    expect(body).toContain(`Time: ${nwt(start, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })}`);
    expect(body).toContain(nwt(start, { year: "numeric", month: "numeric", day: "numeric" }));
    expect(body).toMatch(/\b7:00:00\b/);
  });

  it("dates a payment reminder by the business calendar", async () => {
    // 21:00 NWT on Saturday Nov 14 is already Sunday Nov 15 in UTC.
    const due = new Date("2026-11-15T03:00:00Z");
    await sendMembershipPaymentReminderEmail({
      userEmail: "member@example.com",
      planTitle: "Makerspace Member",
      nextPaymentDate: due,
      amountDue: 52.5,
    });

    const expected = nwt(due, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    expect(expected).toMatch(/14/);
    expect(bodyOf()).toContain(`charged overnight on ${expected}.`);
  });

  it("quotes both the previous and new dates of a moved registration in business time", async () => {
    await sendAdminWorkshopMoveEmail({
      userEmail: "member@example.com",
      workshopName: "Laser Cutter Basics",
      fromStartDate: SESSION_START,
      fromEndDate: SESSION_END,
      toStartDate: new Date("2026-11-21T16:30:00Z"),
      toEndDate: new Date("2026-11-21T18:30:00Z"),
    });

    const body = bodyOf();
    expect(body).toMatch(/Previous date: .*10:30:00.* - .*12:30:00/);
    expect(body).toMatch(/New date: .*10:30:00.* - .*12:30:00/);
  });
});
