import { db } from "../utils/db.server";
import { getUserId } from "~/utils/session.server";

export type UserProfileData = {
  name: string;
  avatarUrl: string | null;
  email: string;
  membershipTitle: string;
  membershipType: string;
  nextBillingDate: string | null;
  cardLast4: string;
  waiverSignature: string | null;
};

export type VolunteerHourEntry = {
  id: number;
  userId: number;
  startTime: Date;
  endTime: Date;
  description: string;
  isResubmission: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Retrieves comprehensive profile details for a user including membership and payment info
 * @param request - The HTTP request object to extract user ID from session
 * @returns Promise<Object|null> - User profile data with membership and payment details, or null if user not found
 */
export async function getProfileDetails(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: parseInt(userId) },
    select: {
      firstName: true,
      lastName: true,
      avatarUrl: true,
      email: true,
      waiverSignature: true,
    },
  });

  const membership = await db.userMembership.findFirst({
    where: { userId: parseInt(userId), status: "active" },
    include: { membershipPlan: true },
  });

  const payment = await db.userPaymentInformation.findFirst({
    where: { userId: parseInt(userId) },
    select: { cardLast4: true, createdAt: true },
  });

  if (!user) return null;

  return {
    name: `${user.firstName} ${user.lastName}`,
    avatarUrl: user.avatarUrl,
    email: user.email,
    membershipTitle: membership?.membershipPlan.title ?? "None",
    membershipType: membership?.membershipPlan.type ?? "N/A",
    nextBillingDate: membership?.nextPaymentDate ?? null,
    cardLast4: payment?.cardLast4 ?? "N/A",
    waiverSignature: user.waiverSignature,
  };
}

/**
 * Checks if a user is currently an active volunteer
 * @param userId - The ID of the user to check volunteer status for
 * @returns Promise<boolean> - True if user is an active volunteer, false otherwise
 */
export async function checkActiveVolunteerStatus(userId: number) {
  const activeVolunteer = await db.volunteer.findFirst({
    where: {
      userId,
      volunteerEnd: null,
    },
  });
  return activeVolunteer !== null;
}

/**
 * Retrieves volunteer hours entries for a specific user
 * @param userId - The ID of the user whose volunteer hours to retrieve
 * @param limit - Maximum number of entries to return (default: 10)
 * @returns Promise<VolunteerHourEntry[]> - Array of volunteer hour entries sorted by most recent
 */
export async function getVolunteerHours(
  userId: number,
  limit: number = 10
): Promise<VolunteerHourEntry[]> {
  return await db.volunteerTimetable.findMany({
    where: { userId },
    orderBy: { startTime: "desc" },
    take: limit,
  });
}

/**
 * Logs new volunteer hours for a user
 * @param userId - The ID of the user logging volunteer hours
 * @param startTime - The start time of the volunteer session
 * @param endTime - The end time of the volunteer session
 * @param description - Description of the volunteer work performed
 * @param isResubmission - Whether this is a resubmission for denied hours
 * @returns Promise<VolunteerHourEntry> - The created volunteer hour entry
 */
export async function logVolunteerHours(
  userId: number,
  startTime: Date,
  endTime: Date,
  description: string,
  isResubmission: boolean = false
) {
  return await db.volunteerTimetable.create({
    data: {
      userId,
      startTime,
      endTime,
      description,
      isResubmission,
    },
  });
}

/**
 * Checks if proposed volunteer hours overlap with existing logged hours for a user
 * @param userId - The ID of the user to check for overlaps
 * @param startTime - The proposed start time of the new volunteer session
 * @param endTime - The proposed end time of the new volunteer session
 * @param isResubmission - Whether this is a resubmission (allows overlap with denied hours)
 * @returns Promise<boolean> - True if there's an overlap, false otherwise
 */
export async function checkVolunteerHourOverlap(
  userId: number,
  startTime: Date,
  endTime: Date,
  isResubmission: boolean = false
): Promise<boolean> {
  const whereClause: any = {
    userId,
    OR: [
      // New session starts during existing session
      {
        AND: [
          { startTime: { lte: startTime } },
          { endTime: { gt: startTime } },
        ],
      },
      // New session ends during existing session
      {
        AND: [{ startTime: { lt: endTime } }, { endTime: { gte: endTime } }],
      },
      // New session completely contains existing session
      {
        AND: [{ startTime: { gte: startTime } }, { endTime: { lte: endTime } }],
      },
      // Existing session completely contains new session
      {
        AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }],
      },
    ],
  };

  // If this is a resubmission, exclude denied hours from overlap check
  if (isResubmission) {
    whereClause.status = {
      not: "denied",
    };
  }

  const overlappingHours = await db.volunteerTimetable.findFirst({
    where: whereClause,
  });

  return overlappingHours !== null;
}

/**
 * Retrieves all volunteer hours entries across all users (admin function)
 * @returns Promise<Array> - Array of all volunteer hour entries with user information, ordered by creation date
 */
export async function getAllVolunteerHours() {
  return await db.volunteerTimetable.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Updates the status of a volunteer hour entry and tracks the previous status
 * @param hourId - The ID of the volunteer hour entry to update
 * @param status - The new status to set (e.g., "approved", "denied", "pending")
 * @returns Promise<VolunteerHourEntry> - The updated volunteer hour entry
 */
export async function updateVolunteerHourStatus(
  hourId: number,
  status: string
) {
  // Get the current status before updating
  const currentEntry = await db.volunteerTimetable.findUnique({
    where: { id: hourId },
    select: { status: true },
  });

  const previousStatus = currentEntry?.status || "pending";

  return await db.volunteerTimetable.update({
    where: { id: hourId },
    data: {
      status,
      previousStatus: previousStatus,
      updatedAt: new Date(),
    },
  });
}

/**
 * Retrieves recent volunteer hour actions/updates for admin monitoring
 * @param limit - Maximum number of recent actions to return (default: 50)
 * @returns Promise<Array> - Array of recently updated volunteer hour entries with user information
 */
export async function getRecentVolunteerHourActions(limit: number = 50) {
  return await db.volunteerTimetable.findMany({
    where: {
      updatedAt: {
        not: undefined,
      },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
  });
}
