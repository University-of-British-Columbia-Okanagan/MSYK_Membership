import {
  getRoleUserAdminFixture,
  getRoleUserFixture,
} from "tests/fixtures/session/getRoleUser";
import {
  deleteEquipment,
  duplicateEquipment,
  updateEquipment,
} from "~/models/equipment.server";
import { action } from "~/routes/dashboard/equipments";
import { getRoleUser } from "~/utils/session.server";

jest.mock("~/utils/session.server");
jest.mock("~/models/equipment.server");
jest.mock("~/logging/logger");

const mockGetRoleUser = getRoleUser as jest.Mock;
const mockDelete = deleteEquipment as jest.Mock;
const mockDuplicate = duplicateEquipment as jest.Mock;
const mockUpdate = updateEquipment as jest.Mock;

const post = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request("http://localhost:5173/dashboard/equipments", {
    method: "POST",
    body: form,
  });
};

const ACTIONS: Record<string, Record<string, string>> = {
  delete: { action: "delete", equipmentId: "7" },
  duplicate: { action: "duplicate", equipmentId: "7" },
  edit: {
    action: "edit",
    equipmentId: "7",
    name: "Renamed",
    description: "d",
    availability: "true",
  },
};

const expectRejected = async (request: Request) => {
  let thrown: unknown;
  try {
    await action({ request });
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Response);
  expect((thrown as Response).status).toBe(401);
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockDuplicate).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
};

describe("equipments action requires an admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(Object.keys(ACTIONS))(
    "rejects a logged-out %s without touching equipment",
    async (name) => {
      mockGetRoleUser.mockResolvedValue(null);
      await expectRejected(post(ACTIONS[name]));
    }
  );

  it.each(Object.keys(ACTIONS))(
    "rejects a non-admin %s without touching equipment",
    async (name) => {
      mockGetRoleUser.mockResolvedValue(getRoleUserFixture);
      await expectRejected(post(ACTIONS[name]));
    }
  );

  it("lets an admin delete", async () => {
    mockGetRoleUser.mockResolvedValue(getRoleUserAdminFixture);
    mockDelete.mockResolvedValue(undefined);

    const result = await action({ request: post(ACTIONS.delete) });

    expect(mockDelete).toHaveBeenCalledWith(7);
    expect(result).toEqual({ message: "Equipment deleted successfully." });
  });

  it("lets an admin duplicate", async () => {
    mockGetRoleUser.mockResolvedValue(getRoleUserAdminFixture);
    mockDuplicate.mockResolvedValue({ name: "Laser (Copy)" });

    const result = await action({ request: post(ACTIONS.duplicate) });

    expect(mockDuplicate).toHaveBeenCalledWith(7);
    expect(result).toEqual({ message: "Equipment duplicated: Laser (Copy)" });
  });

  it("lets an admin edit", async () => {
    mockGetRoleUser.mockResolvedValue(getRoleUserAdminFixture);
    mockUpdate.mockResolvedValue(undefined);

    const result = await action({ request: post(ACTIONS.edit) });

    expect(mockUpdate).toHaveBeenCalledWith(7, {
      name: "Renamed",
      description: "d",
      availability: true,
    });
    expect(result).toEqual({ message: "Equipment updated successfully." });
  });
});
