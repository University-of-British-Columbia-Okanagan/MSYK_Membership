// session.server reads SESSION_SECRET at module load and throws if it is missing, so
// this must be set before the module under test is imported. Test files import this
// setup for its side effects on the first line, which guarantees that ordering.
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";
process.env.WAIVER_ENCRYPTION_KEY =
  process.env.WAIVER_ENCRYPTION_KEY ?? "test-waiver-key";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";

const createSessionDbMock = () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    roleUser: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
});

export type SessionDbMock = ReturnType<typeof createSessionDbMock>["db"];

jest.mock("~/utils/db.server", () => createSessionDbMock());

// session.server hashes and compares with bcryptjs. Real bcrypt is slow and its output
// is non-deterministic, so stand in a predictable implementation: hashing prefixes the
// value and comparing checks that prefix. That keeps "was this the right password?"
// assertable without depending on real hashing.
export const bcryptHashMock = jest.fn(
  async (value: string) => `hashed:${value}`
);
export const bcryptCompareMock = jest.fn(
  async (plain: string, hashed: string) => `hashed:${plain}` === hashed
);

jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => (bcryptHashMock as any)(...args),
    compare: (...args: unknown[]) => (bcryptCompareMock as any)(...args),
  },
}));

const mockSendRegistrationConfirmationEmail = jest.fn();
const mockSendMinorRegistrationNotificationEmail = jest.fn();

jest.mock("~/utils/email.server", () => ({
  sendRegistrationConfirmationEmail: mockSendRegistrationConfirmationEmail,
  sendMinorRegistrationNotificationEmail:
    mockSendMinorRegistrationNotificationEmail,
}));

jest.mock("~/logging/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

export { db } from "~/utils/db.server";

export const getSessionMocks = () => {
  const { db } = require("~/utils/db.server");
  const {
    sendRegistrationConfirmationEmail,
    sendMinorRegistrationNotificationEmail,
  } = require("~/utils/email.server");

  return {
    db,
    bcryptHashMock,
    bcryptCompareMock,
    mockSendRegistrationConfirmationEmail:
      sendRegistrationConfirmationEmail as jest.Mock,
    mockSendMinorRegistrationNotificationEmail:
      sendMinorRegistrationNotificationEmail as jest.Mock,
  };
};

export const resetSessionMocks = () => {
  bcryptHashMock.mockClear();
  bcryptCompareMock.mockClear();
  bcryptHashMock.mockImplementation(async (value: string) => `hashed:${value}`);
  bcryptCompareMock.mockImplementation(
    async (plain: string, hashed: string) => `hashed:${plain}` === hashed
  );
};
