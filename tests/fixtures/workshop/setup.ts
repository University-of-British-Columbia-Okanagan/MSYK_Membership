import { createDbMock } from "tests/helpers/db.mock";

// Setup all module mocks for workshop tests
jest.mock("~/utils/db.server", () => createDbMock());
jest.mock("~/utils/session.server");
jest.mock("~/models/equipment.server");
jest.mock("~/utils/googleCalendar.server");

// Re-export commonly used imports for convenience
export { db } from "~/utils/db.server";
export { getUser } from "~/utils/session.server";
export {
  createEquipmentSlotsForOccurrence,
  bulkBookEquipment,
} from "~/models/equipment.server";
export {
  createEventForOccurrence,
  updateEventForOccurrence,
  deleteEventForOccurrence,
} from "~/utils/googleCalendar.server";

/**
 * Helper to get typed mock functions for workshop tests
 */
export const getWorkshopMocks = () => {
  const { db } = require("~/utils/db.server");
  const { createEquipmentSlotsForOccurrence } = require("~/models/equipment.server");
  const {
    createEventForOccurrence,
    updateEventForOccurrence,
    deleteEventForOccurrence,
  } = require("~/utils/googleCalendar.server");

  return {
    db,
    mockCreateEquipmentSlotsForOccurrence: createEquipmentSlotsForOccurrence as jest.Mock,
    mockCreateEventForOccurrence: createEventForOccurrence as jest.Mock,
    mockUpdateEventForOccurrence: updateEventForOccurrence as jest.Mock,
    mockDeleteEventForOccurrence: deleteEventForOccurrence as jest.Mock,
  };
};

