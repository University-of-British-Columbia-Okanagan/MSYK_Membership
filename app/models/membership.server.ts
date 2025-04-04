import { db } from "../utils/db.server";
import cron from "node-cron";

interface MembershipPlanData {
  title: string;
  description: string;
  price: number;
  features: string[];
}

function incrementMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1);
  return newDate;
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
  membershipPlanId: number,
  compensationPrice: number = 0,
  currentMembershipId: number | null = null,
  isDowngrade: boolean = false, // Flag to indicate if this is a downgrade
  isResubscription: boolean = false
) {
  let subscription;
  const now = new Date();

  // If compensationPrice is greater than 0, use it; otherwise, store null.
  const compPrice = compensationPrice > 0 ? compensationPrice : null;
  const hasPaid = compensationPrice > 0;

  console.log("hello world 593");

  // NEW: Handle resubscription - if a membership is cancelled and the user resubscribes,
  // simply update the cancelled membership's status to "active" without any payment.
  if (isResubscription) {
    console.log("Entering resubscription branch");
    let cancelledMembership;
    if (currentMembershipId) {
      cancelledMembership = await db.userMembership.findUnique({
        where: { id: currentMembershipId },
      });
    } else {
      cancelledMembership = await db.userMembership.findFirst({
        where: { userId, membershipPlanId, status: "cancelled" },
      });
    }
    if (!cancelledMembership) {
      throw new Error("No cancelled membership found for resubscription");
    }
    // Update the cancelled record to active.
    const subscription = await db.userMembership.update({
      where: { id: cancelledMembership.id },
      data: { status: "active" },
    });
    return subscription;
  }

  if (isDowngrade && currentMembershipId) {
    console.log("hello world2");
    const currentMembership = await db.userMembership.findUnique({
      where: { id: currentMembershipId },
      include: { membershipPlan: true },
    });

    if (!currentMembership) {
      throw new Error("Current membership not found");
    }

    // For downgrades, keep the current membership active until the next payment date
    // and schedule the new (cheaper) membership to start at the next payment date.
    const startDate = new Date(currentMembership.nextPaymentDate);
    const newNextPaymentDate = new Date(startDate);
    newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);

    // 1) Mark the old (more expensive) membership as ending
    await db.userMembership.update({
      where: { id: currentMembershipId },
      data: { status: "ending" },
    });

    // 2) Find if there's already an "active" or "ending" record for this user/plan
    //    (we only want 1 record in active or ending for the cheaper plan).
    let newMembership = await db.userMembership.findFirst({
      where: {
        userId,
        membershipPlanId,
        // We only care if it's still "active" or "ending"
        OR: [{ status: "active" }, { status: "ending" }],
      },
    });

    if (newMembership) {
      // 3a) If found, update that record to "active" with the new start/nextPaymentDate
      newMembership = await db.userMembership.update({
        where: { id: newMembership.id },
        data: {
          date: startDate,
          nextPaymentDate: newNextPaymentDate,
          status: "active",
          compensationPrice: null,
          hasPaidCompensationPrice: false,
        },
      });
      subscription = newMembership;
    } else {
      // 3b) Otherwise, create a fresh record for the downgraded plan
      subscription = await db.userMembership.create({
        data: {
          userId,
          membershipPlanId,
          date: startDate, // starts at old membership's nextPaymentDate
          nextPaymentDate: newNextPaymentDate,
          status: "active",
          compensationPrice: null,
          hasPaidCompensationPrice: false,
        },
      });
    }

    return subscription;
  }

  // Continue with existing upgrade/change logic
  else if (currentMembershipId) {
    console.log("hello world3");
    const currentMembership = await db.userMembership.findUnique({
      where: { id: currentMembershipId },
      include: { membershipPlan: true },
    });
  
    if (!currentMembership) {
      throw new Error("Current membership not found");
    }
  
    // Mark the old membership as ending
    await db.userMembership.update({
      where: { id: currentMembershipId },
      data: { status: "ending" },
    });
  
    // Create or update a new membership record for the upgraded plan
    // so that we only have 1 record in "active"/"ending" for the new plan.
    const startDate = new Date(currentMembership.nextPaymentDate);
    const newNextPaymentDate = new Date(startDate);
    newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);
  
    // Check if there's an existing record for the new plan in active/ending
    let newMembership = await db.userMembership.findFirst({
      where: {
        userId,
        membershipPlanId,
        OR: [{ status: "active" }, { status: "ending" }],
      },
    });
  
    if (newMembership) {
      // Update that record
      newMembership = await db.userMembership.update({
        where: { id: newMembership.id },
        data: {
          date: startDate, // new membership starts when the old membership ends
          nextPaymentDate: newNextPaymentDate,
          status: "active",
          compensationPrice: compPrice,
          hasPaidCompensationPrice: hasPaid,
        },
      });
      subscription = newMembership;
    } else {
      // Otherwise, create a fresh record for the new plan
      subscription = await db.userMembership.create({
        data: {
          userId,
          membershipPlanId,
          date: startDate,
          nextPaymentDate: newNextPaymentDate,
          status: "active",
          compensationPrice: compPrice,
          hasPaidCompensationPrice: hasPaid,
        },
      });
    }
  
    return subscription;
  } else {
    // Standard new subscription or simple update logic
    console.log("hello world4");
    const nextPaymentDate = new Date(now);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const existing = await db.userMembership.findFirst({
      where: { userId },
    });

    if (existing) {
      subscription = await db.userMembership.update({
        where: { id: existing.id },
        data: {
          membershipPlanId,
          nextPaymentDate,
          status: "active",
          compensationPrice: compPrice,
          hasPaidCompensationPrice: hasPaid,
        },
      });
    } else {
      subscription = await db.userMembership.create({
        data: {
          userId,
          membershipPlanId,
          nextPaymentDate,
          status: "active",
          compensationPrice: compPrice,
          hasPaidCompensationPrice: hasPaid,
        },
      });
    }
  }

  // Fetch the current user to determine their role - keeping your existing role logic
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
export async function cancelMembership(
  userId: number,
  membershipPlanId: number
) {
  // Delete the membership subscription.
  const membershipRecord = await db.userMembership.findFirst({
    where: {
      userId,
      membershipPlanId,
    },
  });

  let result;
  if (membershipRecord) {
    const now = new Date();
    // If cancellation occurs before the nextPaymentDate, update the status to "cancelled"
    if (now < membershipRecord.nextPaymentDate) {
      result = await db.userMembership.updateMany({
        where: {
          userId,
          membershipPlanId,
        },
        data: { status: "cancelled" },
      });

      // If we only set status to "cancelled," we do NOT update the user role.
      // We immediately return so the orientation logic below is skipped.
      return result;
    } else {
      // Otherwise, delete the membership subscription and run roleLevel logic.
      result = await db.userMembership.deleteMany({
        where: {
          userId,
          membershipPlanId,
        },
      });
    }
  } else {
    // If no membership is found, set result accordingly.
    result = null;
  }

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

export async function getCancelledMembership(userId: number) {
  return await db.userMembership.findFirst({
    where: {
      userId,
      status: "cancelled",
      nextPaymentDate: {
        gt: new Date(), // only return if the membership hasn't expired yet
      },
    },
    include: {
      membershipPlan: true, // <--- include the related plan
    },
  });
}

export async function getUserActiveMembership(userId: number) {
  return await db.userMembership.findFirst({
    where: {
      userId: userId,
      status: "active",
    },
    include: {
      membershipPlan: true,
    },
  });
}

// Ensure that incrementMonth is imported or defined appropriately.

export function startMonthlyMembershipCheck() {
  // Run every day at midnight (adjust the cron expression as needed)
  cron.schedule("06 00 * * *", async () => {
    console.log("Running monthly membership check...");

    try {
      const now = new Date();

      // Find memberships due for charge with status "active", "ending", or "cancelled"
      const dueMemberships = await db.userMembership.findMany({
        where: {
          nextPaymentDate: { lte: now },
          status: { in: ["active", "ending", "cancelled"] },
        },
        include: {
          membershipPlan: true, // so we can access the plan's price
        },
      });

      for (const membership of dueMemberships) {
        let chargeAmount: number;

        if (membership.status === "active") {
          // Process active memberships.
          if (
            membership.compensationPrice !== null &&
            membership.hasPaidCompensationPrice === false
          ) {
            // Use the compensation price for this billing cycle.
            chargeAmount = Number(membership.compensationPrice);
            console.log(
              `User ID: ${membership.userId} has a compensation pending. Charging compensation price: $${chargeAmount.toFixed(2)}`
            );

            // After processing the charge, update:
            // - Increment the nextPaymentDate by one month.
            // - Mark compensation as paid.
            await db.userMembership.update({
              where: { id: membership.id },
              data: {
                nextPaymentDate: incrementMonth(membership.nextPaymentDate),
                hasPaidCompensationPrice: true,
              },
            });
          } else {
            // Otherwise, charge the regular full price.
            chargeAmount = Number(membership.membershipPlan.price);
            console.log(
              `User ID: ${membership.userId} is being charged the full price: $${chargeAmount.toFixed(2)}`
            );

            await db.userMembership.update({
              where: { id: membership.id },
              data: {
                nextPaymentDate: incrementMonth(membership.nextPaymentDate),
              },
            });
          }
        } else if (membership.status === "ending" || membership.status === "cancelled") {
          // Process memberships with status "ending" or "cancelled".
          chargeAmount = Number(membership.membershipPlan.price);
          console.log(
            `User ID: ${membership.userId} (${membership.status}) is being charged the full price: $${chargeAmount.toFixed(2)}`
          );
          // Do not increment nextPaymentDate; instead, set status to inactive.
          await db.userMembership.update({
            where: { id: membership.id },
            data: { status: "inactive" },
          });
        }

        // (Integrate your actual payment gateway logic here using chargeAmount for membership.userId)

        // Update the user's roleLevel based on their current membership status.
        const user = await db.user.findUnique({
          where: { id: membership.userId },
        });
        if (user) {
          // Check if the user has any subscription that is not inactive.
          const activeMembership = await db.userMembership.findFirst({
            where: {
              userId: membership.userId,
              status: { not: "inactive" },
            },
          });

          if (activeMembership) {
            // If there is an active membership:
            // If the active membership is for plan 2 and the user has admin permission (allowLevel4 true),
            // set roleLevel to 4; otherwise, set roleLevel to 3.
            if (activeMembership.membershipPlanId === 2 && user.allowLevel4 === true) {
              await db.user.update({
                where: { id: user.id },
                data: { roleLevel: 4 },
              });
            } else {
              await db.user.update({
                where: { id: user.id },
                data: { roleLevel: 3 },
              });
            }
          } else {
            // No active membership found; downgrade to level 2.
            await db.user.update({
              where: { id: user.id },
              data: { roleLevel: 2 },
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in monthly membership check:", error);
    }
  });
}


// export function startExpiredMembershipCheck() {
//   cron.schedule("07 03 * * *", async () => {
//     console.log("Running expired membership check...");
//     try {
//       await checkExpiredMemberships();
//       console.log("Expired membership check completed successfully.");
//     } catch (error) {
//       console.error("Error during expired membership check:", error);
//     }
//   });
// }

// export async function checkExpiredMemberships() {
//   const now = new Date();

//   // 1. Find all expired memberships that are cancelled (nextPaymentDate < now)
//   const expiredMemberships = await db.userMembership.findMany({
//     where: {
//       status: "cancelled",
//       nextPaymentDate: { lt: now },
//     },
//     select: { userId: true },
//   });

//   // Get unique user IDs of affected users
//   const affectedUserIds = [...new Set(expiredMemberships.map((m) => m.userId))];

//   // 2. Delete all these expired, cancelled memberships
//   await db.userMembership.deleteMany({
//     where: {
//       status: "cancelled",
//       nextPaymentDate: { lt: now },
//     },
//   });

//   // 3. For each affected user, recalculate their role level
//   for (const userId of affectedUserIds) {
//     // Count remaining subscriptions (active ones, etc.)
//     const subscriptionCount = await db.userMembership.count({
//       where: { userId },
//     });

//     // Count passed orientation workshops for the user
//     const passedOrientationCount = await db.userWorkshop.count({
//       where: {
//         userId,
//         result: { equals: "passed", mode: "insensitive" },
//         workshop: {
//           type: { equals: "orientation", mode: "insensitive" },
//         },
//       },
//     });

//     // Determine base role level:
//     // - At least one passed orientation makes them level 2 if they have no subscription.
//     // - If they have a subscription, they become level 3.
//     let newRoleLevel = 1;
//     if (passedOrientationCount > 0) {
//       newRoleLevel = subscriptionCount > 0 ? 3 : 2;
//     }

//     // Check for level 4: if the user has a subscription with planId = 2 and allowLevel4 true.
//     const membershipPlan2 = await db.userMembership.findFirst({
//       where: { userId, membershipPlanId: 2 },
//     });
//     const user = await db.user.findUnique({
//       where: { id: userId },
//     });
//     if (membershipPlan2 && user?.allowLevel4) {
//       newRoleLevel = 4;
//     }

//     // Update the user's role level.
//     await db.user.update({
//       where: { id: userId },
//       data: { roleLevel: newRoleLevel },
//     });
//   }
// }
