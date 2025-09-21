import { useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  redirect,
} from "react-router";
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
  getWorkshopOccurrence,
  getWorkshopOccurrencesByConnectId,
} from "~/models/workshop.server";
import type { Route } from "./+types/workshoppricingvariation";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await getUser(request);
  const roleUser = await getRoleUser(request);
  const isAdmin = roleUser?.roleName === "Admin";

  // Determine redirect path based on user role
  const getRedirectPath = () => {
    if (!user) return "/dashboard";
    if (isAdmin) return "/dashboard/admin";
    return "/dashboard/user";
  };

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
    // Multi-day workshop validation
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      Number(connectId)
    );

    if (!occurrences || occurrences.length === 0) {
      throw redirect(getRedirectPath());
    }

    // Check if ANY occurrence is cancelled
    const hasAnyCancelledOccurrence = occurrences.some(
      (occ) => occ.status === "cancelled"
    );
    if (hasAnyCancelledOccurrence) {
      throw redirect(getRedirectPath());
    }

    // Check if ANY occurrence is in the past
    const now = new Date();
    const hasAnyPastOccurrence = occurrences.some(
      (occ) => new Date(occ.endDate) < now
    );
    if (hasAnyPastOccurrence) {
      throw redirect(getRedirectPath());
    }

    // Multi-day workshop capacity
    capacityInfo = await getMultiDayWorkshopRegistrationCounts(
      workshopId,
      Number(connectId)
    );
  } else if (occurrenceId) {
    // Regular workshop validation
    const occurrence = await getWorkshopOccurrence(
      workshopId,
      Number(occurrenceId)
    );

    if (!occurrence) {
      throw redirect(getRedirectPath());
    }

    // Check if occurrence is cancelled
    if (occurrence.status === "cancelled") {
      throw redirect(getRedirectPath());
    }

    // Check if occurrence is in the past
    const now = new Date();
    if (new Date(occurrence.endDate) < now) {
      throw redirect(getRedirectPath());
    }

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

  // Only select from active (non-cancelled) variations for default selection
  const activeVariations = workshop.priceVariations.filter(
    (variation: any) => variation.status !== "cancelled"
  );
  const [selectedVariation, setSelectedVariation] = useState<number | null>(
    activeVariations.length > 0 ? activeVariations[0].id : null
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
      <div className="absolute inset-0 flex">
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

                const isCancelled = variation.status === "cancelled";
                const isDisabled = isVariationFull || isCancelled;

                return (
                  <div
                    key={variation.id}
                    className={`border rounded-lg p-6 transition-all ${
                      isCancelled
                        ? "opacity-50 cursor-not-allowed border-red-300 bg-red-50"
                        : isVariationFull
                          ? "opacity-50 cursor-not-allowed border-gray-300"
                          : selectedVariation === variation.id
                            ? "border-blue-500 bg-blue-50 cursor-pointer"
                            : "border-gray-200 hover:border-gray-300 cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedVariation(variation.id);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="variation"
                        value={variation.id}
                        checked={
                          selectedVariation === variation.id && !isCancelled
                        }
                        onChange={() => {
                          if (!isDisabled) {
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
                              <h3
                                className={`text-xl font-semibold ${isCancelled ? "text-gray-500 line-through" : ""}`}
                              >
                                {variation.name}
                              </h3>
                              {index === 0 && !isCancelled && (
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                  Standard
                                </span>
                              )}
                              {isCancelled && (
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                                  Cancelled
                                </span>
                              )}
                              {!isCancelled && isVariationFull && (
                                <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                                  Full
                                </span>
                              )}
                            </div>
                            <p
                              className={`${isCancelled ? "text-gray-400" : "text-gray-600"}`}
                            >
                              {isCancelled
                                ? "This pricing option has been cancelled and is no longer available."
                                : variation.description}
                            </p>
                            {!isCancelled && variationCapacityInfo && (
                              <p className="text-sm text-gray-500 mt-1">
                                {variationCapacityInfo.registrations}/
                                {variationCapacityInfo.capacity} registered
                              </p>
                            )}
                            {isCancelled && (
                              <p className="text-sm text-red-500 mt-1">
                                All users registered for this option have been
                                notified.
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-2xl font-bold ${isCancelled ? "text-gray-400 line-through" : "text-blue-600"}`}
                            >
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
                disabled={(() => {
                  // Check if no variation is selected
                  if (selectedVariation === null) return true;

                  // Check if no active variations exist
                  if (activeVariations.length === 0) return true;

                  // Check if workshop is full
                  if (
                    capacityInfo &&
                    capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity
                  )
                    return true;

                  // Check if all active variations are full
                  const selectableVariations = activeVariations.filter(
                    (variation) => {
                      const variationCapacityInfo =
                        capacityInfo?.variations?.find(
                          (v) => v.variationId === variation.id
                        );
                      const isVariationFull = variationCapacityInfo
                        ? variationCapacityInfo.registrations >=
                          variationCapacityInfo.capacity
                        : false;
                      return !isVariationFull;
                    }
                  );

                  if (selectableVariations.length === 0) return true;

                  return false;
                })()}
                className={`${(() => {
                  // Same logic as disabled check
                  if (selectedVariation === null)
                    return "bg-gray-400 cursor-not-allowed";
                  if (activeVariations.length === 0)
                    return "bg-gray-400 cursor-not-allowed";
                  if (
                    capacityInfo &&
                    capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity
                  )
                    return "bg-gray-400 cursor-not-allowed";

                  const selectableVariations = activeVariations.filter(
                    (variation) => {
                      const variationCapacityInfo =
                        capacityInfo?.variations?.find(
                          (v) => v.variationId === variation.id
                        );
                      const isVariationFull = variationCapacityInfo
                        ? variationCapacityInfo.registrations >=
                          variationCapacityInfo.capacity
                        : false;
                      return !isVariationFull;
                    }
                  );

                  if (selectableVariations.length === 0)
                    return "bg-gray-400 cursor-not-allowed";

                  return "bg-indigo-500 hover:bg-indigo-600";
                })()} text-white px-6 py-2 rounded-lg`}
              >
                {(() => {
                  // Check conditions and return appropriate text
                  if (activeVariations.length === 0)
                    return "No Options Available";
                  if (
                    capacityInfo &&
                    capacityInfo.totalRegistrations >=
                      capacityInfo.workshopCapacity
                  )
                    return "Workshop Full";

                  const selectableVariations = activeVariations.filter(
                    (variation) => {
                      const variationCapacityInfo =
                        capacityInfo?.variations?.find(
                          (v) => v.variationId === variation.id
                        );
                      const isVariationFull = variationCapacityInfo
                        ? variationCapacityInfo.registrations >=
                          variationCapacityInfo.capacity
                        : false;
                      return !isVariationFull;
                    }
                  );

                  if (selectableVariations.length === 0)
                    return "All Options Unavailable";

                  return "Continue to Payment";
                })()}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
