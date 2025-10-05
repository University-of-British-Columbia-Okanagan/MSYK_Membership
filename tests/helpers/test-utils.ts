import { db } from "~/utils/db.server";

/**
 * Get typed mock instances for commonly mocked modules
 */
export const getMockDb = () => {
  return db;
};

/**
 * Clear all Jest mocks - call this in beforeEach
 */
export const clearAllMocks = () => {
  jest.clearAllMocks();
};

/**
 * Reset all Jest mocks to their initial state
 */
export const resetAllMocks = () => {
  jest.resetAllMocks();
};

/**
 * Helper to create a mock request object
 */
export const createMockRequest = (options?: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
}) => {
  return new Request(options?.url || "http://localhost:5173", {
    method: options?.method || "GET",
    headers: options?.headers,
  });
};

