import { createDbMock } from "tests/helpers/db.mock";

jest.mock("~/utils/db.server", () => createDbMock());
jest.mock("~/utils/session.server", () => ({
  getUserId: jest.fn().mockResolvedValue("1"),
}));
jest.mock("~/models/admin.server", () => ({
  getAdminSetting: jest.fn().mockResolvedValue("7"),
}));
jest.mock("~/utils/email.server", () => ({
  sendEquipmentConfirmationEmail: jest.fn(),
  sendEquipmentBulkConfirmationEmail: jest.fn(),
}));

export { db } from "~/utils/db.server";

export const getEquipmentMocks = () => {
  const { db } = require("~/utils/db.server");
  const { getUserId } = require("~/utils/session.server");
  const { getAdminSetting } = require("~/models/admin.server");
  const {
    sendEquipmentConfirmationEmail,
    sendEquipmentBulkConfirmationEmail,
  } = require("~/utils/email.server");

  return {
    db,
    mockGetUserId: getUserId as jest.Mock,
    mockGetAdminSetting: getAdminSetting as jest.Mock,
    mockSendEquipmentConfirmationEmail:
      sendEquipmentConfirmationEmail as jest.Mock,
    mockSendEquipmentBulkConfirmationEmail:
      sendEquipmentBulkConfirmationEmail as jest.Mock,
  };
};

