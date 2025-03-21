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
        accessHours: "24/7", // or any appropriate value
        type: "standard", // or any appropriate value
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
  let subscription;
  // Check if the user already has a membership subscription.
  const existing = await db.userMembership.findUnique({
    where: { userId },
  });

  if (existing) {
    // Overwrite the existing subscription with the new membershipPlanId.
    subscription = await db.userMembership.update({
      where: { userId },
      data: { membershipPlanId },
    });
  } else {
    // Create a new membership subscription.
    subscription = await db.userMembership.create({
      data: {
        userId,
        membershipPlanId,
      },
    });
  }

  // Fetch the current user to determine their role.
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (user) {
    if (membershipPlanId === 2) {
      // For membershipPlan 2 (special membership that can grant level 4):
      // A user must have completed an orientation (roleLevel >= 2) and have allowLevel4 set to true.
      if (user.roleLevel >= 2 && user.allowLevel4) {
        // Upgrade to level 4 if not already.
        if (user.roleLevel < 4) {
          await db.user.update({
            where: { id: userId },
            data: { roleLevel: 4 },
          });
        }
      } else {
        // If the extra condition is not met but the user has completed an orientation,
        // set them to level 3.
        if (user.roleLevel >= 2 && user.roleLevel < 3) {
          await db.user.update({
            where: { id: userId },
            data: { roleLevel: 3 },
          });
        }
      }
    } else {
      // For any other membership plan:
      // If the user has completed an orientation (roleLevel >= 2) and is below level 3, upgrade them to level 3.
      if (user.roleLevel >= 2 && user.roleLevel < 3) {
        await db.user.update({
          where: { id: userId },
          data: { roleLevel: 3 },
        });
      }
    }
  }

  return subscription;
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
