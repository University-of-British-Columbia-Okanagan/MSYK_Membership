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
    null
  );

  const handleContinue = () => {
    if (selectedVariation === null) {
      return;
    }

    // CHECK FOR CONNECT ID (MULTI-DAY):
    const connectId = searchParams.get("connectId");

    if (connectId) {
      // Multi-day workshop with variation
      if (selectedVariation === 0) {
        navigate(`/dashboard/payment/${workshop.id}/connect/${connectId}`);
      } else {
        navigate(
          `/dashboard/payment/${workshop.id}/connect/${connectId}/${selectedVariation}`
        );
      }
    } else if (occurrenceId) {
      // Single occurrence workflow
      if (selectedVariation === 0) {
        navigate(`/dashboard/payment/${workshop.id}/${occurrenceId}`);
      } else {
        navigate(
          `/dashboard/payment/${workshop.id}/${occurrenceId}/${selectedVariation}`
        );
      }
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
                Pricing Options
              </h3>
              <p className="text-blue-700 text-sm">
                Select your preferred pricing option. The{" "}
                <strong>Base Price</strong> is the standard workshop pricing,
                while the additional options may offer different features or
                pricing.
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
                        WORKSHOP FULL
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Base Price Option */}
              <div
                className={`border rounded-lg p-6 transition-all ${
                  capacityInfo &&
                  capacityInfo.totalRegistrations >=
                    capacityInfo.workshopCapacity
                    ? "opacity-50 cursor-not-allowed border-gray-300"
                    : selectedVariation === 0
                      ? "border-blue-500 bg-blue-50 cursor-pointer"
                      : "border-gray-200 hover:border-gray-300 cursor-pointer"
                }`}
                onClick={() => {
                  if (
                    !capacityInfo ||
                    capacityInfo.totalRegistrations <
                      capacityInfo.workshopCapacity
                  ) {
                    setSelectedVariation(0);
                  }
                }}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="variation"
                    value={0}
                    checked={selectedVariation === 0}
                    onChange={() => {
                      if (
                        !capacityInfo ||
                        capacityInfo.totalRegistrations <
                          capacityInfo.workshopCapacity
                      ) {
                        setSelectedVariation(0);
                      }
                    }}
                    disabled={
                      !!(
                        capacityInfo &&
                        capacityInfo.totalRegistrations >=
                          capacityInfo.workshopCapacity
                      )
                    }
                    className="mr-4"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold">Base Price</h3>
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                            STANDARD
                          </span>
                          {/* Workshop Full Badge */}
                          {capacityInfo &&
                            capacityInfo.totalRegistrations >=
                              capacityInfo.workshopCapacity && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                WORKSHOP FULL
                              </span>
                            )}
                        </div>
                        <p className="text-gray-600">{workshop.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-blue-600">
                          ${workshop.price}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Variations */}
              {workshop.priceVariations.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">
                    Alternative Pricing Options
                  </h4>
                  {workshop.priceVariations.map((variation) => {
                    const variationCapacity = capacityInfo?.variations?.find(
                      (v: any) => v.variationId === variation.id
                    );

                    // Check if workshop is full OR variation is full OR variation is cancelled
                    const isWorkshopFull =
                      capacityInfo &&
                      capacityInfo.totalRegistrations >=
                        capacityInfo.workshopCapacity;
                    const isVariationFull =
                      variationCapacity && !variationCapacity.hasCapacity;
                    const isVariationCancelled =
                      variation.status === "cancelled";
                    const isDisabled =
                      isWorkshopFull || isVariationFull || isVariationCancelled;

                    return (
                      <div
                        key={variation.id}
                        className={`border rounded-lg p-6 transition-all mb-4 ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed border-gray-300"
                            : selectedVariation === variation.id
                              ? "border-blue-500 bg-blue-50 cursor-pointer"
                              : "border-gray-200 hover:border-gray-300 cursor-pointer"
                        }`}
                        onClick={() => {
                          if (!isDisabled && !isVariationCancelled) {
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
                              if (!isDisabled && !isVariationCancelled) {
                                setSelectedVariation(variation.id);
                              }
                            }}
                            disabled={isDisabled}
                            className="mr-4"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="text-xl font-semibold">
                                    {variation.name}
                                  </h3>
                                  {/* Capacity Display */}
                                  {variationCapacity && (
                                    <span className="text-sm text-gray-600">
                                      ({variationCapacity.registrations}/
                                      {variationCapacity.capacity} registered)
                                    </span>
                                  )}
                                  {/* Status Badges */}
                                  {isVariationCancelled ? (
                                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                      CANCELLED
                                    </span>
                                  ) : isWorkshopFull ? (
                                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                      WORKSHOP FULL
                                    </span>
                                  ) : isVariationFull ? (
                                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                      FULL
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-gray-600">
                                  {variation.description}
                                </p>
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
              )}
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
