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
};

export type VolunteerHourEntry = {
  id: number;
  userId: number;
  startTime: Date;
  endTime: Date;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

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
    },
  });

  console.log("User:", user);

  const membership = await db.userMembership.findFirst({
    where: { userId: parseInt(userId), status: "active" },
    include: { membershipPlan: true },
  });

  console.log("Membership:", membership);

  const payment = await db.userPaymentInformation.findFirst({
    where: { userId: parseInt(userId) },
    select: { cardLast4: true, createdAt: true },
  });

  console.log("Payment:", payment);

  if (!user) return null;

  return {
    name: `${user.firstName} ${user.lastName}`,
    avatarUrl: user.avatarUrl,
    email: user.email,
    membershipTitle: membership?.membershipPlan.title ?? "None",
    membershipType: membership?.membershipPlan.type ?? "N/A",
    nextBillingDate: membership?.nextPaymentDate ?? null,
    cardLast4: payment?.cardLast4 ?? "N/A",
  };
}

export async function checkActiveVolunteerStatus(userId: number) {
  const activeVolunteer = await db.volunteer.findFirst({
    where: {
      userId,
      volunteerEnd: null,
    },
  });
  return activeVolunteer !== null;
}

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

export async function logVolunteerHours(
  userId: number,
  startTime: Date,
  endTime: Date,
  description?: string
) {
  return await db.volunteerTimetable.create({
    data: {
      userId,
      startTime,
      endTime,
      description,
    },
  });
}

export async function checkVolunteerHourOverlap(
  userId: number,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const overlappingHours = await db.volunteerTimetable.findFirst({
    where: {
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
          AND: [
            { startTime: { gte: startTime } },
            { endTime: { lte: endTime } },
          ],
        },
        // Existing session completely contains new session
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gte: endTime } },
          ],
        },
      ],
    },
  });

  return overlappingHours !== null;
}

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

export async function updateVolunteerHourStatus(
  hourId: number,
  status: string
) {
  return await db.volunteerTimetable.update({
    where: { id: hourId },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}

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
