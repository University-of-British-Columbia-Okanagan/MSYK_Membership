import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminSidebar from "~/components/ui/Dashboard/adminsidebar";
import MembershipCard from "~/components/ui/Dashboard/MembershipCard";
import {
  getMembershipPlans,
  deleteMembershipPlan,
  getUserMemberships,
  cancelMembership,
  getMembershipPlanById,
} from "~/models/membership.server";
import { getUser } from "~/utils/session.server";
import { sendMembershipCancellationEmail, checkPaymentMethodStatus } from "~/utils/email.server";
import { getRoleUser } from "~/utils/session.server";
import { Link, redirect, useLoaderData } from "react-router";
import { getUserById } from "~/models/user.server";
import { PlusCircle, Ban } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { logger } from "~/logging/logger";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";

// Define a TypeScript type that matches the union
type MembershipStatus = "active" | "cancelled" | "inactive";

type UserMembershipData = {
  id: number;
  membershipPlanId: number;
  status: MembershipStatus;
  nextPaymentDate?: Date;
};

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const membershipPlans = await getMembershipPlans();
  const parsedPlans = membershipPlans.map((plan) => ({
    ...plan,
    needAdminPermission: plan.needAdminPermission,
    feature: plan.feature
      ? Object.values(plan.feature).map((value) =>
          typeof value === "string" ? value : ""
        )
      : [],
  }));

  let userMemberships: UserMembershipData[] = [];
  let userRecord: any = null;

  // Only fetch user-specific data if logged in
  if (roleUser?.userId) {
    const rawMemberships = await getUserMemberships(roleUser.userId);
    rawMemberships.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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
        id: m.id,
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

  // Add a flag to check if the user has any active membership.
  const hasActiveSubscription = userMemberships.some(
    (m) => m.status === "active"
  );

  const isMembershipRevoked = userRecord?.membershipStatus === "revoked";

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
    isMembershipRevoked,
    membershipRevokedReason: userRecord?.membershipRevokedReason ?? null,
    membershipRevokedAt: userRecord?.membershipRevokedAt ?? null,
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
      const result = await cancelMembership(roleUser.userId, Number(planId));
      try {
        const plan = await getMembershipPlanById(Number(planId));
        const user = await getUser(request);
        const needsPaymentMethod = await checkPaymentMethodStatus(roleUser.userId);
        await sendMembershipCancellationEmail({
          userEmail: user!.email!,
          planTitle: plan?.title || "Membership",
          accessUntil:
            result &&
            (result as any).status === "cancelled" &&
            (result as any).nextPaymentDate
              ? new Date((result as any).nextPaymentDate)
              : null,
          needsPaymentMethod,
        });
      } catch {}
      logger.info(
        `[User: ${
          roleUser?.userId ?? "unknown"
        }] Membership for plan ${planId} cancelled successfully.`,
        { url: request.url }
      );
    }
    return redirect("/dashboard/memberships");
  }

  if (action === "delete") {
    try {
      const roleUser = await getRoleUser(request);
      if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
        throw new Response("Not Authorized", { status: 419 });
      }
      const result = await deleteMembershipPlan(Number(planId));
      if (confirmationDelete !== "confirmed") {
        logger.warn(
          `Deletion of membership plan was not confirmed. Plan id ${planId}`,
          { url: request.url }
        );
        return null;
      }

      if (result) {
        return redirect("/dashboard/memberships");
      }
    } catch (error) {
      logger.error(`Error deleting membership plan: ${error}`, {
        url: request.url,
      });
    }
  }

  if (action === "edit") {
    return redirect(`/dashboard/editmembershipplan/${planId}`);
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
    isMembershipRevoked,
    membershipRevokedReason,
    membershipRevokedAt,
  } = useLoaderData<{
    roleUser: any;
    membershipPlans: any[];
    userMemberships: UserMembershipData[];
    userRecord: {
      id: number;
      roleLevel: number;
      allowLevel4: boolean;
      membershipStatus?: "active" | "revoked";
      membershipRevokedReason?: string | null;
      membershipRevokedAt?: string | null;
    } | null;
    hasCancelledSubscription: boolean;
    hasActiveSubscription: boolean;
    highestActivePrice: number;
    highestCanceledPrice: number;
    isMembershipRevoked: boolean;
    membershipRevokedReason: string | null;
    membershipRevokedAt: Date | null;
  }>();

  const isAdmin =
    roleUser?.roleId === 2 && roleUser.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {/* Sidebar */}
        {isGuest ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminSidebar />
        ) : (
          <AppSidebar />
        )}

        {/* Main content area */}
        <main className="flex-1 px-6 py-10 bg-white">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 mb-6 md:hidden">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">Memberships</h1>
          </div>
          {isAdmin && (
            <div className="flex justify-end mb-6">
              <Link to="/dashboard/addmembershipplan">
                <button className="bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition flex items-center space-x-2">
                  <PlusCircle className="w-5 h-5" />
                  <span>Add Membership Plan</span>
                </button>
              </Link>
            </div>
          )}

          <h2 className="text-3xl font-bold text-center mb-10">
            Choose your Membership Plan
          </h2>

          {isMembershipRevoked && (
            <Alert
              variant="destructive"
              className="max-w-4xl mx-auto mb-8 bg-red-50 border-red-200"
            >
              <Ban className="h-5 w-5" />
              <AlertTitle className="text-red-900 font-semibold text-lg">
                Membership Access Revoked
              </AlertTitle>
              <AlertDescription className="text-red-800 mt-2">
                <p className="mb-4 text-base">
                  Your membership access has been revoked by an administrator.
                  You cannot subscribe to new memberships until this restriction
                  is lifted.
                </p>

                {(membershipRevokedReason || membershipRevokedAt) && (
                  <div className="bg-white/60 rounded-md p-4 border border-red-100 text-sm space-y-3 shadow-sm">
                    {membershipRevokedReason && (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="font-bold text-red-900 uppercase tracking-wide text-xs mt-0.5 min-w-[60px]">
                          Reason
                        </span>
                        <span className="text-red-950 font-medium">
                          {membershipRevokedReason}
                        </span>
                      </div>
                    )}
                    {membershipRevokedAt && (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                        <span className="font-bold text-red-900 uppercase tracking-wide text-xs mt-0.5 min-w-[60px]">
                          Date
                        </span>
                        <span className="text-red-950">
                          {membershipRevokedAt.toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="mt-4 text-sm font-medium text-red-700">
                  If you have questions, please contact Makerspace staff for
                  assistance.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-6 justify-center items-stretch">
            {membershipPlans.map((plan) => {
              // Find the most recent membership for this plan, prioritizing active status
              const allMembershipsForPlan = userMemberships.filter(
                (m) => m.membershipPlanId === plan.id
              );

              // Prioritize active memberships, then cancelled, then inactive
              const membership =
                allMembershipsForPlan.find((m) => m.status === "active") ||
                allMembershipsForPlan.find((m) => m.status === "cancelled") ||
                allMembershipsForPlan.find((m) => m.status === "inactive") ||
                allMembershipsForPlan[0]; // fallback to first if none match

              const membershipStatus = membership?.status;

              return (
                <MembershipCard
                  key={plan.id}
                  title={plan.title}
                  description={plan.description}
                  price={plan.price}
                  price3Months={plan.price3Months}
                  price6Months={plan.price6Months}
                  priceYearly={plan.priceYearly}
                  feature={plan.feature}
                  isAdmin={!!isAdmin}
                  planId={plan.id}
                  needAdminPermission={plan.needAdminPermission}
                  membershipStatus={membershipStatus}
                  userRecord={userRecord}
                  hasActiveSubscription={hasActiveSubscription}
                  hasCancelledSubscription={hasCancelledSubscription}
                  highestActivePrice={highestActivePrice}
                  nextPaymentDate={membership?.nextPaymentDate}
                  membershipRecordId={membership?.id}
                  roleUser={roleUser}
                  isCurrentlyActivePlan={membershipStatus === "active"}
                  isMembershipRevoked={isMembershipRevoked}
                  membershipRevokedReason={membershipRevokedReason}
                  membershipRevokedAt={membershipRevokedAt}
                />
              );
            })}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
