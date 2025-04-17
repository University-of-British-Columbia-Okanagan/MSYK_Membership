import { db } from "../utils/db.server";
import bcrypt from "bcryptjs";

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

export async function saveUserMembershipPayment(data: {
  userId: number;
  membershipPlanId: number;
  email: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  cardholderName: string;
  region: string;
  postalCode: string;
}) {
  const saltRounds = 10;
  return db.userMembershipPayment.create({
    data: {
      userId: data.userId,
      membershipPlanId: data.membershipPlanId,
      date: new Date(),
      email:          bcrypt.hashSync(data.email,          saltRounds),
      cardNumber:     bcrypt.hashSync(data.cardNumber,     saltRounds),
      expMonth:       bcrypt.hashSync(String(data.expMonth), saltRounds),
      expYear:        bcrypt.hashSync(String(data.expYear),  saltRounds),
      cvc:            bcrypt.hashSync(data.cvc,            saltRounds),
      cardholderName: bcrypt.hashSync(data.cardholderName, saltRounds),
      region:         bcrypt.hashSync(data.region,         saltRounds),
      postalCode:     bcrypt.hashSync(data.postalCode,     saltRounds),
    },
  });
}

export async function getLatestUserPaymentInfo(userId: number) {
  return db.userMembershipPayment.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
  });
}