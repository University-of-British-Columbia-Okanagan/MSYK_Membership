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
    const rawMemberships = await getUserMemberships(roleUser.userId);
    userMemberships = rawMemberships.map((m) => {
      const status = m.status === "cancelled" ? "cancelled" : "active";
      return {
        membershipPlanId: m.membershipPlanId,
        status,
      };
    });

    userRecord = await getUserById(roleUser.userId);
  }

  return { roleUser, membershipPlans: parsedPlans, userMemberships, userRecord };
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
  const { roleUser, membershipPlans, userMemberships, userRecord } = useLoaderData<{
    roleUser: any;
    membershipPlans: any[];
    userMemberships: UserMembershipData[];
    userRecord: {
      id: number;
      roleLevel: number;
      allowLevel4: boolean;
    } | null;
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
                />
              );
            })}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
