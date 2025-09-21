import {
  useLoaderData,
  useFetcher,
  useNavigate,
  Link,
  redirect,
} from "react-router-dom";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  getWorkshopWithPriceVariations,
  getWorkshopById,
  checkUserRegistration,
  getUserCompletedPrerequisites,
  cancelUserWorkshopRegistration,
  getUserWorkshopRegistrationInfo,
  getWorkshopOccurrence,
  cancelMultiDayWorkshopRegistration,
} from "../../models/workshop.server";
import { getUser, getRoleUser } from "~/utils/session.server";
import { getWorkshopVisibilityDays } from "../../models/admin.server";
import { useState, useEffect } from "react";
import { Users, MapPin } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  duplicateWorkshop,
  getWorkshopRegistrationCounts,
  getMultiDayWorkshopRegistrationCounts,
} from "~/models/workshop.server";
import { logger } from "~/logging/logger";
import { sendWorkshopCancellationEmail } from "~/utils/email.server";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";

interface Occurrence {
  id: number;
  startDate: Date;
  endDate: Date;
  status: string;
  capacityInfo?: {
    workshopCapacity: number;
    totalRegistrations: number;
    baseRegistrations: number;
    hasBaseCapacity: boolean;
    variations: Array<{
      variationId: number;
      name: string;
      capacity: number;
      registrations: number;
      hasCapacity: boolean;
    }>;
  };
}

interface PrerequisiteWorkshop {
  id: number;
  name: string;
  completed: boolean;
}

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const workshopId = parseInt(params.id);
  const workshop = await getWorkshopWithPriceVariations(workshopId);
  if (!workshop) {
    throw new Response("Workshop not found", { status: 404 });
  }

  const user = await getUser(request);
  const roleUser = await getRoleUser(request);

  // Get the current date
  const now = new Date();

  // Get admin settings for workshop visibility days
  const visibilityDays = await getWorkshopVisibilityDays();

  // Calculate the future cutoff date based on admin settings
  const futureCutoffDate = new Date();
  futureCutoffDate.setDate(futureCutoffDate.getDate() + visibilityDays);

  // Find the most recent (highest) offerId that has active dates
  const currentOfferIds = workshop.occurrences
    .filter(
      (occ: any) => new Date(occ.endDate) >= now && occ.status === "active"
    )
    .map((occ: any) => occ.offerId);

  // If there are no current offers, show all active future dates
  const latestOfferId =
    currentOfferIds.length > 0
      ? Math.max(...currentOfferIds)
      : Math.max(...workshop.occurrences.map((occ: any) => occ.offerId), 0);

  // Filter occurrences based on rules:
  // 1. Include all active dates from the latest offer
  // 2. Include past dates from the current offer
  // 3. Exclude past dates from previous offers
  // 4. Only show dates within the visibility window
  workshop.occurrences = workshop.occurrences.filter((occ: any) => {
    const occDate = new Date(occ.startDate);
    const isPast = occDate < now;
    const isCurrentOffer = occ.offerId === latestOfferId;
    const isWithinVisibilityWindow = occDate <= futureCutoffDate;

    // Include if:
    // - It's from the current offer (regardless of past/future)
    // - OR it's an active date from any offer within visibility window
    return (
      (isCurrentOffer || (!isPast && occ.status === "active")) &&
      isWithinVisibilityWindow
    );
  });

  // Get capacity information for each occurrence
  const occurrencesWithCapacity = await Promise.all(
    workshop.occurrences.map(async (occ: any) => {
      let capacityInfo;

      // Check if this is a multi-day workshop
      if (occ.connectId) {
        // For multi-day workshops, get capacity based on connectId
        capacityInfo = await getMultiDayWorkshopRegistrationCounts(
          workshopId,
          occ.connectId
        );
      } else {
        // For regular workshops, get capacity for individual occurrence
        capacityInfo = await getWorkshopRegistrationCounts(workshopId, occ.id);
      }

      return {
        ...occ,
        capacityInfo,
      };
    })
  );

  // Replace the occurrences with ones that include capacity info
  workshop.occurrences = occurrencesWithCapacity;

  // Store registration info including cancellation status
  let registrations: {
    [occurrenceId: number]: {
      registered: boolean;
      registeredAt: Date | null;
      status?: string;
    };
  } = {};

  // Track completed prerequisites and prerequisite workshop details
  let prerequisiteWorkshops: PrerequisiteWorkshop[] = [];
  let hasCompletedAllPrerequisites = false;

  let userRegistrationInfo = null;
  if (user) {
    userRegistrationInfo = await getUserWorkshopRegistrationInfo(
      user.id,
      workshopId
    );
  }

  if (user) {
    // For each occurrence, check if the user is registered and get the registration time
    for (const occ of workshop.occurrences) {
      const regRow = await checkUserRegistration(workshopId, user.id, occ.id);
      // regRow returns { registered, registeredAt, status }
      registrations[occ.id] = {
        registered: regRow.registered,
        registeredAt: regRow.registeredAt,
        status: regRow.status,
      };
    }

    // Fetch user's completed prerequisites for this workshop
    const completedPrerequisites = await getUserCompletedPrerequisites(
      user.id,
      workshopId
    );

    // Fetch prerequisite workshop names and completion status
    if (workshop.prerequisites && workshop.prerequisites.length > 0) {
      prerequisiteWorkshops = await Promise.all(
        workshop.prerequisites.map(async (prereq) => {
          const id =
            typeof prereq === "object"
              ? (prereq as any).prerequisiteId
              : prereq;
          const prereqWorkshop = await getWorkshopById(id);

          // Check if the user has completed this prerequisite
          const isCompleted = completedPrerequisites.includes(id);

          return prereqWorkshop
            ? { id, name: prereqWorkshop.name, completed: isCompleted }
            : { id, name: `Workshop #${id}`, completed: isCompleted };
        })
      );

      // Check if all prerequisites are completed
      hasCompletedAllPrerequisites = prerequisiteWorkshops.every(
        (prereq) => prereq.completed
      );
    } else {
      // If there are no prerequisites, user is eligible
      hasCompletedAllPrerequisites = true;
    }
  } else {
    // If no prerequisites or user not logged in, set default values
    if (workshop.prerequisites && workshop.prerequisites.length > 0) {
      prerequisiteWorkshops = await Promise.all(
        workshop.prerequisites.map(async (prereq) => {
          const id =
            typeof prereq === "object"
              ? (prereq as any).prerequisiteId
              : prereq;
          const prereqWorkshop = await getWorkshopById(id);
          return prereqWorkshop
            ? { id, name: prereqWorkshop.name, completed: false }
            : { id, name: `Workshop #${id}`, completed: false };
        })
      );
    }
    hasCompletedAllPrerequisites = false; // Default to false when not logged in
  }

  return {
    workshop,
    user,
    registrations,
    roleUser,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
    userRegistrationInfo,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "cancelRegistration") {
    const workshopId = formData.get("workshopId");
    const occurrenceId = formData.get("occurrenceId");

    // Retrieve user from session
    const user = await getUser(request);
    if (!user) {
      return { error: "User not authenticated" };
    }

    try {
      await cancelUserWorkshopRegistration({
        workshopId: Number(workshopId),
        occurrenceId: Number(occurrenceId),
        userId: user.id,
      });
      // Send cancellation confirmation email (non-blocking)
      try {
        const workshop = await getWorkshopById(Number(workshopId));
        const occurrence = await getWorkshopOccurrence(
          Number(workshopId),
          Number(occurrenceId)
        );

        // Include price variation info if present for this user
        const registrationInfo = await getUserWorkshopRegistrationInfo(
          user.id,
          Number(workshopId)
        );
        const priceVariation = registrationInfo?.priceVariation
          ? {
              name: registrationInfo.priceVariation.name,
              description: registrationInfo.priceVariation.description,
              price: registrationInfo.priceVariation.price,
            }
          : null;

        await sendWorkshopCancellationEmail({
          userEmail: user.email,
          workshopName: workshop.name,
          startDate: new Date(occurrence.startDate),
          endDate: new Date(occurrence.endDate),
          basePrice: workshop.price,
          priceVariation,
        });
      } catch (emailErr) {
        logger.error(
          `Failed to send workshop cancellation email: ${emailErr}`,
          {
            url: request.url,
          }
        );
      }
      logger.info(
        `User ${user.id}'s workshop registration cancelled successfully.`,
        { url: request.url }
      );
      return { success: true, cancelled: true };
    } catch (error) {
      logger.error(`Error cancelling registration: ${error}`, {
        url: request.url,
      });
      return { error: "Failed to cancel registration" };
    }
  }

  // if (actionType === "cancelAllRegistrations") {
  //   const workshopId = formData.get("workshopId");
  //   const connectId = formData.get("connectId");

  //   const user = await getUser(request);
  //   if (!user) {
  //     return { error: "User not authenticated" };
  //   }

  //   try {
  //     const ws = await getWorkshopById(Number(workshopId));
  //     const occurrences = ws.occurrences
  //       .filter(
  //         (occ: any) => occ.connectId && occ.connectId === Number(connectId)
  //       )
  //       .sort(
  //         (a: any, b: any) =>
  //           new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  //       );

  //     // Cancel all user registrations for these occurrences
  //     for (const occ of occurrences) {
  //       await cancelUserWorkshopRegistration({
  //         workshopId: Number(workshopId),
  //         occurrenceId: Number(occ.id),
  //         userId: user.id,
  //       });
  //     }

  //     // Build sessions list for email
  //     const sessions = occurrences.map((occ: any) => ({
  //       startDate: new Date(occ.startDate),
  //       endDate: new Date(occ.endDate),
  //     }));

  //     // Price variation (if any)
  //     const registrationInfo = await getUserWorkshopRegistrationInfo(
  //       user.id,
  //       Number(workshopId)
  //     );
  //     const priceVariation = registrationInfo?.priceVariation
  //       ? {
  //           name: registrationInfo.priceVariation.name,
  //           description: registrationInfo.priceVariation.description,
  //           price: registrationInfo.priceVariation.price,
  //         }
  //       : null;

  //     try {
  //       await sendWorkshopCancellationEmail({
  //         userEmail: user.email,
  //         workshopName: ws.name,
  //         sessions,
  //         basePrice: ws.price,
  //         priceVariation,
  //       });
  //     } catch (emailErr) {
  //       logger.error(
  //         `Failed to send multi-day workshop cancellation email: ${emailErr}`,
  //         { url: request.url }
  //       );
  //     }

  //     logger.info(
  //       `User ${user.id}'s multi-day workshop registration cancelled successfully.`,
  //       { url: request.url }
  //     );
  //     return { success: true, cancelled: true };
  //   } catch (error) {
  //     logger.error(`Error cancelling multi-day registration: ${error}`, {
  //       url: request.url,
  //     });
  //     return { error: "Failed to cancel registration" };
  //   }
  // }

  if (actionType === "cancelAllRegistrations") {
    const workshopId = formData.get("workshopId");
    const connectId = formData.get("connectId");

    // Retrieve user from session
    const user = await getUser(request);
    if (!user) {
      return { error: "User not authenticated" };
    }

    try {
      // Get workshop details for email
      const ws = await getWorkshopById(Number(workshopId));
      const occurrences = ws.occurrences
        .filter(
          (occ: any) => occ.connectId && occ.connectId === Number(connectId)
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );

      // Cancel the multi-day workshop registration (creates only ONE cancellation record)
      await cancelMultiDayWorkshopRegistration({
        workshopId: Number(workshopId),
        connectId: Number(connectId),
        userId: user.id,
      });

      // Build sessions list for email
      const sessions = occurrences.map((occ: any) => ({
        startDate: new Date(occ.startDate),
        endDate: new Date(occ.endDate),
      }));

      // Get price variation info if any
      const registrationInfo = await getUserWorkshopRegistrationInfo(
        user.id,
        Number(workshopId)
      );
      const priceVariation = registrationInfo?.priceVariation
        ? {
            name: registrationInfo.priceVariation.name,
            description: registrationInfo.priceVariation.description,
            price: registrationInfo.priceVariation.price,
          }
        : null;

      // Send cancellation email
      try {
        await sendWorkshopCancellationEmail({
          userEmail: user.email,
          workshopName: ws.name,
          sessions,
          basePrice: ws.price,
          priceVariation,
        });
      } catch (emailErr) {
        logger.error(
          `Failed to send multi-day workshop cancellation email: ${emailErr}`,
          { url: request.url }
        );
      }

      logger.info(
        `User ${user.id}'s multi-day workshop registration cancelled successfully.`,
        { url: request.url }
      );
      return { success: true, cancelled: true };
    } catch (error) {
      logger.error(`Error cancelling multi-day registration: ${error}`, {
        url: request.url,
      });
      return { error: "Failed to cancel multi-day registration" };
    }
  }
}

/**
 * Check if current time is within the registration cutoff period
 * @param startDate Workshop start date
 * @param cutoffMinutes Registration cutoff in minutes
 * @returns true if within cutoff period (too late to register)
 */
const isWithinCutoffPeriod = (
  startDate: Date,
  cutoffMinutes: number
): boolean => {
  const now = new Date();
  const cutoffTime = new Date(startDate.getTime() - cutoffMinutes * 60 * 1000);
  return now >= cutoffTime;
};

/**
 * Format cutoff time in a human-readable format
 * @param minutes Cutoff minutes
 * @returns Formatted string (e.g., "1 hour and 15 minutes" or "30 minutes")
 */
const formatCutoffTime = (minutes: number): string => {
  if (minutes <= 0) {
    return "0 minutes";
  }

  if (minutes >= 1440) {
    // 1 day or more
    const days = Math.floor(minutes / 1440);
    const remainingMinutes = minutes % 1440;

    if (remainingMinutes === 0) {
      return `${days} ${days === 1 ? "day" : "days"}`;
    }

    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;

    let result = `${days} ${days === 1 ? "day" : "days"}`;
    if (hours > 0) {
      result += ` and ${hours} ${hours === 1 ? "hour" : "hours"}`;
    }
    if (mins > 0) {
      result += `${hours > 0 ? " and " : " and "}${mins} ${
        mins === 1 ? "minute" : "minutes"
      }`;
    }
    return result;
  } else if (minutes >= 60) {
    // 1 hour or more
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    } else {
      return `${hours} ${hours === 1 ? "hour" : "hours"} and ${mins} ${
        mins === 1 ? "minute" : "minutes"
      }`;
    }
  } else {
    // Less than 1 hour
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
};

/**
 * Check if workshop has capacity for new registrations
 * @param capacityInfo Capacity information from getWorkshopRegistrationCounts
 * @returns Object with capacity status and reason
 */
const checkWorkshopCapacity = (capacityInfo: any) => {
  // Check if workshop is at full capacity
  if (capacityInfo.totalRegistrations >= capacityInfo.workshopCapacity) {
    return {
      hasCapacity: false,
      reason: "workshop_full",
      message: `Workshop is full (${capacityInfo.totalRegistrations}/${capacityInfo.workshopCapacity})`,
    };
  }

  // If workshop has price variations, check if all variations are full
  if (capacityInfo.variations && capacityInfo.variations.length > 0) {
    const allVariationsFull = capacityInfo.variations.every(
      (variation: any) => !variation.hasCapacity
    );

    // Also check if base registration has capacity
    const baseHasCapacity = capacityInfo.hasBaseCapacity;

    // If all variations are full AND base is at capacity, no one can register
    if (allVariationsFull && !baseHasCapacity) {
      return {
        hasCapacity: false,
        reason: "all_options_full",
        message: "All pricing options are at capacity",
      };
    }
  }

  return {
    hasCapacity: true,
    reason: "available",
    message: "Capacity available",
  };
};

/**
 * Check if multi-day workshop has capacity for new registrations
 * @param capacityInfo Capacity information from getMultiDayWorkshopRegistrationCounts
 * @returns Object with capacity status and reason
 */
const checkMultiDayWorkshopCapacity = (capacityInfo: any) => {
  // Check if workshop is at full capacity
  if (capacityInfo.totalRegistrations >= capacityInfo.workshopCapacity) {
    return {
      hasCapacity: false,
      reason: "workshop_full",
      message: `Workshop is full (${capacityInfo.totalRegistrations}/${capacityInfo.workshopCapacity})`,
    };
  }

  // If workshop has price variations, check if ANY variations are full
  if (capacityInfo.variations && capacityInfo.variations.length > 0) {
    const someVariationsFull = capacityInfo.variations.some(
      (variation: any) => !variation.hasCapacity
    );

    // If some variations are full, show the message
    if (someVariationsFull) {
      return {
        hasCapacity: true, // Workshop still has capacity overall
        reason: "some_options_full",
        message: "Some pricing options are full",
      };
    }

    const allVariationsFull = capacityInfo.variations.every(
      (variation: any) => !variation.hasCapacity
    );

    // Also check if base registration has capacity
    const baseHasCapacity = capacityInfo.hasBaseCapacity;

    // If all variations are full AND base is at capacity, no one can register
    if (allVariationsFull && !baseHasCapacity) {
      return {
        hasCapacity: false,
        reason: "all_options_full",
        message: "All pricing options are at capacity",
      };
    }
  }

  return {
    hasCapacity: true,
    reason: "available",
    message: "Capacity available",
  };
};

/**
 * Get capacity display text for UI
 * @param capacityInfo Capacity information from getWorkshopRegistrationCounts
 * @returns Formatted capacity text
 */
const getCapacityDisplayText = (capacityInfo: any) => {
  if (!capacityInfo) return "";

  const { totalRegistrations, workshopCapacity, variations } = capacityInfo;

  let text = `${totalRegistrations}/${workshopCapacity} registered`;

  // if (variations && variations.length > 0) {
  //   const fullVariations = variations.filter((v: any) => !v.hasCapacity);
  //   if (fullVariations.length > 0) {
  //     text += ` (Some options full)`;
  //   }
  // }

  return text;
};

export default function WorkshopDetails() {
  const {
    workshop,
    user,
    registrations,
    roleUser,
    prerequisiteWorkshops,
    hasCompletedAllPrerequisites,
    userRegistrationInfo,
  } = useLoaderData() as {
    workshop: any;
    user: any;
    registrations: {
      [occurrenceId: number]: {
        registered: boolean;
        registeredAt: Date | null;
        status: string | null;
      };
    };
    roleUser: any;
    prerequisiteWorkshops: PrerequisiteWorkshop[];
    hasCompletedAllPrerequisites: boolean;
    userRegistrationInfo: any;
  };

  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState("success");

  // State to track which occurrence's cancel confirmation should be shown
  const [confirmOccurrenceId, setConfirmOccurrenceId] = useState<number | null>(
    null
  );

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.cancelled) {
        setPopupMessage("You have successfully cancelled your registration.");
      } else {
        setPopupMessage("🎉 Registration successful!");
        localStorage.setItem("registrationSuccess", "true");
      }
      setPopupType("success");
      setShowPopup(true);
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setPopupType("error");
      setShowPopup(true);
    }
  }, [fetcher.data]);

  const handleRegister = (occurrenceId: number) => {
    if (!user) {
      setPopupMessage("Please log in to register for a workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    if (!hasCompletedAllPrerequisites) {
      setPopupMessage(
        "You must complete all prerequisites before registering."
      );
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    if (
      workshop.hasPriceVariations &&
      workshop.priceVariations &&
      workshop.priceVariations.length > 0
    ) {
      navigate(
        `/dashboard/workshops/pricevariations/${workshop.id}?occurrenceId=${occurrenceId}`
      );
    } else {
      navigate(`/dashboard/payment/${workshop.id}/${occurrenceId}`);
    }
  };

  // Offer Again button for Admins
  const handleOfferAgain = () => {
    navigate(`/dashboard/workshops/offer/${workshop.id}`);
  };

  const handleCancel = (occurrenceId: number) => {
    if (!user) return;
    fetcher.submit(
      {
        workshopId: String(workshop.id),
        occurrenceId: occurrenceId.toString(),
        actionType: "cancelRegistration",
      },
      { method: "post" }
    );
  };

  // Gather the earliest registration date for cancellation window
  const userRegistrationDates = workshop.occurrences
    .filter((occ: any) => registrations[occ.id]?.registered)
    .map((occ: any) => {
      const dateVal = registrations[occ.id]?.registeredAt;
      return dateVal ? new Date(dateVal) : null;
    })
    .filter((d: Date | null) => d !== null) as Date[];

  const earliestRegDate =
    userRegistrationDates.length > 0
      ? new Date(Math.min(...userRegistrationDates.map((d) => d.getTime())))
      : null;

  // For multi-day workshop: single registration/cancellation handling
  function handleRegisterAll() {
    if (!user) {
      setPopupMessage("Please log in to register for this workshop.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    if (!hasCompletedAllPrerequisites) {
      setPopupMessage("You must complete all prerequisites first.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    // Find the first active occurrence that has a non-null connectId
    const firstActiveOccurrence = workshop.occurrences.find(
      (occ: any) =>
        occ.status !== "past" &&
        occ.status !== "cancelled" &&
        occ.connectId !== null
    );

    if (!firstActiveOccurrence) {
      setPopupMessage("No active occurrences available to register.");
      setPopupType("error");
      setShowPopup(true);
      return;
    }

    // PRICE VARIATION CHECK FOR MULTI-DAY WORKSHOPS:
    if (
      workshop.hasPriceVariations &&
      workshop.priceVariations &&
      workshop.priceVariations.length > 0
    ) {
      navigate(
        `/dashboard/workshops/pricevariations/${workshop.id}?connectId=${firstActiveOccurrence.connectId}`
      );
    } else {
      // Navigate to the payment route using connectId (note the route now includes "connect")
      navigate(
        `/dashboard/payment/${workshop.id}/connect/${firstActiveOccurrence.connectId}`
      );
    }
  }

  function handleCancelAll() {
    if (!user) return;

    // Find the first registered occurrence to get the connectId
    const firstRegisteredOcc = workshop.occurrences.find(
      (occ: any) => registrations[occ.id]?.registered
    );

    if (!firstRegisteredOcc) {
      console.log("No registered occurrences found");
      return;
    }

    // For multi-day workshops, ALWAYS use the multi-day cancellation
    // even if connectId is 0, null, or undefined, as long as there's a connectId property
    if (isMultiDayWorkshop && firstRegisteredOcc.connectId !== undefined) {
      fetcher.submit(
        {
          workshopId: String(workshop.id),
          connectId: firstRegisteredOcc.connectId.toString(),
          actionType: "cancelAllRegistrations",
        },
        { method: "post" }
      );
    } else {
      // Only use individual cancellations for truly single-occurrence workshops
      workshop.occurrences.forEach((occ: any) => {
        if (
          occ.status !== "past" &&
          occ.status !== "cancelled" &&
          registrations[occ.id]?.registered
        ) {
          fetcher.submit(
            {
              workshopId: String(workshop.id),
              occurrenceId: occ.id.toString(),
              actionType: "cancelRegistration",
            },
            { method: "post" }
          );
        }
      });
    }
  }

  const sortedOccurrences = [...workshop.occurrences].sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // Check if this workshop is a multi-day workshop (any occurrence has a non-null connectId)
  const isMultiDayWorkshop = sortedOccurrences.some(
    (occ: any) => occ.connectId !== null
  );

  // If user is registered for ANY occurrence in a multi-day workshop,
  // Consider them registered for the entire workshop (exclude cancelled)
  const isUserRegisteredForAny = sortedOccurrences.some(
    (occ: any) =>
      registrations[occ.id]?.registered &&
      registrations[occ.id]?.status !== "cancelled"
  );

  // Check if user has any cancelled registrations
  const hasAnyCancelledRegistration = sortedOccurrences.some(
    (occ: any) => registrations[occ.id]?.status === "cancelled"
  );

  const allPast = sortedOccurrences.every((occ: any) => occ.status === "past");

  const allCancelled = sortedOccurrences.every(
    (occ: any) => occ.status === "cancelled"
  );

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {/* Conditional sidebar rendering based on user role */}
        {!user ? (
          <GuestAppSidebar />
        ) : isAdmin ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}

        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            {/* Popup Notification */}
            {showPopup && (
              <div
                className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
                  popupType === "success"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {popupMessage}
              </div>
            )}

            <Card className="mt-6 shadow-lg">
              <CardHeader className="flex flex-col items-center text-center">
                <CardTitle className="text-2xl font-bold">
                  {workshop.name}
                </CardTitle>
                <CardDescription className="text-gray-600 max-w-2xl mx-auto">
                  {workshop.description}
                </CardDescription>

                {/* Admin Only: View Users Button */}
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                      onClick={() =>
                        navigate(
                          `/dashboard/admin/workshop/${workshop.id}/users`
                        )
                      }
                    >
                      <Users size={18} />
                      View Users ({workshop.userCount})
                    </Button>

                    {isMultiDayWorkshop ? (
                      <ConfirmButton
                        confirmTitle="Duplicate Workshop"
                        confirmDescription="This will open the Add Workshop form with the current workshop's details pre-filled. You can then add new dates and make any other changes before saving."
                        onConfirm={() => {
                          // Store the workshop data in localStorage for the add workshop page to use
                          localStorage.setItem(
                            "duplicateWorkshopData",
                            JSON.stringify({
                              id: workshop.id,
                              name: workshop.name,
                              description: workshop.description,
                              price: workshop.price,
                              location: workshop.location,
                              capacity: workshop.capacity || 10,
                              type: workshop.type,
                              prerequisites: workshop.prerequisites || [],
                              equipments: workshop.equipments || [],
                              // Exclude occurrences/dates
                              isMultiDayWorkshop: isMultiDayWorkshop,
                              // Add pricing variation data
                              hasPriceVariations:
                                workshop.hasPriceVariations || false,
                              priceVariations: workshop.priceVariations || [],
                            })
                          );
                          // Navigate to the add workshop page
                          navigate("/dashboard/addworkshop");
                        }}
                        buttonLabel="Duplicate"
                        buttonClassName="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                      />
                    ) : (
                      <Button
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                        onClick={() => handleOfferAgain()}
                      >
                        Offer Again
                      </Button>
                    )}
                  </div>
                )}
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-4">
                  {workshop.hasPriceVariations &&
                  workshop.priceVariations &&
                  workshop.priceVariations.length > 0 ? (
                    <div className="w-full">
                      {/* Location display */}
                      <div className="flex items-center gap-4 mb-4">
                        <Badge
                          variant="outline"
                          className="px-4 py-2 text-lg font-medium"
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          {workshop.location}
                        </Badge>
                      </div>

                      {/* Pricing Options Section */}
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-4">
                          Pricing Options
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Render only price variations */}
                          {workshop.priceVariations.map(
                            (variation: any, index: number) => (
                              <div
                                key={variation.id}
                                className={`border p-4 rounded-lg shadow-md transition-colors ${
                                  variation.status === "cancelled"
                                    ? "bg-red-50 border-red-200 opacity-75"
                                    : index === 0
                                      ? "bg-blue-50 border-blue-200"
                                      : "bg-gray-50 border-gray-200 hover:bg-gray-100 cursor-pointer"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <h3
                                      className={`text-lg font-medium ${
                                        variation.status === "cancelled"
                                          ? "text-red-700"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      {variation.name}
                                    </h3>
                                    {variation.status === "cancelled" && (
                                      <Badge className="bg-red-500 text-white border-red-600 text-xs">
                                        Cancelled
                                      </Badge>
                                    )}
                                    {index === 0 &&
                                      variation.status !== "cancelled" && (
                                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                          Standard Option
                                        </Badge>
                                      )}
                                  </div>
                                  <span
                                    className={`text-xl font-bold ${
                                      variation.status === "cancelled"
                                        ? "text-red-600 line-through"
                                        : "text-blue-600"
                                    }`}
                                  >
                                    ${variation.price}
                                  </span>
                                </div>
                                <p
                                  className={`text-sm ${
                                    variation.status === "cancelled"
                                      ? "text-red-600"
                                      : "text-gray-600"
                                  }`}
                                >
                                  {variation.status === "cancelled"
                                    ? "This pricing option is no longer available"
                                    : variation.description}
                                </p>
                              </div>
                            )
                          )}
                        </div>

                        {/* Instruction message */}
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5 text-blue-600 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div className="text-sm">
                              <p className="font-medium text-blue-800">
                                How to select your pricing option:
                              </p>
                              <p className="text-blue-700 mt-1">
                                After clicking to register for the workshop
                                time(s), you'll be able to choose from these
                                pricing options during the checkout process
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <Badge
                        variant="outline"
                        className="px-4 py-2 text-lg font-medium"
                      >
                        ${workshop.price}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="px-4 py-2 text-lg font-medium"
                      >
                        {workshop.location}
                      </Badge>
                    </div>
                  )}
                </div>

                <Separator className="my-6" />

                {/* Multi-day Workshop Block */}
                {isMultiDayWorkshop ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">
                        Multi-day Workshop Dates
                      </h2>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-blue-50 border-blue-200 text-blue-700"
                        >
                          {sortedOccurrences.length} Workshop Dates
                        </Badge>
                        {/* Add capacity badge for multi-day workshops */}
                        {sortedOccurrences[0]?.capacityInfo && (
                          <>
                            <Badge
                              variant="outline"
                              className={`${
                                sortedOccurrences[0].capacityInfo
                                  .totalRegistrations >=
                                sortedOccurrences[0].capacityInfo
                                  .workshopCapacity
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : "bg-green-50 border-green-200 text-green-700"
                              }`}
                            >
                              {
                                sortedOccurrences[0].capacityInfo
                                  .totalRegistrations
                              }
                              /
                              {
                                sortedOccurrences[0].capacityInfo
                                  .workshopCapacity
                              }{" "}
                              registered
                            </Badge>
                            {/* Show capacity status message */}
                            {(() => {
                              const capacityCheck =
                                checkMultiDayWorkshopCapacity(
                                  sortedOccurrences[0].capacityInfo
                                );
                              if (
                                !capacityCheck.hasCapacity ||
                                capacityCheck.reason === "some_options_full"
                              ) {
                                return (
                                  <Badge
                                    variant="outline"
                                    className={`${
                                      capacityCheck.reason === "workshop_full"
                                        ? "bg-red-50 border-red-200 text-red-700"
                                        : "bg-amber-50 border-amber-200 text-amber-700"
                                    }`}
                                  >
                                    {capacityCheck.reason === "workshop_full"
                                      ? "Workshop Full"
                                      : "Some options full"}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                    {/* New Box-Style UI for multi-day workshops */}
                    <div className="border rounded-lg shadow-md bg-white p-4 mb-6">
                      <div className="grid gap-3">
                        {sortedOccurrences.map((occ: any, index: number) => (
                          <div
                            key={occ.id}
                            className="flex items-center p-3 rounded-md bg-gray-50 border border-gray-200"
                          >
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-500 text-white text-xs mr-2">
                                  {index + 1}
                                </span>
                                <p className="font-medium">
                                  {new Date(occ.startDate).toLocaleDateString(
                                    undefined,
                                    {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </p>
                              </div>
                              <p className="text-sm text-gray-600 ml-8">
                                {new Date(occ.startDate).toLocaleTimeString(
                                  undefined,
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}{" "}
                                {" - "}
                                {new Date(occ.endDate).toLocaleTimeString(
                                  undefined,
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* Single registration/cancellation for the entire workshop */}
                    {allPast ? (
                      <Badge className="bg-gray-500 text-white px-3 py-1">
                        Past
                      </Badge>
                    ) : allCancelled ? (
                      <Badge className="bg-red-500 text-white px-3 py-1">
                        Cancelled
                      </Badge>
                    ) : (
                      (() => {
                        // Check if ANY workshop date has passed the current date
                        const anyDatePassed = workshop.occurrences.some(
                          (occ: any) => new Date(occ.endDate) < new Date()
                        );

                        if (anyDatePassed) {
                          return (
                            <Badge className="bg-gray-500 text-white px-3 py-1">
                              Workshop registration has passed
                            </Badge>
                          );
                        } else if (
                          hasAnyCancelledRegistration &&
                          !isUserRegisteredForAny
                        ) {
                          // Show cancelled status if all registrations are cancelled
                          return (
                            <div className="flex items-center gap-4">
                              {userRegistrationInfo &&
                              workshop.priceVariations &&
                              workshop.priceVariations.length > 0 ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Badge className="bg-red-500 text-white px-3 py-1 border-red-600 cursor-pointer">
                                              Registration Cancelled (Entire
                                              Workshop)
                                            </Badge>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={handleRegisterAll}
                                              disabled={
                                                !user ||
                                                !hasCompletedAllPrerequisites ||
                                                (() => {
                                                  const activeOccurrences =
                                                    sortedOccurrences.filter(
                                                      (occ: any) =>
                                                        occ.status !== "past" &&
                                                        occ.status !==
                                                          "cancelled"
                                                    );
                                                  const firstOccurrence =
                                                    activeOccurrences[0];
                                                  const capacityCheck =
                                                    firstOccurrence?.capacityInfo
                                                      ? checkMultiDayWorkshopCapacity(
                                                          firstOccurrence.capacityInfo
                                                        )
                                                      : { hasCapacity: true };
                                                  return !capacityCheck.hasCapacity;
                                                })()
                                              }
                                            >
                                              Register Again
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-red-50 border border-red-200 p-3 max-w-xs">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                          <svg
                                            className="w-2.5 h-2.5 text-white"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </div>
                                        <span className="font-semibold text-red-800">
                                          Registration Cancelled
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-red-700">
                                            Option:
                                          </span>
                                          <span className="text-sm font-medium text-red-800">
                                            {userRegistrationInfo.priceVariation
                                              ? String(
                                                  userRegistrationInfo
                                                    .priceVariation.name ||
                                                    "Unknown Option"
                                                )
                                              : "Base Price"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-red-700">
                                            Price:
                                          </span>
                                          <span className="text-sm font-bold text-red-600">
                                            CA$
                                            {userRegistrationInfo.priceVariation
                                              ? Number(
                                                  userRegistrationInfo
                                                    .priceVariation.price
                                                ) || 0
                                              : workshop.price}
                                          </span>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-red-200">
                                          <p className="text-xs text-red-600 font-medium">
                                            Contact support if this cancellation
                                            was unexpected
                                          </p>
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Badge className="bg-red-500 text-white px-3 py-1 border-red-600 cursor-pointer">
                                      Registration Cancelled
                                    </Badge>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={handleRegisterAll}
                                      disabled={
                                        !user ||
                                        !hasCompletedAllPrerequisites ||
                                        (() => {
                                          const activeOccurrences =
                                            sortedOccurrences.filter(
                                              (occ: any) =>
                                                occ.status !== "past" &&
                                                occ.status !== "cancelled"
                                            );
                                          const firstOccurrence =
                                            activeOccurrences[0];
                                          const capacityCheck =
                                            firstOccurrence?.capacityInfo
                                              ? checkMultiDayWorkshopCapacity(
                                                  firstOccurrence.capacityInfo
                                                )
                                              : { hasCapacity: true };
                                          return !capacityCheck.hasCapacity;
                                        })()
                                      }
                                    >
                                      Register Again
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        } else if (isUserRegisteredForAny) {
                          const canCancel =
                            earliestRegDate &&
                            (new Date().getTime() - earliestRegDate.getTime()) /
                              (1000 * 60 * 60);
                          48;
                          return (
                            <div className="flex items-center gap-4">
                              {userRegistrationInfo &&
                              workshop.priceVariations &&
                              workshop.priceVariations.length > 0 ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Badge
                                              className={`px-3 py-1 cursor-pointer ${
                                                hasAnyCancelledRegistration
                                                  ? "bg-red-500 text-white border-red-600"
                                                  : "bg-green-500 text-white"
                                              }`}
                                            >
                                              {hasAnyCancelledRegistration
                                                ? "Registration Cancelled (Entire Workshop)"
                                                : "Registered (Entire Workshop)"}
                                            </Badge>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            {hasAnyCancelledRegistration ? (
                                              <DropdownMenuItem
                                                onClick={handleRegisterAll}
                                                disabled={
                                                  !user ||
                                                  !hasCompletedAllPrerequisites ||
                                                  (() => {
                                                    const activeOccurrences =
                                                      sortedOccurrences.filter(
                                                        (occ: any) =>
                                                          occ.status !==
                                                            "past" &&
                                                          occ.status !==
                                                            "cancelled"
                                                      );
                                                    const firstOccurrence =
                                                      activeOccurrences[0];
                                                    const capacityCheck =
                                                      firstOccurrence?.capacityInfo
                                                        ? checkMultiDayWorkshopCapacity(
                                                            firstOccurrence.capacityInfo
                                                          )
                                                        : { hasCapacity: true };
                                                    return !capacityCheck.hasCapacity;
                                                  })()
                                                }
                                              >
                                                Register Again
                                              </DropdownMenuItem>
                                            ) : canCancel ? (
                                              <>
                                                <DropdownMenuItem
                                                  onSelect={(e) => {
                                                    e.preventDefault();
                                                    handleCancelAll();
                                                  }}
                                                >
                                                  Yes, Cancel Entire Workshop
                                                  Registration
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onSelect={(e) => {
                                                    e.preventDefault();
                                                  }}
                                                >
                                                  No, Keep Registration
                                                </DropdownMenuItem>
                                              </>
                                            ) : (
                                              <DropdownMenuItem disabled>
                                                Cancel Entire Workshop
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      className={`border p-3 max-w-xs ${
                                        hasAnyCancelledRegistration &&
                                        !isUserRegisteredForAny
                                          ? "bg-red-50 border-red-200"
                                          : "bg-emerald-50 border-emerald-200"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <div
                                          className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                            hasAnyCancelledRegistration &&
                                            !isUserRegisteredForAny
                                              ? "bg-red-500"
                                              : "bg-emerald-500"
                                          }`}
                                        >
                                          {hasAnyCancelledRegistration &&
                                          !isUserRegisteredForAny ? (
                                            <svg
                                              className="w-2.5 h-2.5 text-white"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          ) : (
                                            <svg
                                              className="w-2.5 h-2.5 text-white"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          )}
                                        </div>
                                        <span
                                          className={`font-semibold ${
                                            hasAnyCancelledRegistration &&
                                            !isUserRegisteredForAny
                                              ? "text-red-800"
                                              : "text-emerald-800"
                                          }`}
                                        >
                                          {hasAnyCancelledRegistration &&
                                          !isUserRegisteredForAny
                                            ? "Registration Cancelled"
                                            : "Your Registration"}
                                        </span>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span
                                            className={`text-sm ${
                                              hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "text-red-700"
                                                : "text-emerald-700"
                                            }`}
                                          >
                                            Option:
                                          </span>
                                          <span
                                            className={`text-sm font-medium ${
                                              hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "text-red-800"
                                                : "text-emerald-800"
                                            }`}
                                          >
                                            {userRegistrationInfo.priceVariation
                                              ? userRegistrationInfo
                                                  .priceVariation.name
                                              : "Base Price"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span
                                            className={`text-sm ${
                                              hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "text-red-700"
                                                : "text-emerald-700"
                                            }`}
                                          >
                                            Price:
                                          </span>
                                          <span
                                            className={`text-sm font-bold ${
                                              hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "text-red-600"
                                                : "text-emerald-600"
                                            }`}
                                          >
                                            CA$
                                            {userRegistrationInfo.priceVariation
                                              ? userRegistrationInfo
                                                  .priceVariation.price
                                              : workshop.price}
                                          </span>
                                        </div>
                                        {userRegistrationInfo.priceVariation
                                          ?.description && (
                                          <div
                                            className={`mt-2 pt-2 border-t ${
                                              hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "border-red-200"
                                                : "border-emerald-200"
                                            }`}
                                          >
                                            <p
                                              className={`text-xs ${
                                                hasAnyCancelledRegistration &&
                                                !isUserRegisteredForAny
                                                  ? "text-red-600"
                                                  : "text-emerald-600"
                                              }`}
                                            >
                                              {hasAnyCancelledRegistration &&
                                              !isUserRegisteredForAny
                                                ? "This pricing option was cancelled"
                                                : userRegistrationInfo
                                                    .priceVariation.description}
                                            </p>
                                          </div>
                                        )}
                                        {hasAnyCancelledRegistration &&
                                          !isUserRegisteredForAny && (
                                            <div className="mt-2 pt-2 border-t border-red-200">
                                              <p className="text-xs text-red-600 font-medium">
                                                Contact support if this
                                                cancellation was unexpected
                                              </p>
                                            </div>
                                          )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Badge className="bg-green-500 text-white px-3 py-1 cursor-pointer">
                                      Registered (Entire Workshop)
                                    </Badge>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {hasAnyCancelledRegistration ? (
                                      <DropdownMenuItem
                                        onClick={handleRegisterAll}
                                        disabled={
                                          !user ||
                                          !hasCompletedAllPrerequisites ||
                                          (() => {
                                            const activeOccurrences =
                                              sortedOccurrences.filter(
                                                (occ: any) =>
                                                  occ.status !== "past" &&
                                                  occ.status !== "cancelled"
                                              );
                                            const firstOccurrence =
                                              activeOccurrences[0];
                                            const capacityCheck =
                                              firstOccurrence?.capacityInfo
                                                ? checkMultiDayWorkshopCapacity(
                                                    firstOccurrence.capacityInfo
                                                  )
                                                : { hasCapacity: true };
                                            return !capacityCheck.hasCapacity;
                                          })()
                                        }
                                      >
                                        Register Again
                                      </DropdownMenuItem>
                                    ) : canCancel ? (
                                      <>
                                        <DropdownMenuItem
                                          onSelect={(e) => {
                                            e.preventDefault();
                                            handleCancelAll();
                                          }}
                                        >
                                          Yes, Cancel Entire Workshop
                                          Registration
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={(e) => {
                                            e.preventDefault();
                                          }}
                                        >
                                          No, Keep Registration
                                        </DropdownMenuItem>
                                      </>
                                    ) : (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <DropdownMenuItem disabled>
                                              Cancel Entire Workshop
                                            </DropdownMenuItem>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>
                                              48 hours have passed; cannot
                                              cancel.
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          );
                        } else {
                          // This shows number of sessions being registered for
                          const activeOccurrences = sortedOccurrences.filter(
                            (occ: any) =>
                              occ.status !== "past" &&
                              occ.status !== "cancelled"
                          );

                          // For multi-day workshops, check capacity from the first occurrence
                          const firstOccurrence = activeOccurrences[0];
                          const capacityCheck = firstOccurrence?.capacityInfo
                            ? checkMultiDayWorkshopCapacity(
                                firstOccurrence.capacityInfo
                              )
                            : { hasCapacity: true, reason: "available" };

                          const earliestActiveOccurrence =
                            activeOccurrences.reduce((earliest, current) => {
                              const currentDate = new Date(current.startDate);
                              const earliestDate = new Date(earliest.startDate);
                              return currentDate < earliestDate
                                ? current
                                : earliest;
                            }, activeOccurrences[0]);

                          const withinCutoffPeriod = earliestActiveOccurrence
                            ? isWithinCutoffPeriod(
                                new Date(earliestActiveOccurrence.startDate),
                                workshop.registrationCutoff
                              )
                            : false;

                          return (
                            <>
                              {withinCutoffPeriod ? (
                                <div className="flex flex-col items-start gap-2">
                                  <Button
                                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg opacity-70"
                                    disabled={true}
                                  >
                                    Registration Closed
                                  </Button>
                                  <div className="bg-amber-100 text-amber-800 border border-amber-300 rounded-md p-3 text-sm">
                                    Registration is closed. Registration cutoff
                                    is{" "}
                                    {formatCutoffTime(
                                      workshop.registrationCutoff
                                    )}{" "}
                                    before the first workshop session.
                                  </div>
                                </div>
                              ) : !capacityCheck.hasCapacity ? (
                                <div className="flex flex-col items-start gap-2">
                                  <Button
                                    className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
                                    disabled={true}
                                  >
                                    Full
                                  </Button>
                                  {/* <div className="bg-red-100 text-red-800 border border-red-300 rounded-md p-3 text-sm">
                                    {capacityCheck.message}
                                    {firstOccurrence?.capacityInfo && (
                                      <div className="mt-2 text-xs">
                                        <p>
                                          Capacity:{" "}
                                          {
                                            firstOccurrence.capacityInfo
                                              .totalRegistrations
                                          }
                                          /
                                          {
                                            firstOccurrence.capacityInfo
                                              .workshopCapacity
                                          }{" "}
                                          registered
                                        </p>
                                        {firstOccurrence.capacityInfo.variations
                                          ?.length > 0 && (
                                          <div className="mt-1">
                                            {firstOccurrence.capacityInfo.variations.map(
                                              (v: any) => (
                                                <p key={v.variationId}>
                                                  {v.name}: {v.registrations}/
                                                  {v.capacity}{" "}
                                                  {!v.hasCapacity && "(Full)"}
                                                </p>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div> */}
                                </div>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <ConfirmButton
                                          confirmTitle="Register for Multi-Day Workshop"
                                          confirmDescription={`You are registering for ${activeOccurrences.length} workshop sessions. All dates are included in this registration.`}
                                          onConfirm={() => handleRegisterAll()}
                                          buttonLabel={`Register for Entire Workshop (${activeOccurrences.length} Sessions)`}
                                          buttonClassName="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                                          disabled={
                                            !user ||
                                            !hasCompletedAllPrerequisites ||
                                            !capacityCheck.hasCapacity
                                          }
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    {!user ? (
                                      <TooltipContent className="bg-blue-50 text-blue-800 border border-blue-300 p-3 max-w-xs">
                                        <p className="font-medium mb-2">
                                          Account required
                                        </p>
                                        <p className="text-sm mb-3">
                                          You need an account to register for
                                          workshops.
                                        </p>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => {
                                              const currentUrl =
                                                window.location.pathname;
                                              window.location.href = `/login?redirect=${encodeURIComponent(
                                                currentUrl
                                              )}`;
                                            }}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                                          >
                                            Sign In
                                          </button>
                                          <button
                                            onClick={() => {
                                              const currentUrl =
                                                window.location.pathname;
                                              window.location.href = `/register?redirect=${encodeURIComponent(
                                                currentUrl
                                              )}`;
                                            }}
                                            className="border border-blue-500 text-blue-500 hover:bg-blue-50 px-3 py-1 rounded text-xs"
                                          >
                                            Register
                                          </button>
                                        </div>
                                      </TooltipContent>
                                    ) : !hasCompletedAllPrerequisites ? (
                                      <TooltipContent className="bg-red-100 text-red-800 border border-red-300 p-2 max-w-xs">
                                        <p>
                                          You must complete all prerequisites
                                          before registering.
                                        </p>
                                      </TooltipContent>
                                    ) : null}
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          );
                        }
                      })()
                    )}
                  </>
                ) : (
                  // Regular workshop
                  <>
                    <h2 className="text-lg font-semibold mb-4">
                      Available Dates
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sortedOccurrences.map((occurrence: Occurrence) => {
                        const regData = registrations[occurrence.id] || {
                          registered: false,
                          registeredAt: null,
                          status: undefined,
                        };
                        const isOccurrenceRegistered = regData.registered;
                        const isCancelledRegistration =
                          regData.status === "cancelled";

                        return (
                          <div
                            key={occurrence.id}
                            className="border p-4 rounded-lg shadow-md bg-gray-50"
                          >
                            <p className="text-lg font-medium text-gray-800">
                              📅{" "}
                              {new Date(occurrence.startDate).toLocaleString()}{" "}
                              - {new Date(occurrence.endDate).toLocaleString()}
                            </p>

                            {/* Capacity Display */}
                            {occurrence.capacityInfo && (
                              <div className="mt-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">
                                    {getCapacityDisplayText(
                                      occurrence.capacityInfo
                                    )}
                                  </span>
                                  {/* {!checkWorkshopCapacity(
                                    occurrence.capacityInfo
                                  ).hasCapacity && (
                                    <Badge className="bg-red-500 text-white text-xs px-2 py-1">
                                      Full
                                    </Badge>
                                  )} */}
                                </div>

                                {/* Show variation capacity details if applicable*/}
                                {occurrence.capacityInfo.variations &&
                                  occurrence.capacityInfo.variations.length >
                                    0 && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      {occurrence.capacityInfo.variations.some(
                                        (v: any) => !v.hasCapacity
                                      ) && (
                                        <p className="text-amber-600">
                                          Some pricing options are full
                                        </p>
                                      )}
                                    </div>
                                  )}
                              </div>
                            )}

                            <div className="mt-2 flex items-center justify-between">
                              {occurrence.status === "cancelled" ? (
                                <Badge className="bg-red-500 text-white px-3 py-1">
                                  Cancelled
                                </Badge>
                              ) : occurrence.status === "past" ? (
                                <>
                                  <Badge className="bg-gray-500 text-white px-3 py-1">
                                    Registration has past
                                  </Badge>
                                </>
                              ) : isOccurrenceRegistered ? (
                                <>
                                  {userRegistrationInfo &&
                                  workshop.priceVariations &&
                                  workshop.priceVariations.length > 0 ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Badge
                                                  className={`px-3 py-1 cursor-pointer ${
                                                    registrations[occurrence.id]
                                                      ?.status === "cancelled"
                                                      ? "bg-red-500 text-white border-red-600"
                                                      : "bg-green-500 text-white"
                                                  }`}
                                                >
                                                  {registrations[occurrence.id]
                                                    ?.status === "cancelled"
                                                    ? "Registration Cancelled"
                                                    : "Registered"}
                                                </Badge>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                {registrations[occurrence.id]
                                                  ?.status === "cancelled" ? (
                                                  <DropdownMenuItem
                                                    onClick={() =>
                                                      handleRegister(
                                                        occurrence.id
                                                      )
                                                    }
                                                    disabled={
                                                      !user ||
                                                      !hasCompletedAllPrerequisites ||
                                                      !checkWorkshopCapacity(
                                                        occurrence.capacityInfo
                                                      ).hasCapacity ||
                                                      isWithinCutoffPeriod(
                                                        new Date(
                                                          occurrence.startDate
                                                        ),
                                                        workshop.registrationCutoff
                                                      )
                                                    }
                                                  >
                                                    Register Again
                                                  </DropdownMenuItem>
                                                ) : confirmOccurrenceId ===
                                                  occurrence.id ? (
                                                  <>
                                                    <DropdownMenuItem
                                                      onSelect={(e) => {
                                                        e.preventDefault();
                                                        handleCancel(
                                                          occurrence.id
                                                        );
                                                        setConfirmOccurrenceId(
                                                          null
                                                        );
                                                      }}
                                                    >
                                                      Yes, Cancel
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                      onSelect={(e) => {
                                                        e.preventDefault();
                                                        setConfirmOccurrenceId(
                                                          null
                                                        );
                                                      }}
                                                    >
                                                      No, Keep Registration
                                                    </DropdownMenuItem>
                                                  </>
                                                ) : (
                                                  <>
                                                    {(() => {
                                                      const canCancel =
                                                        earliestRegDate &&
                                                        (new Date().getTime() -
                                                          earliestRegDate.getTime()) /
                                                          (1000 * 60 * 60);
                                                      48;
                                                      return canCancel ? (
                                                        <DropdownMenuItem
                                                          onSelect={(e) => {
                                                            e.preventDefault();
                                                            setConfirmOccurrenceId(
                                                              occurrence.id
                                                            );
                                                          }}
                                                        >
                                                          Cancel
                                                        </DropdownMenuItem>
                                                      ) : (
                                                        <DropdownMenuItem
                                                          disabled
                                                        >
                                                          Cancel
                                                        </DropdownMenuItem>
                                                      );
                                                    })()}
                                                  </>
                                                )}
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          className={`border p-3 max-w-xs ${
                                            registrations[occurrence.id]
                                              ?.status === "cancelled"
                                              ? "bg-red-50 border-red-200"
                                              : "bg-emerald-50 border-emerald-200"
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <div
                                              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                                registrations[occurrence.id]
                                                  ?.status === "cancelled"
                                                  ? "bg-red-500"
                                                  : "bg-emerald-500"
                                              }`}
                                            >
                                              {registrations[occurrence.id]
                                                ?.status === "cancelled" ? (
                                                <svg
                                                  className="w-2.5 h-2.5 text-white"
                                                  fill="currentColor"
                                                  viewBox="0 0 20 20"
                                                >
                                                  <path
                                                    fillRule="evenodd"
                                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                    clipRule="evenodd"
                                                  />
                                                </svg>
                                              ) : (
                                                <svg
                                                  className="w-2.5 h-2.5 text-white"
                                                  fill="currentColor"
                                                  viewBox="0 0 20 20"
                                                >
                                                  <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                  />
                                                </svg>
                                              )}
                                            </div>
                                            <span
                                              className={`font-semibold ${
                                                registrations[occurrence.id]
                                                  ?.status === "cancelled"
                                                  ? "text-red-800"
                                                  : "text-emerald-800"
                                              }`}
                                            >
                                              {registrations[occurrence.id]
                                                ?.status === "cancelled"
                                                ? "Registration Cancelled"
                                                : "Your Registration"}
                                            </span>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                              <span
                                                className={`text-sm ${
                                                  registrations[occurrence.id]
                                                    ?.status === "cancelled"
                                                    ? "text-red-700"
                                                    : "text-emerald-700"
                                                }`}
                                              >
                                                Option:
                                              </span>
                                              <span
                                                className={`text-sm font-medium ${
                                                  registrations[occurrence.id]
                                                    ?.status === "cancelled"
                                                    ? "text-red-800"
                                                    : "text-emerald-800"
                                                }`}
                                              >
                                                {userRegistrationInfo.priceVariation
                                                  ? userRegistrationInfo
                                                      .priceVariation.name
                                                  : "Base Price"}
                                              </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span
                                                className={`text-sm ${
                                                  registrations[occurrence.id]
                                                    ?.status === "cancelled"
                                                    ? "text-red-700"
                                                    : "text-emerald-700"
                                                }`}
                                              >
                                                Price:
                                              </span>
                                              <span
                                                className={`text-sm font-bold ${
                                                  registrations[occurrence.id]
                                                    ?.status === "cancelled"
                                                    ? "text-red-600"
                                                    : "text-emerald-600"
                                                }`}
                                              >
                                                CA$
                                                {userRegistrationInfo.priceVariation
                                                  ? userRegistrationInfo
                                                      .priceVariation.price
                                                  : workshop.price}
                                              </span>
                                            </div>

                                            {registrations[occurrence.id]
                                              ?.status === "cancelled" && (
                                              <div className="mt-2 pt-2 border-t border-red-200">
                                                <p className="text-xs text-red-600 font-medium">
                                                  Contact support if this
                                                  cancellation was unexpected
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : registrations[occurrence.id]?.status ===
                                    "cancelled" ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Badge className="bg-red-500 text-white border-red-600 px-3 py-1 cursor-pointer">
                                          Registration Cancelled
                                        </Badge>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleRegister(occurrence.id)
                                          }
                                          disabled={
                                            !user ||
                                            !hasCompletedAllPrerequisites ||
                                            !checkWorkshopCapacity(
                                              occurrence.capacityInfo
                                            ).hasCapacity ||
                                            isWithinCutoffPeriod(
                                              new Date(occurrence.startDate),
                                              workshop.registrationCutoff
                                            )
                                          }
                                        >
                                          Register Again
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Badge className="bg-green-500 text-white px-3 py-1 cursor-pointer">
                                          Registered
                                        </Badge>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {registrations[occurrence.id]
                                          ?.status === "cancelled" ? (
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleRegister(occurrence.id)
                                            }
                                            disabled={
                                              !user ||
                                              !hasCompletedAllPrerequisites ||
                                              !checkWorkshopCapacity(
                                                occurrence.capacityInfo
                                              ).hasCapacity ||
                                              isWithinCutoffPeriod(
                                                new Date(occurrence.startDate),
                                                workshop.registrationCutoff
                                              )
                                            }
                                          >
                                            Register Again
                                          </DropdownMenuItem>
                                        ) : confirmOccurrenceId ===
                                          occurrence.id ? (
                                          <>
                                            <DropdownMenuItem
                                              onSelect={(e) => {
                                                e.preventDefault();
                                                handleCancel(occurrence.id);
                                                setConfirmOccurrenceId(null);
                                              }}
                                            >
                                              Yes, Cancel
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onSelect={(e) => {
                                                e.preventDefault();
                                                setConfirmOccurrenceId(null);
                                              }}
                                            >
                                              No, Keep Registration
                                            </DropdownMenuItem>
                                          </>
                                        ) : (
                                          <>
                                            {(() => {
                                              const canCancel =
                                                earliestRegDate &&
                                                (new Date().getTime() -
                                                  earliestRegDate.getTime()) /
                                                  (1000 * 60 * 60);
                                              48;
                                              return canCancel ? (
                                                <DropdownMenuItem
                                                  onSelect={(e) => {
                                                    e.preventDefault();
                                                    setConfirmOccurrenceId(
                                                      occurrence.id
                                                    );
                                                  }}
                                                >
                                                  Cancel
                                                </DropdownMenuItem>
                                              ) : (
                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <DropdownMenuItem
                                                        disabled
                                                      >
                                                        Cancel
                                                      </DropdownMenuItem>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                      <p>
                                                        48 hours have passed;
                                                        cannot cancel.
                                                      </p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              );
                                            })()}
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        {(() => {
                                          const capacityCheck =
                                            checkWorkshopCapacity(
                                              occurrence.capacityInfo
                                            );
                                          const isWithinCutoff =
                                            isWithinCutoffPeriod(
                                              new Date(occurrence.startDate),
                                              workshop.registrationCutoff
                                            );

                                          return (
                                            <Button
                                              className={`${
                                                !user
                                                  ? "bg-blue-400 hover:bg-gray-500"
                                                  : capacityCheck.hasCapacity &&
                                                      !isWithinCutoff
                                                    ? "bg-blue-500 hover:bg-blue-600"
                                                    : "bg-gray-400 hover:bg-gray-500"
                                              } text-white px-4 py-2 rounded-lg`}
                                              onClick={() =>
                                                handleRegister(occurrence.id)
                                              }
                                              disabled={
                                                !user ||
                                                !hasCompletedAllPrerequisites ||
                                                !capacityCheck.hasCapacity ||
                                                isWithinCutoff
                                              }
                                            >
                                              {!capacityCheck.hasCapacity
                                                ? "Full"
                                                : "Register"}
                                            </Button>
                                          );
                                        })()}
                                      </div>
                                    </TooltipTrigger>
                                    {(() => {
                                      const capacityCheck =
                                        checkWorkshopCapacity(
                                          occurrence.capacityInfo
                                        );
                                      const isWithinCutoff =
                                        isWithinCutoffPeriod(
                                          new Date(occurrence.startDate),
                                          workshop.registrationCutoff
                                        );

                                      if (!user) {
                                        return (
                                          <TooltipContent className="bg-blue-50 text-blue-800 border border-blue-300 p-3 max-w-xs">
                                            <p className="font-medium mb-2">
                                              Account required
                                            </p>
                                            <p className="text-sm mb-3">
                                              You need an account to register
                                              for workshops.
                                            </p>
                                            <div className="flex gap-2">
                                              <button
                                                onClick={() => {
                                                  const currentUrl =
                                                    window.location.pathname;
                                                  window.location.href = `/login?redirect=${encodeURIComponent(
                                                    currentUrl
                                                  )}`;
                                                }}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                                              >
                                                Sign In
                                              </button>
                                              <button
                                                onClick={() => {
                                                  const currentUrl =
                                                    window.location.pathname;
                                                  window.location.href = `/register?redirect=${encodeURIComponent(
                                                    currentUrl
                                                  )}`;
                                                }}
                                                className="border border-blue-500 text-blue-500 hover:bg-blue-50 px-3 py-1 rounded text-xs"
                                              >
                                                Register
                                              </button>
                                            </div>
                                          </TooltipContent>
                                        );
                                      } else if (!capacityCheck.hasCapacity) {
                                        return (
                                          <TooltipContent className="bg-red-100 text-red-800 border border-red-300 p-2 max-w-xs">
                                            <p>{capacityCheck.message}</p>
                                            {occurrence.capacityInfo
                                              ?.variations && (
                                              <div className="mt-2 text-xs">
                                                <p>Capacity details:</p>
                                                <ul className="list-disc list-inside">
                                                  <li>
                                                    Workshop:{" "}
                                                    {
                                                      occurrence.capacityInfo
                                                        .totalRegistrations
                                                    }
                                                    /
                                                    {
                                                      occurrence.capacityInfo
                                                        .workshopCapacity
                                                    }
                                                  </li>
                                                  {occurrence.capacityInfo.variations.map(
                                                    (v: any) => (
                                                      <li key={v.variationId}>
                                                        {v.name}:{" "}
                                                        {v.registrations}/
                                                        {v.capacity}{" "}
                                                        {!v.hasCapacity &&
                                                          "(Full)"}
                                                      </li>
                                                    )
                                                  )}
                                                </ul>
                                              </div>
                                            )}
                                          </TooltipContent>
                                        );
                                      } else if (isWithinCutoff) {
                                        return (
                                          <TooltipContent className="bg-amber-100 text-amber-800 border border-amber-300 p-2 max-w-xs">
                                            <p>
                                              Registration is closed.
                                              Registration cutoff is{" "}
                                              {formatCutoffTime(
                                                workshop.registrationCutoff
                                              )}{" "}
                                              before the workshop starts.
                                            </p>
                                          </TooltipContent>
                                        );
                                      } else if (
                                        !hasCompletedAllPrerequisites
                                      ) {
                                        return (
                                          <TooltipContent className="bg-red-100 text-red-800 border border-red-300 p-2 max-w-xs">
                                            <p>
                                              You must complete all
                                              prerequisites before registering.
                                            </p>
                                          </TooltipContent>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <Separator className="my-6" />

                {/* Prerequisites Section */}
                {prerequisiteWorkshops.length > 0 && (
                  <div className="mt-6 mb-8">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h2 className="text-lg font-semibold mb-3 flex items-center">
                        <span className="bg-yellow-500 text-white p-1 rounded-md mr-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        Prerequisites Required
                      </h2>

                      <div className="space-y-3">
                        {prerequisiteWorkshops.map((prereq) => (
                          <div
                            key={prereq.id}
                            className={`flex items-center p-3 rounded-md ${
                              prereq.completed
                                ? "bg-green-50 border border-green-200"
                                : "bg-red-50 border border-red-200"
                            }`}
                          >
                            <div
                              className={`flex-shrink-0 mr-3 h-8 w-8 rounded-full flex items-center justify-center ${
                                prereq.completed ? "bg-green-500" : "bg-red-500"
                              } text-white`}
                            >
                              {prereq.completed ? "✓" : "!"}
                            </div>
                            <div className="flex-1">
                              <Link
                                to={`/dashboard/workshops/${prereq.id}`}
                                className={`font-medium hover:underline ${
                                  prereq.completed
                                    ? "text-green-700"
                                    : "text-red-700"
                                }`}
                              >
                                {prereq.name}
                              </Link>
                              <p
                                className={`text-sm ${
                                  prereq.completed
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {prereq.completed
                                  ? "Completed"
                                  : "Not completed - you must complete this workshop first"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {!hasCompletedAllPrerequisites && (
                        <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-md">
                          <div className="flex items-start">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-amber-500 mt-0.5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div>
                              <p className="font-medium text-amber-800">
                                Registration Blocked
                              </p>
                              <p className="text-amber-700 text-sm">
                                You cannot register for this workshop until you
                                have completed all prerequisites listed above.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <h2 className="text-lg font-semibold">Cancellation Policy</h2>
                <p
                  className="text-gray-600"
                  dangerouslySetInnerHTML={{
                    __html: workshop.cancellationPolicy.replace(
                      "info@makerspaceyk.com",
                      `<a href="mailto:info@makerspaceyk.com" class="text-blue-500 hover:underline">info@makerspaceyk.com</a>`
                    ),
                  }}
                />

                <div className="mt-6">
                  <Button
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded-lg"
                    onClick={() => navigate("/dashboard/workshops")}
                  >
                    Back to Workshops
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
