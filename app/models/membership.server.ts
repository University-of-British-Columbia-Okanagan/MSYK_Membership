import { db } from "../utils/db.server";

interface MembershipPlanData {
  title: string;
  description: string;
  price: number;
  features: string[];
}

export async function getMembershipPlans() {
  const membershipPlans = await db.membershipPlan.findMany({
    orderBy: {
      id: "asc",
    },
  });
  return membershipPlans;
}

export async function addMembershipPlan(data: MembershipPlanData) {
  try {
    // Convert the features array into a JSON object
    const featuresJson = data.features.reduce((acc, feature, index) => {
      acc[`Feature${index + 1}`] = feature;
      return acc;
    }, {} as Record<string, string>);

    const newPlan = await db.membershipPlan.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        feature: featuresJson,
      },
    });
    return newPlan;
  } catch (error) {
    console.error("Error adding membership plan:", error);
    throw new Error("Failed to add membership plan");
  }
}

export async function deleteMembershipPlan(planId: number) {
  try {
    await db.membershipPlan.delete({
      where: {
        id: planId,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting membership plan:", error);
    throw new Error("Failed to delete membership plan");
  }
}

export async function getMembershipPlan(planId: number) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) return null;

  return plan;
}

export async function updateMembershipPlan(
  planId: number,
  data: {
    title: string;
    description: string;
    price: number;
    // features: string[];
    features: Record<string, string>;
  }
) {
  return await db.membershipPlan.update({
    where: { id: planId },
    data: {
      title: data.title,
      description: data.description,
      price: data.price,
      feature: data.features, // Convert features array to JSON
    },
  });
}

export async function getMembershipPlanById(planId: number) {
  return db.membershipPlan.findUnique({
    where: { id: planId },
  });
}

/*
* This function handles roleLevel 2 and 3
*/
export async function registerMembershipSubscription(
  userId: number,
  membershipPlanId: number
) {
  // Check if the user already has a membership.
  const existing = await db.userMembership.findUnique({
    where: { userId },
  });

  if (existing) {
    throw new Error("You are already subscribed to a membership. Please cancel your current membership before subscribing to a new plan.");
  }

  // Create the membership subscription.
  const newSubscription = await db.userMembership.create({
    data: {
      userId,
      membershipPlanId,
    },
  });

  // Fetch the current user to check their role level.
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  // If the user has completed an orientation (roleLevel >= 2) but is not yet upgraded to level 3, update them.
  if (user && user.roleLevel >= 2 && user.roleLevel < 3) {
    await db.user.update({
      where: { id: userId },
      data: { roleLevel: 3 },
    });
  }

  return newSubscription;
}

/*
* This function handles roleLevel 2 and 3
*/
export async function cancelMembership(userId: number, membershipPlanId: number) {
  // Delete the membership subscription.
  const result = await db.userMembership.deleteMany({
    where: {
      userId,
      membershipPlanId,
    },
  });

  // Count passed orientation registrations for the user.
  const passedOrientationCount = await db.userWorkshop.count({
    where: {
      userId,
      result: { equals: "passed", mode: "insensitive" },
      workshop: {
        type: { equals: "orientation", mode: "insensitive" },
      },
    },
  });

  // Determine new role level:
  // - If at least one passed orientation exists, user becomes level 2.
  // - Otherwise, revert to level 1.
  const newRoleLevel = passedOrientationCount > 0 ? 2 : 1;

  await db.user.update({
    where: { id: userId },
    data: { roleLevel: newRoleLevel },
  });

  return result;
}

export async function getUserMemberships(userId: number) {
  return db.userMembership.findMany({
    where: { userId },
  });
}
