// app/utils/profile.server.ts
import { db } from "../utils/db.server";
import { getUserId } from "~/utils/session.server";
import { redirect } from "@remix-run/node";

export type UserProfileData = {
    name: string;
    avatarUrl: string | null;
    email: string;
    membershipTitle: string;
    membershipType: string;
    nextBillingDate: string | null;
    cardLast4: string;
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
  
    const payment = await db.userMembershipPayment.findFirst({
      where: { userId: parseInt(userId) },
      orderBy: { date: "desc" },
      select: { cardNumber: true, date: true },
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
      cardLast4: payment?.cardNumber.slice(-4) ?? "N/A",
    };
  }
  