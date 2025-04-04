import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import Footer from "@/components/ui/Home/Footer";
import MembershipCard from "~/components/ui/Dashboard/MembershipCard";
import {
  getMembershipPlans,
  deleteMembershipPlan,
  getUserMemberships,
  cancelMembership,
} from "~/models/membership.server";
import { getRoleUser } from "~/utils/session.server";
import { Link, redirect, useLoaderData } from "react-router";
import { getUserById } from "~/models/user.server";

// Define a TypeScript type that matches the union
type MembershipStatus = "active" | "cancelled" | "inactive";

type UserMembershipData = {
  membershipPlanId: number;
  status: MembershipStatus;
  nextPaymentDate?: Date;
};

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const membershipPlans = await getMembershipPlans();
  const parsedPlans = membershipPlans.map((plan) => ({
    ...plan,
    feature: plan.feature
      ? Object.values(plan.feature).map((value) =>
          typeof value === "string" ? value : ""
        )
      : [],
  }));

  let userMemberships: UserMembershipData[] = [];
  let userRecord: any = null;

  if (roleUser?.userId) {
    const rawMemberships = await getUserMemberships(roleUser.userId);
    // Convert raw status to our union type. If the status is not "active" or "cancelled", mark it as "inactive".
    userMemberships = rawMemberships.map((m) => {
      // If status is "ending", treat it as "inactive" for UI.
      // That way, your MembershipCard will see membershipStatus = "inactive"
      // and (if nextPaymentDate is in the future) will show a disabled button.
      let status: MembershipStatus;
      if (m.status === "cancelled") {
        status = "cancelled";
      } else if (m.status === "active") {
        status = "active";
      } else if (m.status === "ending") {
        // Treat "ending" as "inactive" so the UI doesn't say "already subscribed."
        status = "inactive";
      } else {
        status = "inactive";
      }
    
      return {
        membershipPlanId: m.membershipPlanId,
        status,
        nextPaymentDate: m.nextPaymentDate,
      };
    });
  
    // Fetch the full user record...
    userRecord = await getUserById(roleUser.userId);
  }

  const hasCancelledSubscription = userMemberships.some(
    (m) => m.status === "cancelled"
  );

  // NEW: Add a flag to check if the user has any active membership.
  const hasActiveSubscription = userMemberships.some(
    (m) => m.status === "active"
  );

  let highestActivePrice = 0;
  if (userMemberships.length > 0) {
    const activeMemberships = userMemberships.filter(
      (m) => m.status === "active"
    );
    for (const am of activeMemberships) {
      const plan = parsedPlans.find((p) => p.id === am.membershipPlanId);
      if (plan && plan.price > highestActivePrice) {
        highestActivePrice = plan.price;
      }
    }
  }

  let highestCanceledPrice = 0;
  const canceledMemberships = userMemberships.filter(
    (m) => m.status === "cancelled"
  );
  for (const cm of canceledMemberships) {
    const plan = parsedPlans.find((p) => p.id === cm.membershipPlanId);
    if (plan && plan.price > highestCanceledPrice) {
      highestCanceledPrice = plan.price;
    }
  }

  return {
    roleUser,
    membershipPlans: parsedPlans,
    userMemberships,
    userRecord,
    hasCancelledSubscription,
    hasActiveSubscription,
    highestActivePrice,
    highestCanceledPrice,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const planId = formData.get("planId");
  const confirmationDelete = formData.get("confirmationDelete");

  if (action === "cancelMembership") {
    const roleUser = await getRoleUser(request);
    if (!roleUser?.userId) return null;
    if (planId) {
      await cancelMembership(roleUser.userId, Number(planId));
    }
    return redirect("/memberships");
  }

  if (action === "delete") {
    try {
      const result = await deleteMembershipPlan(Number(planId));
      if (confirmationDelete !== "confirmed") {
        console.warn("Deletion was not confirmed.");
        return null;
      }

      if (result) {
        return redirect("/membership");
      }
    } catch (error) {
      console.error("Error deleting membership plan:", error);
    }
  }

  if (action === "edit") {
    return redirect(`/editmembershipplan/${planId}`);
  }

  return null;
}

export default function MembershipPage() {
  const {
    roleUser,
    membershipPlans,
    userMemberships,
    userRecord,
    hasCancelledSubscription,
    hasActiveSubscription,
    highestActivePrice,
    highestCanceledPrice,
  } = useLoaderData<{
    roleUser: any;
    membershipPlans: any[];
    userMemberships: UserMembershipData[];
    userRecord: {
      id: number;
      roleLevel: number;
      allowLevel4: boolean;
    } | null;
    hasCancelledSubscription: boolean;
    hasActiveSubscription: boolean;
    highestActivePrice: number;
    highestCanceledPrice: number;
  }>();

  const isAdmin = roleUser?.roleId === 2 && roleUser.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main content area */}
        <main className="flex-1 px-6 py-10 bg-white">
          {isAdmin && (
            <div className="flex justify-end mb-6">
              <Link to="/addmembershipplan">
                <button className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                  Add Membership Plan
                </button>
              </Link>
            </div>
          )}

          <h2 className="text-3xl font-bold text-center mb-10">
            Choose your Membership Plan
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {membershipPlans.map((plan) => {
              const membership = userMemberships.find(
                (m) => m.membershipPlanId === plan.id
              );
              const isSubscribed = Boolean(membership);
              const membershipStatus = membership?.status;

              return (
                <MembershipCard
                  key={plan.id}
                  title={plan.title}
                  description={plan.description}
                  price={plan.price}
                  feature={plan.feature}
                  isAdmin={!!isAdmin}
                  planId={plan.id}
                  isSubscribed={isSubscribed}
                  membershipStatus={membershipStatus}
                  userRecord={userRecord}
                  hasActiveSubscription={hasActiveSubscription}
                  hasCancelledSubscription={hasCancelledSubscription}
                  highestActivePrice={highestActivePrice}
                  highestCanceledPrice={highestCanceledPrice}
                  nextPaymentDate={membership?.nextPaymentDate}
                />
              );
            })}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
