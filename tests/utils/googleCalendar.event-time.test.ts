jest.mock("~/models/admin.server", () => ({
  getAdminSetting: jest.fn(),
  updateAdminSetting: jest.fn(),
}));
jest.mock("~/logging/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { buildEventResource } from "~/utils/googleCalendar.server";

const workshop = {
  id: 7,
  name: "Woodshop Orientation",
  description: "Intro to the shop",
  location: "Makerspace YK",
  capacity: 8,
  type: "orientation",
  price: 0,
};

describe("Google Calendar event times", () => {
  it("sends the NWT wall time with an explicit -06:00 offset", () => {
    // The production row after repair: 10:30 NWT on Nov 14 is 16:30Z.
    const event = buildEventResource(
      workshop,
      {
        id: 74,
        startDate: new Date("2026-11-14T16:30:00.000Z"),
        endDate: new Date("2026-11-14T20:00:00.000Z"),
      },
      "America/Yellowknife",
      "https://my.makerspaceyk.com"
    );
    expect(event.start).toEqual({ dateTime: "2026-11-14T10:30:00-06:00", timeZone: "America/Yellowknife" });
    expect(event.end).toEqual({ dateTime: "2026-11-14T14:00:00-06:00", timeZone: "America/Yellowknife" });
  });

  it("keeps a summer session at the same wall time, since NWT no longer changes clocks", () => {
    const event = buildEventResource(
      workshop,
      { id: 1, startDate: new Date("2027-07-10T16:30:00.000Z"), endDate: new Date("2027-07-10T18:30:00.000Z") },
      "America/Yellowknife",
      ""
    );
    expect(event.start?.dateTime).toBe("2027-07-10T10:30:00-06:00");
  });

  it("puts an evening session on its NWT date even when UTC has rolled over", () => {
    const event = buildEventResource(
      workshop,
      { id: 79, startDate: new Date("2026-11-16T23:00:00.000Z"), endDate: new Date("2026-11-17T02:00:00.000Z") },
      "America/Yellowknife",
      ""
    );
    expect(event.start?.dateTime).toBe("2026-11-16T17:00:00-06:00");
    expect(event.end?.dateTime).toBe("2026-11-16T20:00:00-06:00");
  });
});
