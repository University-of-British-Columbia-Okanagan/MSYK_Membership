import { getRoleUser } from "~/utils/session.server";
import { bulkSyncToStripe } from "~/services/stripe-sync.server";
import { db } from "~/utils/db.server";
import { getAdminSetting } from "~/models/admin.server";
import { getOrCreateGstTaxRate } from "~/services/stripe-discounts.server";
import { endRecurringDiscountForUser } from "~/models/membership.server";

export async function action({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return new Response(JSON.stringify({ error: "Not authorized" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "bulkSync") {
    try {
      const result = await bulkSyncToStripe(false);
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (actionType === "clearAndResync") {
    try {
      const result = await bulkSyncToStripe(true);
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (actionType === "getSyncStatus") {
    try {
      const [
        totalWorkshops,
        syncedWorkshops,
        totalPlans,
        syncedPlans,
        totalEquipment,
        syncedEquipment,
      ] = await Promise.all([
        db.workshop.count(),
        db.workshop.count({ where: { stripeProductId: { not: null } } }),
        db.membershipPlan.count(),
        db.membershipPlan.count({ where: { stripeProductId: { not: null } } }),
        db.equipment.count(),
        db.equipment.count({ where: { stripeProductId: { not: null } } }),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          workshops: { total: totalWorkshops, synced: syncedWorkshops },
          membershipPlans: { total: totalPlans, synced: syncedPlans },
          equipment: { total: totalEquipment, synced: syncedEquipment },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (actionType === "getDiscountStatus") {
    try {
      const gstPercentage = await getAdminSetting("gst_percentage", "5");
      const taxRateId = await getOrCreateGstTaxRate(parseFloat(gstPercentage));

      const discounted = await db.userMembership.findMany({
        where: {
          stripeCouponId: { not: null },
          status: { in: ["active", "ending"] },
          // The mirrored columns are only refreshed when the member is next charged, so a
          // discount Stripe has already expired can linger here for a whole billing cycle.
          // Stripe's expiry is wall-clock, so a past date is unambiguous. Null means a
          // "forever" coupon, which never expires.
          OR: [{ discountEndsAt: null }, { discountEndsAt: { gt: new Date() } }],
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          membershipPlan: { select: { title: true } },
        },
        orderBy: { discountEndsAt: "asc" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          gst: { percentage: parseFloat(gstPercentage), taxRateId },
          discounts: discounted.map((row) => ({
            membershipId: row.id,
            userId: row.user.id,
            memberName: `${row.user.firstName} ${row.user.lastName}`.trim(),
            email: row.user.email,
            planTitle: row.membershipPlan.title,
            couponId: row.stripeCouponId,
            endsAt: row.discountEndsAt,
            status: row.status,
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (actionType === "endDiscount") {
    try {
      const targetUserId = Number(formData.get("userId"));
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing userId" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const cleared = await endRecurringDiscountForUser(targetUserId);
      return new Response(JSON.stringify({ success: true, cleared }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
