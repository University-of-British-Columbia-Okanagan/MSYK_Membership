import { getWorkshopsFixture } from 'tests/fixtures/workshop/getWorkshops';
import { getUserFixture, getAdminFixture } from 'tests/fixtures/session/getRoleUser';
import { newEquipmentFixture } from 'tests/fixtures/equipments/addEquimentForm';
import { getEquipmentByName, addEquipment } from '~/models/equipment.server';
import { loader, action } from '~/routes/dashboard/addequipment';
import { getRoleUser } from "~/utils/session.server";
import { getWorkshops } from "~/models/workshop.server";
import { logger } from '~/logging/logger';

jest.mock("~/utils/session.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/equipment.server");
jest.mock('~/logging/logger');

jest.mock('@remix-run/node', () => ({
  redirect: jest.fn(),
}));

const mockGetWorkshops = getWorkshops as jest.Mock;
const mockGetRoleUser = getRoleUser as jest.Mock;
const mockGetEquipmentByName = getEquipmentByName as jest.Mock;
const mockAddEquipment = addEquipment as jest.Mock;
const mockLoggerInfo = logger.info as jest.Mock;

describe('loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns workshops and roleUser', async () => {
    mockGetWorkshops.mockResolvedValue(getWorkshopsFixture);
    mockGetRoleUser.mockResolvedValue(getUserFixture);
    const request = new Request('http://localhost:5173/dashboard/addequipment', {
      method: 'GET',
    });

    const result = await loader({ request });

    expect(mockGetWorkshops).toHaveBeenCalled();
    expect(mockGetRoleUser).toHaveBeenCalledWith(request);
    expect(result).toEqual({
      workshops: getWorkshopsFixture,
      roleUser: getUserFixture,
    });
  });
});

describe('action', () => {
  const createRequestWithForm = (form: Record<string, string>) => {
    const formData = new FormData();
    for (const key in form) {
      formData.append(key, form[key]);
    }
    return new Request('http://localhost:5173/dashboard/addequipment', { method: 'POST', body: formData });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully adds a new equipment', async () => {
    const request = createRequestWithForm(newEquipmentFixture);
    mockGetRoleUser.mockResolvedValue(getAdminFixture);
    mockGetEquipmentByName.mockResolvedValue(null);
    mockAddEquipment.mockResolvedValue(true);

    const result = await action({ request });
    const expectedPayload = {
      ...newEquipmentFixture,
      price: Number(newEquipmentFixture.price),
      availability: newEquipmentFixture.availability === 'true',
      workshopPrerequisites: [],
    };

    expect(mockAddEquipment).toHaveBeenCalledWith(expectedPayload);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining(expectedPayload.name),
      expect.any(Object)
    );
  });

  it('throws 401 if user is not admin', async () => {
    const request = createRequestWithForm(newEquipmentFixture);
    mockGetRoleUser.mockResolvedValue(getUserFixture);

    try {
      await action({ request });
      throw new Error();
    } catch (error: any) {
      expect(error).toBeInstanceOf(Response);
      expect(error.status).toBe(401);
      const text = await error.text();
      expect(text).toMatch(/Not Authorized/);
    }
  });

  it('fails when adding an equipment with the same name', async () => {
    const request = createRequestWithForm(newEquipmentFixture);
    mockGetRoleUser.mockResolvedValue(getAdminFixture);
    mockGetEquipmentByName.mockResolvedValue(true);
    mockAddEquipment.mockResolvedValue(true);

    try {
      await action({ request });
      throw new Error();
    } catch (error: any) {
      expect(error).toBeInstanceOf(Response);
      expect(error.status).toBe(409);
      const text = await error.text();
      expect(text).toMatch(/Equipment with this name already exists/);
    }
  });
});

