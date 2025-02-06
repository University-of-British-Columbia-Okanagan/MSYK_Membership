//Link the membership plan to payment system in Stripe.
import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import type { Route } from "./+types/membership";
import MembershipCard from "@/components/ui/Get Involved/MembershipCard";
import { getMembershipPlans } from "~/models/membership.server";

export async function loader({ request }: { request: Request }) {
  const membershipPlans = await getMembershipPlans();
  const parsedPlans = membershipPlans.map((plan) => ({
    ...plan,
    feature: plan.feature
      ? Object.values(plan.feature).map((value) =>
          typeof value === "string" ? value : ""
        ) // Convert object values to an array of strings
      : [], // Handle null or undefined
  }));

  return parsedPlans;
}

export default function MembershipPage({ loaderData }: Route.ComponentProps) {
  const membershipPlans = loaderData;

  return (
    <main>
      {/* Hero Section */}
      <HeroSection title="Choose Your Membership Plan" />

      {/* Membership Plans */}
      <section className="bg-gray-900 py-16">
        <div className="container mx-auto px-4">
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
              />
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
