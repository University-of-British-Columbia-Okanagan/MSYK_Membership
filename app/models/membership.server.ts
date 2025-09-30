import { db } from "../utils/db.server";
import cron from "node-cron";
import Stripe from "stripe";
import { getAdminSetting } from "./admin.server";
import { sendMembershipPaymentReminderEmail } from "~/utils/email.server";
import CryptoJS from "crypto-js";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

interface MembershipPlanData {
  title: string;
  description: string;
  price: number;
  price6Months?: number | null;
  priceYearly?: number | null;
  features: string[];
  needAdminPermission?: boolean;
}

function incrementMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1);
  return newDate;
}

/**
 * Retrieve all membership plans ordered by ID
 * @returns Array of all membership plans ordered by ascending ID
 */
export async function getMembershipPlans() {
  const membershipPlans = await db.membershipPlan.findMany({
    orderBy: {
      id: "asc",
    },
  });
  return membershipPlans;
}

/**
 * Create a new membership plan with features (Admin only)
 * @param data Membership plan data including title, description, price, and features array
 * @param data.title The title/name of the membership plan
 * @param data.description Detailed description of the membership plan
 * @param data.price Monthly price of the membership plan
 * @param data.features Array of feature strings that will be converted to JSON object
 * @returns Created membership plan record
 */
export async function addMembershipPlan(data: MembershipPlanData) {
  try {
    // Convert the features array into a JSON object
    const featuresJson = data.features.reduce(
      (acc, feature, index) => {
        acc[`Feature${index + 1}`] = feature;
        return acc;
      },
      {} as Record<string, string>
    );

    const newPlan = await db.membershipPlan.create({
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        price6Months: data.price6Months,
        priceYearly: data.priceYearly,
        needAdminPermission: data.needAdminPermission ?? false,
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

/**
 * Delete a membership plan (Admin only)
 * @param planId The ID of the membership plan to delete
 * @returns Object with success status
 */
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

/**
 * Get a single membership plan by ID (alias for getMembershipPlanById)
 * @param planId The ID of the membership plan to retrieve
 * @returns Membership plan record or null if not found
 */
export async function getMembershipPlan(planId: number) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) return null;

  return plan;
}

/**
 * Update an existing membership plan (Admin only)
 * @param planId The ID of the membership plan to update
 * @param data Updated membership plan data
 * @param data.title New title for the membership plan
 * @param data.description New description for the membership plan
 * @param data.price New monthly price for the membership plan
 * @param data.features Updated features as a Record object
 * @returns Updated membership plan record
 */
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

/**
 * Get a membership plan by its ID
 * @param planId The ID of the membership plan to retrieve
 * @returns Membership plan record or null if not found
 */
export async function getMembershipPlanById(planId: number) {
  return db.membershipPlan.findUnique({
    where: { id: planId },
  });
}

/**
 * Register a new membership subscription with role level management
 * Handles new subscriptions, upgrades, downgrades, and resubscriptions
 * This function deals with role levels
 * @param userId The ID of the user subscribing
 * @param membershipPlanId The ID of the membership plan to subscribe to
 * @param currentMembershipId The ID of current membership (for upgrades/downgrades)
 * @param isDowngrade Flag indicating if this is a downgrade (cheaper plan)
 * @param isResubscription Flag indicating if this is reactivating a cancelled membership
 * @returns Created or updated membership subscription record
 */
export async function registerMembershipSubscription(
  userId: number,
  membershipPlanId: number,
  currentMembershipId: number | null = null,
  isDowngrade: boolean = false, // Flag to indicate if this is a downgrade
  isResubscription: boolean = false,
  paymentIntentId?: string
) {
  let subscription;
  const now = new Date();

  const plan = await db.membershipPlan.findUnique({
    where: { id: membershipPlanId },
  });
  if (!plan) throw new Error("Plan not found");

  // Handle resubscription - if a membership is cancelled and the user resubscribes,
  // Simply update the cancelled membership's status to "active" without any payment.
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
    // Update the cancelled record to active and set new next payment date
    const now = new Date();
    const newNextPaymentDate = new Date(now);
    newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);

    const subscription = await db.userMembership.update({
      where: { id: cancelledMembership.id },
      data: {
        status: "active",
        nextPaymentDate: newNextPaymentDate,
      },
    });

    // Reactivate the UserMembershipForm as well
    await updateMembershipFormStatus(
      userId,
      membershipPlanId,
      "active",
      subscription.id
    );

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

    // Set the old membership's form to "ending" to match
    await updateMembershipFormStatus(
      userId,
      currentMembership.membershipPlanId,
      "ending"
    );

    // 2) Find if there's already an "active" or "ending" record for this user/plan
    // (we only want 1 record in active or ending for the cheaper plan).
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
          ...(paymentIntentId ? { paymentIntentId } : {}),
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
          ...(paymentIntentId ? { paymentIntentId } : {}),
        },
      });
    }

    // Activate the new membership's form immediately (no payment needed for downgrade)
    await updateMembershipFormStatus(
      userId,
      membershipPlanId,
      "active",
      subscription.id
    );

    return subscription;
  }

  // Continue with upgrade/change logic
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

    // Set the old membership's form to "inactive" since it's ending
    await updateMembershipFormStatus(
      userId,
      currentMembership.membershipPlanId,
      "ending"
    );

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
          ...(paymentIntentId ? { paymentIntentId } : {}),
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
          ...(paymentIntentId ? { paymentIntentId } : {}),
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
        ...(paymentIntentId ? { paymentIntentId } : {}),
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

/**
 * Cancel a user's active membership subscription with intelligent role level management
 * This function handles roleLevels
 * If cancelled before the billing cycle ends, marks as 'cancelled' but preserves access until next payment date
 * If cancelled after the billing cycle ends, deletes the membership and recalculates user role level based on completed orientations
 * @param userId The ID of the user cancelling their membership
 * @param membershipPlanId The ID of the membership plan to cancel
 * @returns Updated membership record if cancelled before cycle end, deleted record if cancelled after cycle end, or null if no active membership found
 */
export async function cancelMembership(
  userId: number,
  membershipPlanId: number
) {
  // 1) Pick out the *currently active* subscription row only
  const activeRecord = await db.userMembership.findFirst({
    where: { userId, membershipPlanId, status: "active" },
  });

  // Nothing active? no change
  if (!activeRecord) return null;

  const now = new Date();

  if (now < activeRecord.nextPaymentDate) {
    // 2a) Cancelling *before* the cycle ends → just mark this row 'cancelled'
    // **NO** role­level update here (you stay at level 3/4 until the cycle lapses)

    // Update the UserMembership status
    const updatedMembership = await db.userMembership.update({
      where: { id: activeRecord.id },
      data: { status: "cancelled" },
    });

    // Sync the UserMembershipForm status to cancelled as well
    await updateMembershipFormStatus(userId, membershipPlanId, "cancelled");

    return updatedMembership;
  } else {
    // 2b) Cancelling *after* the cycle → delete that one record
    const deleted = await db.userMembership.delete({
      where: { id: activeRecord.id },
    });

    // Set the form to inactive since the membership is completely deleted
    await updateMembershipFormStatus(userId, membershipPlanId, "inactive");

    // 3) Now that the membership is gone, recalc roleLevel:
    // level 2 if they passed orientation, else level 1
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

/**
 * Get all membership records for a specific user
 * @param userId The ID of the user whose memberships to retrieve
 * @returns Array of user membership records
 */
export async function getUserMemberships(userId: number) {
  return db.userMembership.findMany({
    where: { userId },
  });
}

/**
 * Get the most recent cancelled membership that hasn't expired yet
 * Used for resubscription functionality
 * @param userId The ID of the user to check for cancelled memberships
 * @returns Cancelled membership record with plan details, or null if none found
 */
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

/**
 * Get the user's currently active membership with plan details
 * @param userId The ID of the user whose active membership to retrieve
 * @returns Active membership record with plan details, or null if no active membership
 */
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

/**
 * Start the automated monthly membership billing and role level management cron job
 * This function handles roleLevels
 * Runs daily at midnight to process membership renewals, cancellations, and user role updates
 * Handles payment processing via Stripe and updates user role levels based on membership status
 */
export function startMonthlyMembershipCheck() {
  // Run every day at midnight (adjust the cron expression as needed)
  cron.schedule("29 13 * * *", async () => {
    console.log("Running monthly membership check...");

    try {
      const now = new Date();
      // Reminder window: send for charges occurring within the next 24 hours
      const reminderWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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

      // Send reminders for memberships that will be charged within the next 24 hours (only for active)
      const reminderCandidates = await db.userMembership.findMany({
        where: {
          status: "active",
          nextPaymentDate: { gt: now, lte: reminderWindowEnd },
        },
        include: { membershipPlan: true },
      });

      for (const membership of reminderCandidates) {
        const user = await db.user.findUnique({
          where: { id: membership.userId },
        });
        if (!user) continue;

        const baseAmount = Number(membership.membershipPlan.price);
        const gstPercentage = await getAdminSetting("gst_percentage", "5");
        const gstRate = parseFloat(gstPercentage) / 100;
        const chargeAmount = baseAmount * (1 + gstRate);

        try {
          await sendMembershipPaymentReminderEmail({
            userEmail: user.email,
            planTitle: membership.membershipPlan.title,
            nextPaymentDate: membership.nextPaymentDate,
            amountDue: chargeAmount,
            gstPercentage: parseFloat(gstPercentage),
          });
        } catch (emailErr) {
          console.error(
            `Failed to send membership payment reminder to user ${membership.userId}:`,
            emailErr
          );
        }
      }

      for (const membership of dueMemberships) {
        const user = await db.user.findUnique({
          where: { id: membership.userId },
        });
        if (!user) {
          console.error(`No user found for ID ${membership.userId}, skipping`);
          continue;
        }

        if (membership.status === "active") {
          // Calculate charge amount with GST
          const baseAmount = Number(membership.membershipPlan.price);

          // Get GST percentage from admin settings
          const gstPercentage = await getAdminSetting("gst_percentage", "5");
          const gstRate = parseFloat(gstPercentage) / 100;
          const chargeAmount = baseAmount * (1 + gstRate);

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
            // UPDATE THIS PART: Create payment intent with GST-inclusive amount and metadata
            const pi = await stripe.paymentIntents.create({
              amount: Math.round(chargeAmount * 100), // Now includes GST
              currency: "cad", // Changed from "usd" to match your other payments
              customer: savedPayment.stripeCustomerId,
              payment_method: savedPayment.stripePaymentMethodId,
              off_session: true,
              confirm: true,
              receipt_email: user.email,
              description: `${membership.membershipPlan.title} - Monthly Payment (Includes ${gstPercentage}% GST)`, // Add description
              metadata: {
                userId: String(membership.userId),
                membershipId: String(membership.id),
                planId: String(membership.membershipPlanId),
                // Add GST breakdown to metadata
                original_amount: baseAmount.toString(),
                gst_amount: (chargeAmount - baseAmount).toString(),
                total_with_gst: chargeAmount.toString(),
                gst_percentage: gstPercentage,
                payment_type: "monthly_membership",
              },
            });

            // Check if payment intent succeeded
            if (pi.status === "succeeded") {
              console.log(
                `✅ Payment intent succeeded for user ${
                  membership.userId
                }, charged $${chargeAmount.toFixed(2)} (includes ${gstPercentage}% GST)`
              );

              // Update the next payment date after successful payment
              await db.userMembership.update({
                where: { id: membership.id },
                data: {
                  nextPaymentDate: incrementMonth(membership.nextPaymentDate),
                  paymentIntentId: pi.id,
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

          // Sync the UserMembershipForm status to inactive as well
          await updateMembershipFormStatus(
            membership.userId,
            membership.membershipPlanId,
            "inactive"
          );
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

/**
 * Check if user already has a signed agreement for a membership plan
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 * @returns UserMembershipForm record or null if not found
 */
export async function getUserMembershipForm(
  userId: number,
  membershipPlanId: number
) {
  return await db.userMembershipForm.findFirst({
    where: {
      userId,
      membershipPlanId,
      status: { in: ["pending", "active"] }, // Find both pending and active forms
    },
    orderBy: {
      createdAt: "desc", // Get the most recent form
    },
  });
}

/**
 * Create a new membership agreement form with encrypted PDF
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 * @param signatureData The signature data (base64 image)
 * @returns Created UserMembershipForm record
 */
export async function createMembershipForm(
  userId: number,
  membershipPlanId: number,
  signatureData: string
) {
  // Get user info for PDF generation
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get membership plan to determine which PDF to generate
  const plan = await db.membershipPlan.findUnique({
    where: { id: membershipPlanId },
  });

  if (!plan) {
    throw new Error("Membership plan not found");
  }

  // Generate the appropriate encrypted PDF based on plan type
  const encryptedPDF = plan.needAdminPermission
    ? await generateSignedMembershipAgreement247(
        user.firstName,
        user.lastName,
        signatureData
      )
    : await generateSignedMembershipAgreement(
        user.firstName,
        user.lastName,
        signatureData
      );

  // Create the form with the encrypted PDF stored in agreementSignature field
  return await db.userMembershipForm.create({
    data: {
      userId,
      membershipPlanId,
      agreementSignature: encryptedPDF, // This stores the encrypted PDF
      status: "pending",
    },
  });
}

/**
 * Register membership subscription and create membership form after successful payment
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 * @param currentMembershipId The ID of current membership (for upgrades/downgrades)
 * @param isDowngrade Flag indicating if this is a downgrade
 * @param isResubscription Flag indicating if this is reactivating a cancelled membership
 * @param paymentIntentId Stripe payment intent ID
 * @param signatureData The agreement signature data (optional, for new subscriptions)
 * @returns Created or updated membership subscription record
 */
export async function registerMembershipSubscriptionWithForm(
  userId: number,
  membershipPlanId: number,
  currentMembershipId: number | null = null,
  isDowngrade: boolean = false,
  isResubscription: boolean = false,
  paymentIntentId?: string
) {
  // First create the membership subscription
  const subscription = await registerMembershipSubscription(
    userId,
    membershipPlanId,
    currentMembershipId,
    isDowngrade,
    isResubscription,
    paymentIntentId
  );

  // Activate the pending form (if it exists) and link it to the subscription
  await activateMembershipForm(userId, membershipPlanId, subscription.id);

  return subscription;
}

/**
 * Activate a pending membership form after successful payment
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 * @param userMembershipId The ID of the UserMembership to link
 * @returns Updated UserMembershipForm record
 */
export async function activateMembershipForm(
  userId: number,
  membershipPlanId: number,
  userMembershipId?: number
) {
  await db.userMembershipForm.updateMany({
    where: {
      userId,
      membershipPlanId,
      status: "active",
    },
    data: {
      status: "inactive",
    },
  });

  // Then activate the most recent pending form
  const mostRecentPending = await db.userMembershipForm.findFirst({
    where: {
      userId,
      membershipPlanId,
      status: "pending",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (mostRecentPending) {
    return await db.userMembershipForm.update({
      where: {
        id: mostRecentPending.id,
      },
      data: {
        status: "active",
        ...(userMembershipId ? { userMembershipId } : {}),
      },
    });
  }

  return null;
}
/**
 * Update UserMembershipForm status to match UserMembership status
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 * @param newStatus The new status to set
 * @param userMembershipId Optional UserMembership ID to link (only set when activating)
 */
export async function updateMembershipFormStatus(
  userId: number,
  membershipPlanId: number,
  newStatus: "active" | "pending" | "inactive" | "cancelled" | "ending",
  userMembershipId?: number
) {
  const updateData: any = {
    status: newStatus,
  };

  // Only set userMembershipId when explicitly provided (typically when activating)
  // This preserves the historical link when status changes to inactive/cancelled/ending
  if (userMembershipId !== undefined) {
    updateData.userMembershipId = userMembershipId;
  }

  return await db.userMembershipForm.updateMany({
    where: {
      userId,
      membershipPlanId,
      status: { in: ["pending", "active", "cancelled", "ending"] },
    },
    data: updateData,
  });
}

/**
 * Invalidate existing membership forms before creating a new one
 * @param userId The ID of the user
 * @param membershipPlanId The ID of the membership plan
 */
export async function invalidateExistingMembershipForms(
  userId: number,
  membershipPlanId: number
) {
  return await db.userMembershipForm.updateMany({
    where: {
      userId,
      membershipPlanId,
      status: { in: ["pending", "active"] },
    },
    data: {
      status: "inactive",
    },
  });
}

/**
 * Generates a digitally signed and encrypted membership agreement PDF
 *
 * @param firstName - The user's first name
 * @param lastName - The user's last name
 * @param signatureDataURL - Base64 encoded PNG signature image
 * @returns Promise<string> - AES encrypted base64 string of the signed PDF
 */
async function generateSignedMembershipAgreement(
  firstName: string,
  lastName: string,
  signatureDataURL: string
): Promise<string> {
  try {
    // Read the membership agreement PDF template
    const templatePath = path.join(
      process.cwd(),
      "public",
      "documents",
      "msyk-membership-agreement.pdf"
    );

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1]; // Last page has signature section

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const baseX = 75; // X position (left/right)

    // Add name
    const fullName = `${firstName} ${lastName}`;
    lastPage.drawText(fullName, {
      x: baseX,
      y: 200,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add signature
    if (signatureDataURL && signatureDataURL.startsWith("data:image/")) {
      try {
        const base64Data = signatureDataURL.split(",")[1];
        const signatureBytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );

        const signatureImage = await pdfDoc.embedPng(signatureBytes);

        lastPage.drawImage(signatureImage, {
          x: baseX * 2.5,
          y: 80,
        });
      } catch (imageError) {
        console.error("Error embedding signature image:", imageError);
      }
    }

    // Add date
    const currentDate = new Date().toLocaleDateString("en-US");
    lastPage.drawText(currentDate, {
      x: baseX,
      y: 114,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const encryptionKey = process.env.WAIVER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("WAIVER_ENCRYPTION_KEY environment variable must be set");
    }

    const encryptedPdf = CryptoJS.AES.encrypt(
      pdfBase64,
      encryptionKey
    ).toString();

    return encryptedPdf;
  } catch (error) {
    console.error("Error generating signed membership agreement:", error);
    throw new Error("Failed to generate signed membership agreement");
  }
}

/**
 * Generates a digitally signed and encrypted 24/7 membership agreement PDF
 *
 * @param firstName - The user's first name
 * @param lastName - The user's last name
 * @param signatureDataURL - Base64 encoded PNG signature image
 * @returns Promise<string> - AES encrypted base64 string of the signed PDF
 */
async function generateSignedMembershipAgreement247(
  firstName: string,
  lastName: string,
  signatureDataURL: string
): Promise<string> {
  try {
    // Read the 24/7 membership agreement PDF template
    const templatePath = path.join(
      process.cwd(),
      "public",
      "documents",
      "msyk-membership-agreement-24-7.pdf"
    );

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFLibDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1]; // Last page has signature section

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const baseX = 75; // X position (left/right)

    // Add name
    const fullName = `${firstName} ${lastName}`;
    lastPage.drawText(fullName, {
      x: baseX,
      y: 200,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add signature
    if (signatureDataURL && signatureDataURL.startsWith("data:image/")) {
      try {
        const base64Data = signatureDataURL.split(",")[1];
        const signatureBytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );

        const signatureImage = await pdfDoc.embedPng(signatureBytes);

        lastPage.drawImage(signatureImage, {
          x: baseX * 2.5,
          y: 80,
        });
      } catch (imageError) {
        console.error("Error embedding signature image:", imageError);
      }
    }

    // Add date
    const currentDate = new Date().toLocaleDateString("en-US");
    lastPage.drawText(currentDate, {
      x: baseX,
      y: 114,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    const encryptionKey = process.env.WAIVER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("WAIVER_ENCRYPTION_KEY environment variable must be set");
    }

    const encryptedPdf = CryptoJS.AES.encrypt(
      pdfBase64,
      encryptionKey
    ).toString();

    return encryptedPdf;
  } catch (error) {
    console.error("Error generating signed 24/7 membership agreement:", error);
    throw new Error("Failed to generate signed 24/7 membership agreement");
  }
}

/**
 * Decrypts an encrypted membership agreement PDF document back to its original binary format
 *
 * This function reverses the encryption process used by generateSignedMembershipAgreement(),
 * returning a Buffer containing the original PDF bytes that can be saved or displayed.
 *
 * @param encryptedData - AES encrypted string containing the PDF data (from generateSignedMembershipAgreement)
 * @returns Buffer - Binary PDF data ready for file writing or streaming
 *
 * @throws Error - Throws "Failed to decrypt membership agreement" if decryption fails or data is malformed
 *
 * @example
 * ```typescript
 * const pdfBuffer = decryptMembershipAgreement(form.agreementSignature);
 * fs.writeFileSync('signed-membership-agreement.pdf', pdfBuffer);
 * ```
 *
 * @security
 * - Uses same AES decryption key as generateSignedMembershipAgreement()
 * - Key retrieved from WAIVER_ENCRYPTION_KEY environment variable
 * - Falls back to default key if environment variable not set
 *
 * @dependencies
 * - Uses crypto-js for AES decryption
 * - Requires valid encrypted data format from generateSignedMembershipAgreement()
 *
 * @see generateSignedMembershipAgreement - For the encryption counterpart of this function
 * @see generateSignedMembershipAgreement247 - For the 24/7 membership encryption counterpart
 */
export function decryptMembershipAgreement(encryptedData: string): Buffer {
  try {
    const encryptionKey = process.env.WAIVER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("WAIVER_ENCRYPTION_KEY environment variable must be set");
    }
    const decryptedBase64 = CryptoJS.AES.decrypt(
      encryptedData,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    return Buffer.from(decryptedBase64, "base64");
  } catch (error) {
    console.error("Error decrypting membership agreement:", error);
    throw new Error("Failed to decrypt membership agreement");
  }
}
