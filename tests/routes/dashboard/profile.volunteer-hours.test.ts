// session.server throws at import time if SESSION_SECRET is unset, so this stays first.
import "tests/fixtures/session/setup";

import { getRoleUser } from "~/utils/session.server";
import {
  checkActiveVolunteerStatus,
  checkVolunteerHourOverlap,
  logVolunteerHours,
} from "~/models/profile.server";
import { action } from "~/routes/dashboard/profile";

jest.mock("~/utils/session.server");
jest.mock("~/models/profile.server");
jest.mock("~/models/membership.server");
jest.mock("~/models/workshop.server");
jest.mock("~/logging/logger");

const mockGetRoleUser = getRoleUser as jest.Mock;
const mockActive = checkActiveVolunteerStatus as jest.Mock;
const mockOverlap = checkVolunteerHourOverlap as jest.Mock;
const mockLog = logVolunteerHours as jest.Mock;

function logHours(startTime: string, endTime: string) {
  const body = new FormData();
  body.set("_action", "logHours");
  body.set("startTime", startTime);
  body.set("endTime", endTime);
  body.set("description", "Shop tidy");
  const request = new Request("http://localhost/dashboard/profile", {
    method: "POST",
    body,
  });
  return action({ request });
}

/**
 * The form posts "YYYY-MM-DDTHH:mm" with no offset. It means NWT wall time, so it must not
 * be read in the server's zone: on a UTC host 10:30 used to land at 04:30 NWT, and the
 * 9 AM and same-day rules were checked against the server's clock.
 */
describe("profile action: logging volunteer hours on the business clock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRoleUser.mockResolvedValue({ userId: 7, roleId: 2, roleName: "user" });
    mockActive.mockResolvedValue(true);
    mockOverlap.mockResolvedValue(false);
    mockLog.mockResolvedValue({});
  });

  it("stores 10:30 to 12:00 NWT as 16:30Z to 18:00Z", async () => {
    const result = await logHours("2026-11-09T10:30", "2026-11-09T12:00");

    expect(result).toEqual({ success: "Volunteer hours logged successfully!" });
    const [, start, end] = mockLog.mock.calls[0];
    expect(start.toISOString()).toBe("2026-11-09T16:30:00.000Z");
    expect(end.toISOString()).toBe("2026-11-09T18:00:00.000Z");
  });

  it("applies the 9 AM rule to the business hour", async () => {
    const result = await logHours("2026-11-09T08:30", "2026-11-09T10:00");

    expect(result).toEqual({ error: "Start time must be 9:00 AM or later" });
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("accepts an evening entry that crosses midnight UTC but not NWT", async () => {
    // 22:00 to 23:45 NWT is 04:00Z to 05:45Z on the next UTC day.
    const result = await logHours("2026-11-09T22:00", "2026-11-09T23:45");

    expect(result).toEqual({ success: "Volunteer hours logged successfully!" });
    const [, start] = mockLog.mock.calls[0];
    expect(start.toISOString()).toBe("2026-11-10T04:00:00.000Z");
  });

  it("rejects an unparseable time instead of logging Invalid Date", async () => {
    const result = await logHours("not-a-time", "2026-11-09T12:00");

    expect(result).toEqual({ error: "Start time and end time must be valid dates" });
    expect(mockLog).not.toHaveBeenCalled();
  });
});
