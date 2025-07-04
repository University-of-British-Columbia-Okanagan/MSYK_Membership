import { db } from "../utils/db.server";
import cron from "node-cron";
import Stripe from "stripe";
import bcrypt from "bcryptjs";
// import { getLatestUserPaymentInfo } from "./user.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

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
 * This function handles roleLevels
 */
export async function registerMembershipSubscription(
  userId: number,
  membershipPlanId: number,
  currentMembershipId: number | null = null,
  isDowngrade: boolean = false, // Flag to indicate if this is a downgrade
  isResubscription: boolean = false
) {
  let subscription;
  const now = new Date();

  const plan = await db.membershipPlan.findUnique({
    where: { id: membershipPlanId },
  });
  if (!plan) throw new Error("Plan not found");

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
        },
      });
    }

    const freshUser = await db.user.findUnique({ where: { id: userId } });
    if (freshUser) {
      // If they just moved into Plan 2 and meet the Level 4 criteria, bump to 4:
      if (
        plan.needAdminPermission &&
        freshUser.roleLevel >= 2 &&
        freshUser.allowLevel4
      ) {
        if (freshUser.roleLevel < 4) {
          await db.user.update({
            where: { id: userId },
            data: { roleLevel: 4 },
          });
        }
      }
      // Otherwise, if they’ve completed orientation and are below Level 3, at least Level 3:
      else if (freshUser.roleLevel >= 2 && freshUser.roleLevel < 3) {
        await db.user.update({
          where: { id: userId },
          data: { roleLevel: 3 },
        });
      }
    }

    return subscription;
  } else {
    // Standard new subscription or simple update logic
    console.log("Creating brand‑new subscription record");
    const startDate = new Date(now);
    const nextPaymentDate = incrementMonth(startDate);

    subscription = await db.userMembership.create({
      data: {
        userId,
        membershipPlanId,
        date: startDate,
        nextPaymentDate,
        status: "active",
      },
    });
  }

  // Fetch the current user to determine their role - keeping your existing role logic
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (user) {
    if (plan.needAdminPermission) {
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
 * This function handles roleLevels
 */
export async function cancelMembership(
  userId: number,
  membershipPlanId: number
) {
  // 1) Pick out the *currently active* subscription row only
  const activeRecord = await db.userMembership.findFirst({
    where: { userId, membershipPlanId, status: "active" },
  });

  // nothing active? no change
  if (!activeRecord) return null;

  const now = new Date();

  if (now < activeRecord.nextPaymentDate) {
    // 2a) Cancelling *before* the cycle ends → just mark this row 'cancelled'
    //     **NO** role‐level update here (you stay at level 3/4 until the cycle lapses)
    return db.userMembership.update({
      where: { id: activeRecord.id },
      data: { status: "cancelled" },
    });
  } else {
    // 2b) Cancelling *after* the cycle → delete that one record
    const deleted = await db.userMembership.delete({
      where: { id: activeRecord.id },
    });

    // 3) Now that the membership is gone, recalc roleLevel:
    //    level 2 if they passed orientation, else level 1
    const passedOrientationCount = await db.userWorkshop.count({
      where: {
        userId,
        result: { equals: "passed", mode: "insensitive" },
        workshop: { type: { equals: "orientation", mode: "insensitive" } },
      },
    });
    const newRoleLevel = passedOrientationCount > 0 ? 2 : 1;
    await db.user.update({
      where: { id: userId },
      data: { roleLevel: newRoleLevel },
    });

    return deleted;
  }
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

/*
 * This function handles roleLevels
 */
export function startMonthlyMembershipCheck() {
  // Run every day at midnight (adjust the cron expression as needed)
  cron.schedule("00 00 * * *", async () => {
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
        const user = await db.user.findUnique({
          where: { id: membership.userId },
        });
        if (!user) {
          console.error(`No user found for ID ${membership.userId}, skipping`);
          continue;
        }

        if (membership.status === "active") {
          // Process active memberships.
          const chargeAmount = Number(membership.membershipPlan.price);

          // Get user's saved payment method from UserPaymentInformation
          const savedPayment = await db.userPaymentInformation.findUnique({
            where: { userId: membership.userId },
          });

          if (
            !savedPayment?.stripeCustomerId ||
            !savedPayment?.stripePaymentMethodId
          ) {
            console.error(
              `❌ No saved payment info for user ${membership.userId}, skipping`
            );
            continue;
          }

          try {
            // Create payment intent using saved payment method
            const pi = await stripe.paymentIntents.create({
              amount: Math.round(chargeAmount * 100),
              currency: "usd",
              customer: savedPayment.stripeCustomerId,
              payment_method: savedPayment.stripePaymentMethodId,
              off_session: true,
              confirm: true,
              receipt_email: user.email,
              metadata: {
                userId: String(membership.userId),
                membershipId: String(membership.id),
                planId: String(membership.membershipPlanId),
              },
            });

            // Check if payment intent succeeded
            if (pi.status === "succeeded") {
              console.log(
                `✅ Payment intent succeeded for user ${
                  membership.userId
                }, charged $${chargeAmount.toFixed(2)}`
              );

              // Update the next payment date after successful payment
              await db.userMembership.update({
                where: { id: membership.id },
                data: {
                  nextPaymentDate: incrementMonth(membership.nextPaymentDate),
                },
              });
            } else {
              console.log(
                `⚠️ Payment intent for user ${membership.userId} has status: ${pi.status}`
              );

              // Payment intent didn't succeed, log the error
              if (pi.last_payment_error) {
                console.error(
                  `Payment error: ${JSON.stringify(pi.last_payment_error)}`
                );
              }
            }
          } catch (err: any) {
            console.error(
              `❌ Charge failed for user ${membership.userId}:`,
              err.message
            );
            continue;
          }
        } else if (
          membership.status === "ending" ||
          membership.status === "cancelled"
        ) {
          // Process memberships with status "ending" or "cancelled".
          console.log(
            `User ID: ${membership.userId} Current status ${membership.status} switched to inactive status.`
          );
          // Do not increment nextPaymentDate; instead, set status to inactive.
          await db.userMembership.update({
            where: { id: membership.id },
            data: { status: "inactive" },
          });
        }

        // Update the user's roleLevel based on their current membership status.
        if (user) {
          // Check if the user has any subscription that is not inactive.
          const activeMembership = await db.userMembership.findFirst({
            where: {
              userId: membership.userId,
              status: { not: "inactive" },
            },
            include: {
              membershipPlan: true,
            },
          });

          if (activeMembership) {
            // If there is an active membership:
            // If the active membership is for plan 2 and the user has admin permission (allowLevel4 true),
            // set roleLevel to 4; otherwise, set roleLevel to 3.
            if (
              activeMembership.membershipPlan.needAdminPermission &&
              user.allowLevel4 === true
            ) {
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
