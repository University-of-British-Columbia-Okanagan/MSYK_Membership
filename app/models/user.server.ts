import { db } from "../utils/db.server";
import bcrypt from "bcryptjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function getAllUsers() {
  return db.user.findMany();
}

export async function updateUserRole(userId: number, newRoleId: string) {
  return db.user.update({
    where: { id: userId },
    data: { roleLevel: Number(newRoleId) },
  });
}

/**
 * Updates the user's allowLevel4 flag and adjusts their roleLevel accordingly.
 * - If newAllow is true, set roleLevel to 4.
 * - If newAllow is false, then:
 *    * Check if the user has any passed orientations.
 *    * If yes, set roleLevel to 2.
 *    * Otherwise, set roleLevel to 1.
 */
export async function updateUserAllowLevel(userId: number, allow: boolean) {
  return db.user.update({
    where: { id: userId },
    data: { allowLevel4: allow },
  });
}

/**
 * Retrieves a user by their ID.
 *
 * @param userId - The ID of the user.
 * @returns The user record or null if not found.
 */
export async function getUserById(userId: number) {
  return db.user.findUnique({
    where: { id: userId },
  });
}

export type PaymentMethodData = {
  cardholderName: string;
  cardNumber: string; // Full card number (for processing only, we'll store just the last 4)
  expiry: string; // Format: "MM/YY"
  cvc: string; // For processing only, not stored
  billingAddressLine1: string;
  billingAddressLine2: string | null;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  isDefault: boolean;
  email?: string;
};

/**
 * Save payment method to the database and create Stripe customer/payment method
 */
export async function savePaymentMethod(
  userId: number,
  paymentData: PaymentMethodData
) {
  try {
    // First, check if the user already exists in our database
    let userPaymentInfo = await db.userPaymentInformation.findUnique({
      where: { userId },
    });

    // Get the user details for Stripe customer creation
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Parse card expiry
    const [expMonth, expYearShort] = paymentData.expiry.split("/");
    // Keep them as strings for the token call:
    const expMonthStr = expMonth; // e.g. "04"
    const expYearStr = `20${expYearShort}`; // e.g. "2026"

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;
    let stripePaymentMethodId: string;

    if (userPaymentInfo?.stripeCustomerId) {
      stripeCustomerId = userPaymentInfo.stripeCustomerId;
    } else {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: paymentData.email,
        name: `${user.firstName} ${user.lastName}`,
        address: {
          line1: paymentData.billingAddressLine1,
          line2: paymentData.billingAddressLine2 || undefined,
          city: paymentData.billingCity,
          state: paymentData.billingState,
          postal_code: paymentData.billingZip,
          country: paymentData.billingCountry,
        },
      });

      stripeCustomerId = customer.id;
    }

    // Create a payment method in Stripe
    // In a real implementation, you would use Elements/SetupIntent for secure tokenization
    // This is a simplified version for the example
    const token = await stripe.tokens.create({
      card: {
        number: paymentData.cardNumber.replace(/\s+/g, ""),
        exp_month: expMonthStr, // ← string
        exp_year: expYearStr, // ← string
        cvc: paymentData.cvc, // ← string
      },
    });

    // 2) Attach that token to the customer as a source
    const cardSource = await stripe.customers.createSource(stripeCustomerId, {
      source: token.id,
    });
    stripePaymentMethodId = (cardSource as Stripe.Card).id;

    // 3) Make it the default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: stripePaymentMethodId,
      },
    });

    // Extract the last 4 digits of the card number
    const cardLast4 = paymentData.cardNumber.replace(/\s+/g, "").slice(-4);

    // Create or update the UserPaymentInformation record
    if (userPaymentInfo) {
      userPaymentInfo = await db.userPaymentInformation.update({
        where: { userId },
        data: {
          stripeCustomerId,
          stripePaymentMethodId,
          cardholderName: paymentData.cardholderName,
          cardLast4,
          cardExpiry: paymentData.expiry,
          expMonth: parseInt(expMonth),
          expYear: parseInt(expYearStr),
          billingAddressLine1: paymentData.billingAddressLine1,
          billingAddressLine2: paymentData.billingAddressLine2,
          billingCity: paymentData.billingCity,
          billingState: paymentData.billingState,
          billingZip: paymentData.billingZip,
          billingCountry: paymentData.billingCountry,
          email: user.email,
          isDefault: paymentData.isDefault,
          updatedAt: new Date(),
        },
      });
    } else {
      userPaymentInfo = await db.userPaymentInformation.create({
        data: {
          userId,
          stripeCustomerId,
          stripePaymentMethodId,
          cardholderName: paymentData.cardholderName,
          cardLast4,
          cardExpiry: paymentData.expiry,
          expMonth: parseInt(expMonth),
          expYear: parseInt(expYearStr),
          billingAddressLine1: paymentData.billingAddressLine1,
          billingAddressLine2: paymentData.billingAddressLine2,
          billingCity: paymentData.billingCity,
          billingState: paymentData.billingState,
          billingZip: paymentData.billingZip,
          billingCountry: paymentData.billingCountry,
          email: user.email,
          isDefault: paymentData.isDefault,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return userPaymentInfo;
  } catch (error) {
    console.error("Error saving payment method:", error);
    throw error;
  }
}

/**
 * Get saved payment method for a user
 */
export async function getSavedPaymentMethod(userId: number) {
  try {
    const userPaymentInfo = await db.userPaymentInformation.findUnique({
      where: { userId },
    });

    if (!userPaymentInfo) {
      return null;
    }

    return {
      cardholderName: userPaymentInfo.cardholderName,
      cardLast4: userPaymentInfo.cardLast4,
      cardExpiry: userPaymentInfo.cardExpiry,
      email: userPaymentInfo.email,
      billingAddressLine1: userPaymentInfo.billingAddressLine1,
      billingAddressLine2: userPaymentInfo.billingAddressLine2,
      billingCity: userPaymentInfo.billingCity,
      billingState: userPaymentInfo.billingState,
      billingZip: userPaymentInfo.billingZip,
      billingCountry: userPaymentInfo.billingCountry,
      stripeCustomerId: userPaymentInfo.stripeCustomerId,
      stripePaymentMethodId: userPaymentInfo.stripePaymentMethodId,
    };
  } catch (error) {
    console.error("Error getting saved payment method:", error);
    throw error;
  }
}

/**
 * Charge a saved payment method
 */
export async function chargePaymentMethod({
  userId,
  amount,
  description,
  metadata = {},
}: {
  userId: number;
  amount: number;
  description: string;
  metadata?: Record<string, string>;
}) {
  const userPaymentInfo = await db.userPaymentInformation.findUnique({
    where: { userId },
  });

  if (
    !userPaymentInfo?.stripeCustomerId ||
    !userPaymentInfo?.stripePaymentMethodId
  ) {
    throw new Error("No payment method found for this user");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  try {
    // Create a payment intent and confirm it in one step
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: userPaymentInfo.stripeCustomerId,
      payment_method: userPaymentInfo.stripePaymentMethodId,
      off_session: true, // Important for saved payment methods
      confirm: true, // Confirm immediately
      description,
      receipt_email: user.email,
      metadata: {
        userId: userId.toString(),
        ...metadata,
      },
    });

    return {
      success: paymentIntent.status === "succeeded",
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error("Error charging payment method:", error);
    throw error;
  }
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(userId: number) {
  const userPaymentInfo = await db.userPaymentInformation.findUnique({
    where: { userId },
  });

  if (!userPaymentInfo) {
    throw new Error("No payment method found for this user");
  }

  // If it exists in Stripe, detach it
  if (userPaymentInfo.stripePaymentMethodId) {
    try {
      await stripe.paymentMethods.detach(userPaymentInfo.stripePaymentMethodId);
    } catch (error) {
      console.error("Error detaching payment method from Stripe:", error);
      // Continue with deletion even if Stripe detach fails
    }
  }

  // Delete from our database
  await db.userPaymentInformation.delete({
    where: { userId },
  });

  return { success: true };
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(userId: number) {
  let userPaymentInfo = await db.userPaymentInformation.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (userPaymentInfo?.stripeCustomerId) {
    // Verify the customer still exists in Stripe
    try {
      const customer = await stripe.customers.retrieve(
        userPaymentInfo.stripeCustomerId
      );
      if (!customer.deleted) {
        return userPaymentInfo.stripeCustomerId;
      }
    } catch (error) {
      console.error("Error retrieving Stripe customer:", error);
      // If customer not found, continue to create a new one
    }
  }

  // Get user details
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    metadata: {
      userId: userId.toString(),
    },
  });

  // Save the customer ID
  if (userPaymentInfo) {
    await db.userPaymentInformation.update({
      where: { userId },
      data: { stripeCustomerId: customer.id },
    });
  } else {
    await db.userPaymentInformation.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return customer.id;
}

export async function updateUserVolunteerStatus(
  userId: number,
  isVolunteer: boolean
) {
  if (isVolunteer) {
    // Check if user already has an active volunteer period
    const activeVolunteer = await db.volunteer.findFirst({
      where: {
        userId,
        volunteerEnd: null,
      },
    });

    // Only create new volunteer record if not already active
    if (!activeVolunteer) {
      return await db.volunteer.create({
        data: {
          userId,
          volunteerStart: new Date(),
        },
      });
    }
    return activeVolunteer;
  } else {
    // End the current volunteer period
    const activeVolunteer = await db.volunteer.findFirst({
      where: {
        userId,
        volunteerEnd: null,
      },
    });

    if (activeVolunteer) {
      return await db.volunteer.update({
        where: { id: activeVolunteer.id },
        data: {
          volunteerEnd: new Date(),
        },
      });
    }
  }
}

export async function getUserVolunteerHistory(userId: number) {
  return await db.volunteer.findMany({
    where: { userId },
    orderBy: { volunteerStart: "desc" },
  });
}

export async function getUserCurrentVolunteerStatus(userId: number) {
  const activeVolunteer = await db.volunteer.findFirst({
    where: {
      userId,
      volunteerEnd: null,
    },
  });
  return activeVolunteer !== null;
}

export async function getAllUsersWithVolunteerStatus() {
  const usersRaw = await getAllUsers();

  const users = await Promise.all(
    usersRaw.map(async (user) => {
      const activeVolunteer = await db.volunteer.findFirst({
        where: {
          userId: user.id,
          volunteerEnd: null,
        },
      });
      const volunteerHistory = await db.volunteer.findMany({
        where: { userId: user.id },
        orderBy: { volunteerStart: "desc" },
      });

      return {
        ...user,
        isVolunteer: activeVolunteer !== null,
        volunteerSince: activeVolunteer?.volunteerStart || null,
        volunteerHistory,
      };
    })
  );

  return users;
}
