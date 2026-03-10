import { getRoleUser } from "~/utils/session.server";
import { bulkSyncToStripe } from "~/services/stripe-sync.server";
import { db } from "~/utils/db.server";

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

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}
