import Stripe from "stripe";
import { db } from "~/utils/db.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export async function syncWorkshopToStripe(workshopId: number): Promise<void> {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
    });
    if (!workshop) return;

    if (workshop.stripeProductId) {
      // Update existing product
      await stripe.products.update(workshop.stripeProductId, {
        name: workshop.name,
        description: workshop.description || undefined,
        metadata: {
          portal_type: "workshop",
          portal_id: String(workshopId),
        },
      });
    } else {
      // Create new product
      const product = await stripe.products.create({
        name: workshop.name,
        description: workshop.description || undefined,
        metadata: {
          portal_type: "workshop",
          portal_id: String(workshopId),
        },
      });
      await db.workshop.update({
        where: { id: workshopId },
        data: { stripeProductId: product.id },
      });
    }
  } catch (error) {
    console.error(`[stripe-sync] Failed to sync workshop ${workshopId}:`, error);
  }
}

export async function syncMembershipPlanToStripe(planId: number): Promise<void> {
  try {
    const plan = await db.membershipPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) return;

    if (plan.stripeProductId) {
      await stripe.products.update(plan.stripeProductId, {
        name: plan.title,
        description: plan.description || undefined,
        metadata: {
          portal_type: "membership",
          portal_id: String(planId),
        },
      });
    } else {
      const product = await stripe.products.create({
        name: plan.title,
        description: plan.description || undefined,
        metadata: {
          portal_type: "membership",
          portal_id: String(planId),
        },
      });
      await db.membershipPlan.update({
        where: { id: planId },
        data: { stripeProductId: product.id },
      });
    }
  } catch (error) {
    console.error(`[stripe-sync] Failed to sync membership plan ${planId}:`, error);
  }
}

export async function syncEquipmentToStripe(equipmentId: number): Promise<void> {
  try {
    const equipment = await db.equipment.findUnique({
      where: { id: equipmentId },
    });
    if (!equipment) return;

    if (equipment.stripeProductId) {
      await stripe.products.update(equipment.stripeProductId, {
        name: equipment.name,
        description: equipment.description || undefined,
        metadata: {
          portal_type: "equipment",
          portal_id: String(equipmentId),
        },
      });
    } else {
      const product = await stripe.products.create({
        name: equipment.name,
        description: equipment.description || undefined,
        metadata: {
          portal_type: "equipment",
          portal_id: String(equipmentId),
        },
      });
      await db.equipment.update({
        where: { id: equipmentId },
        data: { stripeProductId: product.id },
      });
    }
  } catch (error) {
    console.error(`[stripe-sync] Failed to sync equipment ${equipmentId}:`, error);
  }
}

export async function archiveStripeProduct(stripeProductId: string): Promise<void> {
  try {
    await stripe.products.update(stripeProductId, { active: false });
  } catch (error) {
    console.error(`[stripe-sync] Failed to archive product ${stripeProductId}:`, error);
  }
}

export interface BulkSyncResult {
  workshopsSynced: number;
  membershipPlansSynced: number;
  equipmentSynced: number;
  errors: string[];
}

export async function bulkSyncToStripe(clearExisting = false): Promise<BulkSyncResult> {
  const result: BulkSyncResult = {
    workshopsSynced: 0,
    membershipPlansSynced: 0,
    equipmentSynced: 0,
    errors: [],
  };

  // If clearing existing IDs, reset all stripeProductId fields first
  if (clearExisting) {
    await db.workshop.updateMany({ data: { stripeProductId: null } });
    await db.membershipPlan.updateMany({ data: { stripeProductId: null } });
    await db.equipment.updateMany({ data: { stripeProductId: null } });
  }

  // Sync workshops (skip those already synced unless clearing)
  const workshops = await db.workshop.findMany({
    where: clearExisting ? {} : { stripeProductId: null },
  });
  for (const workshop of workshops) {
    try {
      const product = await stripe.products.create({
        name: workshop.name,
        description: workshop.description || undefined,
        metadata: {
          portal_type: "workshop",
          portal_id: String(workshop.id),
        },
      });
      await db.workshop.update({
        where: { id: workshop.id },
        data: { stripeProductId: product.id },
      });
      result.workshopsSynced++;
    } catch (error: any) {
      result.errors.push(`Workshop "${workshop.name}" (ID: ${workshop.id}): ${error.message}`);
    }
  }

  // Sync membership plans
  const plans = await db.membershipPlan.findMany({
    where: clearExisting ? {} : { stripeProductId: null },
  });
  for (const plan of plans) {
    try {
      const product = await stripe.products.create({
        name: plan.title,
        description: plan.description || undefined,
        metadata: {
          portal_type: "membership",
          portal_id: String(plan.id),
        },
      });
      await db.membershipPlan.update({
        where: { id: plan.id },
        data: { stripeProductId: product.id },
      });
      result.membershipPlansSynced++;
    } catch (error: any) {
      result.errors.push(`Membership plan "${plan.title}" (ID: ${plan.id}): ${error.message}`);
    }
  }

  // Sync equipment
  const equipments = await db.equipment.findMany({
    where: clearExisting ? {} : { stripeProductId: null },
  });
  for (const equipment of equipments) {
    try {
      const product = await stripe.products.create({
        name: equipment.name,
        description: equipment.description || undefined,
        metadata: {
          portal_type: "equipment",
          portal_id: String(equipment.id),
        },
      });
      await db.equipment.update({
        where: { id: equipment.id },
        data: { stripeProductId: product.id },
      });
      result.equipmentSynced++;
    } catch (error: any) {
      result.errors.push(`Equipment "${equipment.name}" (ID: ${equipment.id}): ${error.message}`);
    }
  }

  return result;
}
