import {
  getRoleUserAdminFixture,
  getRoleUserFixture,
} from "tests/fixtures/session/getRoleUser";
import { getWorkshopWithPriceVariations } from "~/models/workshop.server";
import {
  getAvailableEquipment,
  getEquipmentSlotsWithStatus,
} from "~/models/equipment.server";
import { getEquipmentVisibilityDays } from "~/models/admin.server";
import { loader } from "~/routes/dashboard/workshopofferagain";
import { getRoleUser, getUser } from "~/utils/session.server";

jest.mock("~/utils/session.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/equipment.server");
jest.mock("~/models/admin.server");
jest.mock("~/logging/logger");

const mockGetRoleUser = getRoleUser as jest.Mock;
const mockGetUser = getUser as jest.Mock;
const mockGetWorkshop = getWorkshopWithPriceVariations as jest.Mock;
const mockSlots = getEquipmentSlotsWithStatus as jest.Mock;
const mockAvailable = getAvailableEquipment as jest.Mock;
const mockVisibility = getEquipmentVisibilityDays as jest.Mock;

const request = () =>
  new Request("http://localhost:5173/dashboard/workshops/offer/5");

const callLoader = () => loader({ request: request(), params: { id: "5" } });

describe("workshopofferagain loader requires an admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ["anonymous", null],
    ["non-admin", getRoleUserFixture],
  ])("denies %s with 403 before loading anything", async (_label, roleUser) => {
    mockGetRoleUser.mockResolvedValue(roleUser);

    let thrown: unknown;
    try {
      await callLoader();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
    expect(mockGetWorkshop).not.toHaveBeenCalled();
    expect(mockSlots).not.toHaveBeenCalled();
    expect(mockAvailable).not.toHaveBeenCalled();
  });

  it("loads the page for an admin", async () => {
    const workshop = { id: 5, name: "Laser Basics", occurrences: [] };
    mockGetRoleUser.mockResolvedValue(getRoleUserAdminFixture);
    mockGetUser.mockResolvedValue({ id: 1 });
    mockGetWorkshop.mockResolvedValue(workshop);
    mockSlots.mockResolvedValue([]);
    mockAvailable.mockResolvedValue([]);
    mockVisibility.mockResolvedValue(7);

    const result = await callLoader();

    expect(mockGetWorkshop).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      workshopId: 5,
      workshop,
      roleUser: getRoleUserAdminFixture,
      equipmentsWithSlots: [],
      availableEquipments: [],
      equipmentVisibilityDays: 7,
    });
  });
});
