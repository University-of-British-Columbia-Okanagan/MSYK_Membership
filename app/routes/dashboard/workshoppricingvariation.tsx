import { useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";
import { getUser, getRoleUser } from "~/utils/session.server";
import {
  getWorkshopWithPriceVariations,
  getWorkshopRegistrationCounts,
  getMultiDayWorkshopRegistrationCounts,
} from "~/models/workshop.server";
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

  // Get capacity information
  const url = new URL(request.url);
  const occurrenceId = url.searchParams.get("occurrenceId");
  const connectId = url.searchParams.get("connectId");

  let capacityInfo = null;

  if (connectId) {
    // Multi-day workshop capacity
    capacityInfo = await getMultiDayWorkshopRegistrationCounts(
      workshopId,
      Number(connectId)
    );
  } else if (occurrenceId) {
    // Regular workshop capacity
    capacityInfo = await getWorkshopRegistrationCounts(
      workshopId,
      Number(occurrenceId)
    );
  }

  return { workshop, user, isAdmin, capacityInfo };
}
export default function WorkshopPricingVariation() {
  const { workshop, user, isAdmin, capacityInfo } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const occurrenceId = searchParams.get("occurrenceId");
  const [selectedVariation, setSelectedVariation] = useState<number | null>(
    workshop.priceVariations.length > 0 ? workshop.priceVariations[0].id : null
  );

  const handleContinue = () => {
    if (selectedVariation === null) {
      return;
    }

    // CHECK FOR CONNECT ID (MULTI-DAY):
    const connectId = searchParams.get("connectId");

    if (connectId) {
      // Multi-day workshop with variation - always use variation ID
      navigate(
        `/dashboard/payment/${workshop.id}/connect/${connectId}/${selectedVariation}`
      );
    } else if (occurrenceId) {
      // Single occurrence workflow - always use variation ID
      navigate(
        `/dashboard/payment/${workshop.id}/${occurrenceId}/${selectedVariation}`
      );
    } else {
      console.error("Missing both connectId and occurrenceId");
      // Could show an error message to the user here
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

            {/* Informational Header */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Choose Your Pricing Option
              </h3>
              <p className="text-blue-700 text-sm">
                Select your preferred pricing option for this workshop. Each
                option may different include features. Refer to the description
                of each option
              </p>

              {/* Workshop Capacity Display */}
              {capacityInfo && (
                <div className="mt-3 pt-3 border-t border-blue-300">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-blue-700">
                      <strong>Workshop Capacity:</strong>{" "}
                      {capacityInfo.totalRegistrations}/
                      {capacityInfo.workshopCapacity} registered
                    </div>
                    {capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                        Workshop Full
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* All Pricing Options Combined */}
              {workshop.priceVariations.map((variation, index) => {
                const variationCapacityInfo = capacityInfo?.variations?.find(
                  (v) => v.variationId === variation.id
                );
                const isVariationFull = variationCapacityInfo
                  ? variationCapacityInfo.registrations >=
                    variationCapacityInfo.capacity
                  : false;

                return (
                  <div
                    key={variation.id}
                    className={`border rounded-lg p-6 transition-all ${
                      isVariationFull
                        ? "opacity-50 cursor-not-allowed border-gray-300"
                        : selectedVariation === variation.id
                          ? "border-blue-500 bg-blue-50 cursor-pointer"
                          : "border-gray-200 hover:border-gray-300 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!isVariationFull) {
                        setSelectedVariation(variation.id);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="variation"
                        value={variation.id}
                        checked={selectedVariation === variation.id}
                        onChange={() => {
                          if (!isVariationFull) {
                            setSelectedVariation(variation.id);
                          }
                        }}
                        disabled={isVariationFull}
                        className="mr-4"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold">
                                {variation.name}
                              </h3>
                              {index === 0 && (
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                  Standard
                                </span>
                              )}
                              {isVariationFull && (
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                  Full
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600">
                              {variation.description}
                            </p>
                            {variationCapacityInfo && (
                              <p className="text-sm text-gray-500 mt-1">
                                {variationCapacityInfo.registrations}/
                                {variationCapacityInfo.capacity} registered
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-blue-600">
                              ${variation.price}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-8">
              <Button
                variant="outline"
                onClick={() => navigate(`/dashboard/workshops/${workshop.id}`)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={
                  selectedVariation === null ||
                  !!(
                    capacityInfo &&
                    capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity
                  )
                }
                className={`${
                  selectedVariation === null ||
                  (capacityInfo &&
                    capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-yellow-500 hover:bg-yellow-600"
                } text-white px-6 py-2 rounded-lg`}
              >
                {capacityInfo &&
                capacityInfo.totalRegistrations >= capacityInfo.workshopCapacity
                  ? "Workshop Full"
                  : "Continue to Payment"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
