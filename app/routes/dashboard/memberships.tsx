import HeroSection from "@/components/ui/HeroSection";
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

// Import a helper to fetch the full user record
import { getUserById } from "~/models/user.server";

// Define a TypeScript type that matches the union
type MembershipStatus = "active" | "cancelled";

type UserMembershipData = {
  membershipPlanId: number;
  status: MembershipStatus;
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
    // 1) Get raw membership records (status is just string).
    const rawMemberships = await getUserMemberships(roleUser.userId);
    // rawMemberships might return objects like { membershipPlanId: number, status: string, ... }

    // 2) Convert raw status (string) to the union type ("active" | "cancelled").
    userMemberships = rawMemberships.map((m) => {
      // If you're sure it can only be "active" or "cancelled", you can just cast:
      // return { membershipPlanId: m.membershipPlanId, status: m.status as MembershipStatus };

      // Or do a safer check:
      const status = m.status === "cancelled" ? "cancelled" : "active";
      return {
        membershipPlanId: m.membershipPlanId,
        status,
      };
    });

    // Fetch the full user record (includes roleLevel, allowLevel4, etc.)
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

  // Cancel Membership
  if (action === "cancelMembership") {
    const roleUser = await getRoleUser(request);
    if (!roleUser?.userId) {
      // Not logged in or no user found
      return null;
    }

    if (planId) {
      await cancelMembership(roleUser.userId, Number(planId));
    }
    return redirect("/memberships");
  }

  // Delete membership plan (admin only)
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

  // Edit membership plan
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

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <main>
      <HeroSection title="Choose Your Membership Plan" />

      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          {isAdmin && (
            <div className="flex justify-center items-center space-x-4 mb-6">
              <Link to="/addmembershipplan">
                <button className="bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                  Add
                </button>
              </Link>
            </div>
          )}

          <h2 className="text-white text-center text-3xl font-semibold mb-10">
            Choose your Membership Plan
          </h2>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {membershipPlans.map((plan) => {
              // For each plan, find the user membership record if it exists.
              const membership = userMemberships.find(
                (m) => m.membershipPlanId === plan.id
              );

              // isSubscribed is true if there's a membership record for this plan.
              const isSubscribed = Boolean(membership);

              // membershipStatus can be "active" or "cancelled" if membership is found.
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
                />
              );
            })}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
