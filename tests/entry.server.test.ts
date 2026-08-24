// entry.server.ts is the only place the three background jobs are started. Nothing else
// in the suite notices if one of those calls is dropped — the models still behave, the
// jobs simply never run in production. This suite guards the wiring itself.

const mockStartMonthlyMembershipCheck = jest.fn();
const mockStartWorkshopOccurrenceStatusUpdate = jest.fn();
const mockStartRoleLevelSyncCron = jest.fn();

jest.mock("~/models/membership.server", () => ({
  startMonthlyMembershipCheck: mockStartMonthlyMembershipCheck,
}));
jest.mock("~/models/workshop.server", () => ({
  startWorkshopOccurrenceStatusUpdate: mockStartWorkshopOccurrenceStatusUpdate,
}));
jest.mock("~/models/user.server", () => ({
  startRoleLevelSyncCron: mockStartRoleLevelSyncCron,
}));

describe("entry.server - background job startup", () => {
  let logSpy: jest.SpyInstance;

  /** Importing the entry point is what starts the jobs. */
  const boot = () => require("../entry.server");

  beforeEach(() => {
    jest.resetModules();
    mockStartMonthlyMembershipCheck.mockClear();
    mockStartWorkshopOccurrenceStatusUpdate.mockClear();
    mockStartRoleLevelSyncCron.mockClear();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("starts the membership billing cron", () => {
    boot();

    expect(mockStartMonthlyMembershipCheck).toHaveBeenCalledTimes(1);
  });

  it("starts the workshop occurrence status job", () => {
    boot();

    expect(mockStartWorkshopOccurrenceStatusUpdate).toHaveBeenCalledTimes(1);
  });

  it("starts the role level sync cron", () => {
    boot();

    expect(mockStartRoleLevelSyncCron).toHaveBeenCalledTimes(1);
  });

  it("registers each job once per process, not once per import", () => {
    // A second import must hit the module cache — re-running the file would register
    // duplicate cron jobs and double-charge memberships at midnight.
    boot();
    boot();

    expect(mockStartMonthlyMembershipCheck).toHaveBeenCalledTimes(1);
    expect(mockStartWorkshopOccurrenceStatusUpdate).toHaveBeenCalledTimes(1);
    expect(mockStartRoleLevelSyncCron).toHaveBeenCalledTimes(1);
  });
});
