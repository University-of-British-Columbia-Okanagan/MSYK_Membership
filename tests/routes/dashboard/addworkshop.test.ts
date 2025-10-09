import { getWorkshopsFixture } from 'tests/fixtures/workshop/workshops';
import { getUserFixture, getUserAdminFixture } from 'tests/fixtures/session/getUser';
import { getUser, getRoleUser } from "~/utils/session.server";
import { addWorkshop, getWorkshops } from "~/models/workshop.server";
import { getRoleUserAdminFixture, getRoleUserFixture } from 'tests/fixtures/session/getRoleUser';
import { bulkBookEquipment, createEquipmentSlotsForOccurrence, getAvailableEquipmentForAdmin, getEquipmentSlotsWithStatus } from '~/models/equipment.server';
import { getEquipmentVisibilityDays } from '~/models/admin.server';
import { getEquipmentSlotsWithStatusFixture } from 'tests/fixtures/equipments/getEquipmentSlotsWithStatus';
import { logger } from '~/logging/logger';
import { loader, action} from '~/routes/dashboard/addworkshop';

jest.mock("~/utils/session.server");
jest.mock("~/models/workshop.server");
jest.mock("~/models/equipment.server");
jest.mock("~/models/admin.server");
jest.mock('~/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));


jest.mock('@remix-run/node', () => ({
  redirect: jest.fn(),
}));

const mockGetWorkshops = getWorkshops as jest.Mock;
const mockGetUser = getUser as jest.Mock;
const mockGetRoleUser = getRoleUser as jest.Mock;
const mockGetEquipmentSlotsWithStatus = getEquipmentSlotsWithStatus as jest.Mock;
const mockGetEquipmentVisibilityDays = getEquipmentVisibilityDays as jest.Mock;
const mockGetAvailableEquipmentForAdmin = getAvailableEquipmentForAdmin as jest.Mock;
const mockAddWorkshop = addWorkshop as jest.Mock;
const mockBulkBookEquipment = bulkBookEquipment as jest.Mock;
const mockCreateEquipmentSlotsForOccurrence = createEquipmentSlotsForOccurrence as jest.Mock;
const mockRedirect = require('@remix-run/node').redirect as jest.Mock;

describe('loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loader for add workshop', async () => {
    mockGetWorkshops.mockResolvedValue(getWorkshopsFixture);
    mockGetUser.mockResolvedValue(getUserFixture);
    mockGetRoleUser.mockResolvedValue(getRoleUserFixture);
    mockGetEquipmentSlotsWithStatus.mockResolvedValue(getEquipmentSlotsWithStatusFixture);
    mockGetEquipmentVisibilityDays.mockResolvedValue(1);

    const request = new Request('http://localhost:5173/dashboard/addworkshop', {
      method: 'GET',
    });

    const result = await loader({ request });

    expect(mockGetWorkshops).toHaveBeenCalled();
    expect(mockGetUser).toHaveBeenCalledWith(request);
    expect(mockGetRoleUser).toHaveBeenCalledWith(request);
    expect(mockGetEquipmentSlotsWithStatus).toHaveBeenCalledWith(getUserFixture.id, true);
    expect(mockGetEquipmentVisibilityDays).toHaveBeenCalled();
  });
});

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject non-admin users', async () => {
    mockGetRoleUser.mockResolvedValue(getRoleUserFixture);

    const request = new Request('http://localhost:5173/dashboard/addworkshop', {
      method: 'POST',
    });

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


  it('should return error if occurrences JSON has end date before start date', async () => {
    mockGetRoleUser.mockResolvedValue({ userId: 1, roleName: 'admin' });

    const formData = new FormData();
    formData.append('selectedSlots', '{}');
    formData.append('prerequisites', '[]');
    formData.append('equipments', '[]');
    formData.append('occurrences', JSON.stringify([
      { startDate: '2025-07-25T10:00:00Z', endDate: '2025-07-25T09:00:00Z' }
    ]));

    const request = new Request('http://localhost:5173/dashboard/addworkshop', {
      method: 'POST',
      body: formData,
    });

    const result = await action({ request });

    expect(result).toEqual({
      errors: {
        occurrences: ['End date must be later than start date'],
      },
    });
  });

  it('should create a workshop successfully for admin with valid input', async () => {
    mockGetRoleUser.mockResolvedValue(getRoleUserAdminFixture);
    mockGetAvailableEquipmentForAdmin.mockResolvedValue([{ id: 1 }]);
    mockAddWorkshop.mockResolvedValue({
      id: 100,
      occurrences: [
        { id: 200, startDate: new Date(), endDate: new Date() },
      ],
    });
    mockBulkBookEquipment.mockResolvedValue(undefined);
    mockCreateEquipmentSlotsForOccurrence.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append('name', 'Test Workshop');
    formData.append('description', 'A description');
    formData.append('price', '100');
    formData.append('location', 'Room 1');
    formData.append('capacity', '20');
    formData.append('type', 'workshop');
    formData.append('occurrences', JSON.stringify([
      { startDate: '2025-07-25T10:00:00Z', endDate: '2025-07-25T12:00:00Z' },
    ]));
    formData.append('prerequisites', JSON.stringify([1, 2]));
    formData.append('equipments', JSON.stringify([1]));
    formData.append('isWorkshopContinuation', 'false');
    formData.append('selectedSlots', JSON.stringify({ 1: [1, 2, 3] }));

    const request = new Request('http://localhost:5173/dashboard/addworkshop', {
        method: 'POST',
        body: formData,
    });


    await action({ request });

    expect(mockAddWorkshop).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(`[User: ${getRoleUserAdminFixture.userId}] Created workshop Test Workshop successfully.`, { url: 'http://localhost:5173/dashboard/addworkshop' });
  });
});