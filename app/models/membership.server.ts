import { db } from "../utils/db.server";

export async function getMembershipPlans() {
    const membershipPlans = await db.membershipPlan.findMany();
    return membershipPlans;
}