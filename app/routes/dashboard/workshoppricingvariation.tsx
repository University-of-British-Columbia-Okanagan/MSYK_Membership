import React, { useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/GuestSidebar";
import { getUser, getRoleUser } from "~/utils/session.server";
import { getWorkshopWithPriceVariations } from "~/models/workshop.server";
import type { Route } from "./+types/workshoppricingvariation";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const roleUser = await getRoleUser(request);
  const isAdmin = roleUser?.roleName === "Admin";

  const workshopId = Number(params.workshopId);
  if (isNaN(workshopId)) {
    throw new Response("Invalid workshop ID", { status: 400 });
  }

  const workshop = await getWorkshopWithPriceVariations(workshopId);

  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  return { workshop, user, isAdmin };
}

export default function WorkshopPricingVariation() {
  const { workshop, user, isAdmin } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const occurrenceId = searchParams.get("occurrenceId");
  const [selectedVariation, setSelectedVariation] = useState<number | null>(
    null
  );

  const handleContinue = () => {
    if ((!selectedVariation && selectedVariation !== 0) || !occurrenceId) {
      return;
    }
    if (selectedVariation === 0) {
      // User selected base price, go to payment without variation
      navigate(`/dashboard/payment/${workshop.id}/${occurrenceId}`);
    } else {
      // User selected a variation, include variation ID
      navigate(
        `/dashboard/payment/${workshop.id}/${occurrenceId}/${selectedVariation}`
      );
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {!user ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}

        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => navigate(`/dashboard/workshops/${workshop.id}`)}
                className="mb-4"
              >
                ← Back to Workshop
              </Button>

              <h1 className="text-3xl font-bold mb-2">{workshop.name}</h1>
              <p className="text-gray-600">Choose your workshop price option</p>
            </div>

            <div className="space-y-4">
              <div
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedVariation === 0
                    ? "border-yellow-500 bg-yellow-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedVariation(0)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="variation"
                    value={0}
                    checked={selectedVariation === 0}
                    onChange={() => setSelectedVariation(0)}
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-600">
                          ${workshop.price}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {workshop.priceVariations.map((variation) => (
                <div
                  key={variation.id}
                  className={`border rounded-lg p-6 cursor-pointer transition-all ${
                    selectedVariation === variation.id
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedVariation(variation.id)}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="variation"
                      value={variation.id}
                      checked={selectedVariation === variation.id}
                      onChange={() => setSelectedVariation(variation.id)}
                      className="mr-4"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {variation.name}
                          </h3>
                          <p className="text-gray-600 mt-2">
                            {variation.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-green-600">
                            ${variation.price}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <Button
                variant="outline"
                onClick={() => navigate(`/dashboard/workshops/${workshop.id}`)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={selectedVariation === null}
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
