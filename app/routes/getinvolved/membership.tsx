//Link the membership plan to payment system in Stripe.
import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import type { Route } from "./+types/membership";
import MembershipCard from "@/components/ui/Get Involved/MembershipCard";
import { getMembershipPlans, deleteMembershipPlan } from "~/models/membership.server";
import { getRoleUser } from "~/utils/session.server";
import { NavLink, Link, redirect } from "react-router";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);

  const membershipPlans = await getMembershipPlans();
  const parsedPlans = membershipPlans.map((plan) => ({
    ...plan,
    feature: plan.feature
      ? Object.values(plan.feature).map((value) =>
          typeof value === "string" ? value : ""
        ) // Convert object values to an array of strings
      : [], // Handle null or undefined
  }));

  return { roleUser, membershipPlans: parsedPlans };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const planId = formData.get("planId");
  const confirmationDelete = formData.get("confirmationDelete");

  if (action === "delete") {
    try {
      const result = await deleteMembershipPlan(Number(planId));
      if (confirmationDelete !== "confirmed") {
        console.warn("Deletion was not confirmed.");
        return null; // Prevent deletion if not confirmed
      }
  

      if(result) {
        return redirect("/membership");
      }
      
    } catch (error) {
      console.error("Error deleting membership plan:", error);
    }
  }

  if (action === "edit") {
    return redirect(`/editmembershipplan/${planId}`)
  }

  return null;

}

export default function MembershipPage({ loaderData }: Route.ComponentProps) {
  const { roleUser, membershipPlans } = loaderData;

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Choose Your Membership Plan" />

      {/* Membership Plans */}
      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
          {/* Conditionally Render Buttons */}
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

          {/* Render Membership Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {membershipPlans.map((plan) => (
              <MembershipCard
                key={plan.id}
                title={plan.title}
                description={plan.description}
                price={plan.price}
                feature={plan.feature} // Pass JSON feature as props
                isAdmin={!!isAdmin}
                planId={plan.id}
              />
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
