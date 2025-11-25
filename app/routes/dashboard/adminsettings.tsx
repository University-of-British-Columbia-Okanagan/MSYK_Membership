import jwt from "jsonwebtoken";
import React, { useState, useMemo } from "react";
import {
  Form,
  useLoaderData,
  useActionData,
  redirect,
  useSubmit,
  useFetcher,
} from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  updateAdminSetting,
  getWorkshopVisibilityDays,
  updateWorkshopCutoff,
  getEquipmentVisibilityDays,
  getPlannedClosures,
  updatePlannedClosures,
  getAdminSetting,
  getPastWorkshopVisibility,
} from "~/models/admin.server";
import {
  getLevel3ScheduleRestrictions,
  getLevel4UnavailableHours,
  getAllEquipmentCancellations,
  updateEquipmentCancellationResolved,
  getAllEquipment,
} from "~/models/equipment.server";
import {
  getWorkshops,
  getAllWorkshopCancellations,
  updateWorkshopCancellationResolved,
  getWorkshopOccurrencesByConnectId,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit2, Check, X } from "lucide-react";
import { FiSearch } from "react-icons/fi";
import {
  updateUserRole,
  updateUserAllowLevel,
  getAllUsersWithVolunteerStatus,
  updateUserVolunteerStatus,
  makeUserAdmin,
  removeUserAdmin,
} from "~/models/user.server";
import {
  revokeUserMembershipByAdmin,
  unrevokeUserMembershipByAdmin,
} from "~/models/membership.server";
import {
  ShadTable,
  type ColumnDefinition,
} from "~/components/ui/Dashboard/ShadTable";
import { DataTable } from "~/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logger } from "~/logging/logger";
import {
  listCalendars,
  isGoogleConnected,
} from "~/utils/googleCalendar.server";
import {
  getAllVolunteerHours,
  updateVolunteerHourStatus,
  getRecentVolunteerHourActions,
} from "~/models/profile.server";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AccessCard,
  getAccessCardByUUID,
  updateAccessCard,
} from "~/models/access_card.server";
import { json } from "@remix-run/node";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { syncUserDoorAccess } from "~/services/access-control-sync.server";
import { RefreshCw, FilterIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

export async function loader({ request }: { request: Request }) {
  // Check if user is admin
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to admin settings page`, {
      userId: roleUser?.userId ?? "unknown",
      role: roleUser?.roleName ?? "none",
      url: request.url,
    });
    return redirect("/dashboard/user");
  }

  // Load current settings
  const workshopVisibilityDays = await getWorkshopVisibilityDays();
  const pastWorkshopVisibility = await getPastWorkshopVisibility();
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();
  const plannedClosures = await getPlannedClosures();
  const maxEquipmentSlotsPerDay = await getAdminSetting(
    "max_number_equipment_slots_per_day",
    "4"
  );
  const maxEquipmentSlotsPerWeek = await getAdminSetting(
    "max_number_equipment_slots_per_week",
    "14"
  );
  const gstPercentage = await getAdminSetting("gst_percentage", "5");

  const workshopsRaw = await getWorkshops();
  // Process workshops to determine which have active occurrences
  const now = new Date();
  const workshops = workshopsRaw.map((workshop) => {
    // A workshop is considered active if it has at least one occurrence in the future
    const hasActiveOccurrences = workshop.occurrences.some(
      (occ: any) => new Date(occ.startDate) > now && occ.status === "active"
    );

    return {
      ...workshop,
      hasActiveOccurrences,
    };
  });

  // Fetch all users for the user management tab
  const users = await getAllUsersWithVolunteerStatus();

  const level3Schedule = await getLevel3ScheduleRestrictions();
  const level4UnavailableHours = await getLevel4UnavailableHours();

  const allVolunteerHours = await getAllVolunteerHours();
  const recentVolunteerActions = await getRecentVolunteerHourActions(50);

  const workshopCancellations = await getAllWorkshopCancellations();
  const enhancedWorkshopCancellations = await Promise.all(
    workshopCancellations.map(async (cancellation) => {
      if (cancellation.workshopOccurrence.connectId) {
        // This is a multi-day workshop, fetch all occurrences
        const allOccurrences = await getWorkshopOccurrencesByConnectId(
          cancellation.workshopId,
          cancellation.workshopOccurrence.connectId
        );
        return {
          ...cancellation,
          allOccurrences,
        };
      }
      return cancellation;
    })
  );

  const equipmentCancellations = await getAllEquipmentCancellations();

  // Google Calendar config for integrations tab
  const googleConnected = await isGoogleConnected();
  const googleCalendarId = await getAdminSetting("google_calendar_id", "");
  const googleTimezone = await getAdminSetting(
    "google_calendar_timezone",
    "America/Yellowknife"
  );
  let googleCalendars: Array<{ id: string; summary: string }> = [];
  if (googleConnected) {
    try {
      const cals = await listCalendars();
      googleCalendars = cals.map((c) => ({ id: c.id, summary: c.summary }));
    } catch (e) {
      logger.error(`Failed to list Google calendars: ${String(e)}`);
    }
  }

  // ESP32: Fetching existing equipments
  const allEquipments = await getAllEquipment();
  allEquipments.push({
    id: 0,
    name: "Door",
    description: null,
    imageUrl: null,
    availability: true,
    totalSlots: 0,
    bookedSlots: 0,
    status: "active",
  });

  // Log successful load
  logger.info(
    `[User: ${roleUser.userId}] Admin settings page loaded successfully`,
    {
      url: request.url,
      workshopCount: workshops.length,
      userCount: users.length,
      plannedClosuresCount: plannedClosures.length,
    }
  );

  // Return settings to the component
  return {
    roleUser,
    settings: {
      workshopVisibilityDays,
      pastWorkshopVisibility,
      equipmentVisibilityDays,
      level3Schedule,
      level4UnavailableHours,
      plannedClosures,
      maxEquipmentSlotsPerDay: parseInt(maxEquipmentSlotsPerDay, 10),
      maxEquipmentSlotsPerWeek: parseInt(maxEquipmentSlotsPerWeek, 10),
      gstPercentage: parseFloat(gstPercentage),
    },
    workshops,
    users,
    volunteerHours: allVolunteerHours,
    recentVolunteerActions,
    workshopCancellations: enhancedWorkshopCancellations,
    equipmentCancellations,
    google: {
      connected: googleConnected,
      selectedCalendarId: googleCalendarId,
      timezone: googleTimezone,
      calendars: googleCalendars,
    },
    allEquipments,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const roleUser = await getRoleUser(request);

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized settings action attempt", {
      userId: roleUser?.userId ?? "unknown",
      url: request.url,
      actionType,
    });
    throw new Response("Not Authorized", { status: 419 });
  }

  if (actionType === "updateSettings") {
    try {
      // Get values from form
      const workshopVisibilityDays = formData.get("workshopVisibilityDays");
      const pastWorkshopVisibility = formData.get("pastWorkshopVisibility");
      const equipmentVisibilityDays = formData.get("equipmentVisibilityDays");
      const settingType = formData.get("settingType");

      // Update workshop visibility days
      if (settingType === "workshop" && workshopVisibilityDays) {
        await updateAdminSetting(
          "workshop_visibility_days",
          workshopVisibilityDays.toString(),
          "Number of days to show future workshop dates"
        );
      }

      if (settingType === "pastWorkshop" && pastWorkshopVisibility) {
        await updateAdminSetting(
          "past_workshop_visibility",
          pastWorkshopVisibility.toString(),
          "Number of days in the past to show entire workshops (in past events section as of 7/14/2025)"
        );
      }

      // Update equipment visibility days
      if (settingType === "equipment" && equipmentVisibilityDays) {
        await updateAdminSetting(
          "equipment_visible_registrable_days",
          equipmentVisibilityDays.toString(),
          "Number of days to show future equipment booking slots"
        );
      }

      if (settingType === "level3Schedule") {
        const scheduleData = formData.get("level3Schedule");
        if (scheduleData) {
          await updateAdminSetting(
            "level3_start_end_hours",
            scheduleData.toString(),
            "Configurable start and end hours for level 3 users to book equipment on each day of the week"
          );
        }
      }

      if (settingType === "level4UnavailableHours") {
        const unavailableData = formData.get("level4UnavailableHours");
        if (unavailableData) {
          await updateAdminSetting(
            "level4_unavaliable_hours",
            unavailableData.toString(),
            "Hours when level 4 users cannot book equipment. If start > end, it represents a period that crosses midnight."
          );
        }
      }

      if (settingType === "maxEquipmentSlotsPerDay") {
        const maxSlotsData = formData.get("maxEquipmentSlotsPerDay");
        if (maxSlotsData) {
          await updateAdminSetting(
            "max_number_equipment_slots_per_day",
            maxSlotsData.toString(),
            "Maximum number of 30-minute slots a user can book equipment per day"
          );
        }
      }

      if (settingType === "maxEquipmentSlotsPerWeek") {
        const maxSlotsWeekData = formData.get("maxEquipmentSlotsPerWeek");
        if (maxSlotsWeekData) {
          await updateAdminSetting(
            "max_number_equipment_slots_per_week",
            maxSlotsWeekData.toString(),
            "Maximum number of 30-minute slots a user can book equipment per week"
          );
        }
      }

      if (settingType === "gstPercentage") {
        const gstData = formData.get("gstPercentage");
        if (gstData) {
          await updateAdminSetting(
            "gst_percentage",
            gstData.toString(),
            "GST/HST tax percentage applied to all payments in Canada"
          );
        }
      }

      return {
        success: true,
        message: "Settings updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating settings: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
        actionType,
      });
      return {
        success: false,
        message: "Failed to update settings",
      };
    }
  }

  if (actionType === "googleCalendarSave") {
    const selectedId = formData.get("googleCalendarId");
    const tz = formData.get("googleTimezone") || "America/Yellowknife";
    try {
      if (selectedId) {
        await updateAdminSetting("google_calendar_id", String(selectedId));
      }
      await updateAdminSetting("google_calendar_timezone", String(tz));
      return { success: true, message: "Google Calendar settings saved" };
    } catch (error) {
      logger.error(`Error saving Google Calendar settings: ${error}`, {
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to save Google Calendar settings",
      };
    }
  }

  if (actionType === "updateCutoff") {
    try {
      const workshopId = Number(formData.get("workshopId"));
      const cutoffMinutes = Number(formData.get("cutoffMinutes"));

      if (!workshopId || isNaN(cutoffMinutes)) {
        return {
          success: false,
          message: "Invalid workshop ID or cutoff value",
        };
      }

      await updateWorkshopCutoff(workshopId, cutoffMinutes);

      logger.info(
        `[User: ${roleUser.userId}] Updated cutoff for workshop ${workshopId}`,
        {
          url: request.url,
          cutoffMinutes,
        }
      );

      return {
        success: true,
        message: "Workshop registration cutoff updated successfully",
        workshopId,
      };
    } catch (error) {
      logger.error(`Error updating workshop cutoff: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update workshop cutoff",
      };
    }
  }

  if (actionType === "updateUserRole") {
    const userId = formData.get("userId");
    const newRoleId = formData.get("newRoleId");
    try {
      await updateUserRole(Number(userId), String(newRoleId));

      logger.info(
        `[User: ${roleUser.userId}] Updated role for user ${userId} to ${newRoleId}`,
        {
          url: request.url,
        }
      );

      return {
        success: true,
        message: "User role updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating user role: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update user role",
      };
    }
  }

  if (actionType === "updateAllowLevel4") {
    const userId = formData.get("userId");
    const allowLevel4 = formData.get("allowLevel4");
    try {
      await updateUserAllowLevel(Number(userId), allowLevel4 === "true");

      logger.info(
        `[User: ${roleUser.userId}] Updated level 4 access for user ${userId} to ${allowLevel4}`,
        {
          url: request.url,
        }
      );

      return {
        success: true,
        message: "User permissions updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating allowLevel4: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update user permissions",
      };
    }
  }

  if (actionType === "updatePlannedClosures") {
    try {
      const closuresData = formData.get("closures");
      if (closuresData) {
        await updatePlannedClosures(JSON.parse(closuresData.toString()));
      }

      logger.info(`[User: ${roleUser.userId}] Updated planned closures`, {
        url: request.url,
      });

      return {
        success: true,
        message: "Planned closures updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating planned closures: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update planned closures",
      };
    }
  }

  if (actionType === "updateVolunteerStatus") {
    const userId = formData.get("userId");
    const isVolunteer = formData.get("isVolunteer");
    try {
      await updateUserVolunteerStatus(Number(userId), isVolunteer === "true");

      logger.info(
        `[User: ${roleUser.userId}] Updated volunteer status for user ${userId} to ${isVolunteer}`,
        {
          url: request.url,
        }
      );

      return {
        success: true,
        message: "Volunteer status updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating volunteer status: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update volunteer status",
      };
    }
  }

  if (actionType === "updateAdminStatus") {
    const userId = formData.get("userId");
    const makeAdmin = formData.get("makeAdmin");
    try {
      if (makeAdmin === "true") {
        await makeUserAdmin(Number(userId));
        logger.info(
          `[User: ${roleUser.userId}] Granted admin status to user ${userId}`,
          {
            url: request.url,
          }
        );
      } else {
        await removeUserAdmin(Number(userId), roleUser.userId);
        logger.info(
          `[User: ${roleUser.userId}] Removed admin status from user ${userId}`,
          {
            url: request.url,
          }
        );
      }

      return {
        success: true,
        message: "Admin status updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating admin status: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update admin status",
      };
    }
  }

  if (actionType === "revokeMembership") {
    const userId = formData.get("userId");
    const customMessage = String(formData.get("customMessage") ?? "").trim();
    if (!customMessage) {
      return {
        success: false,
        message: "A custom message is required to revoke membership.",
      };
    }
    try {
      const result = await revokeUserMembershipByAdmin(
        Number(userId),
        customMessage
      );

      logger.info(
        `[User: ${roleUser.userId}] Revoked membership for user ${userId} (affected memberships: ${result.affectedMemberships})`,
        {
          url: request.url,
          targetUserId: userId,
          affectedMemberships: result.affectedMemberships,
          planTitles: result.planTitles,
        }
      );

      return {
        success: true,
        message: result.alreadyRevoked
          ? "User was already revoked."
          : `Membership revoked successfully.${
              result.affectedMemberships > 0
                ? ` ${result.affectedMemberships} subscription(s) closed.`
                : ""
            }`,
      };
    } catch (error) {
      logger.error(`Error revoking membership: ${error}`, {
        userId: roleUser.userId,
        targetUserId: userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to revoke membership",
      };
    }
  }

  if (actionType === "unrevokeMembership") {
    const userId = formData.get("userId");
    try {
      const result = await unrevokeUserMembershipByAdmin(Number(userId));

      logger.info(
        `[User: ${roleUser.userId}] Unrevoked membership access for user ${userId}`,
        {
          url: request.url,
          targetUserId: userId,
        }
      );

      return {
        success: result.restored,
        message: result.restored
          ? "Membership access restored. The user can subscribe again."
          : "User membership access was not revoked.",
      };
    } catch (error) {
      logger.error(`Error unrevoking membership: ${error}`, {
        userId: roleUser.userId,
        targetUserId: userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to restore membership access",
      };
    }
  }

  if (actionType === "retryBrivoSync") {
    const userId = formData.get("userId");
    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    try {
      await syncUserDoorAccess(Number(userId));

      logger.info(
        `[User: ${roleUser.userId}] Retried Brivo sync for user ${userId}`,
        {
          url: request.url,
          targetUserId: userId,
        }
      );

      return {
        success: true,
        message: "Brivo sync retried successfully. The page will refresh to show updated status.",
      };
    } catch (error) {
      logger.error(`Error retrying Brivo sync: ${error}`, {
        userId: roleUser.userId,
        targetUserId: userId,
        url: request.url,
      });
      return {
        success: false,
        message: `Failed to retry sync: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  if (actionType === "updateVolunteerHourStatus") {
    const hourId = formData.get("hourId");
    const newStatus = formData.get("newStatus");
    try {
      await updateVolunteerHourStatus(Number(hourId), String(newStatus));

      logger.info(
        `[User: ${roleUser.userId}] Updated volunteer hour status for hour ${hourId} to ${newStatus}`,
        {
          url: request.url,
        }
      );

      return {
        success: true,
        message: "Volunteer hour status updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating volunteer hour status: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update volunteer hour status",
      };
    }
  }

  if (actionType === "updateWorkshopCancellationResolved") {
    const cancellationId = formData.get("cancellationId");
    const resolved = formData.get("resolved");
    try {
      await updateWorkshopCancellationResolved(
        Number(cancellationId),
        resolved === "true"
      );

      logger.info(
        `[User: ${roleUser.userId}] Updated workshop cancellation resolved status for cancellation ${cancellationId} to ${resolved}`,
        {
          url: request.url,
        }
      );

      return {
        success: true,
        message: "Workshop cancellation status updated successfully",
      };
    } catch (error) {
      logger.error(`Error updating workshop cancellation status: ${error}`, {
        userId: roleUser.userId,
        url: request.url,
      });
      return {
        success: false,
        message: "Failed to update workshop cancellation status",
      };
    }
  }

  if (actionType === "updateEquipmentCancellationResolved") {
    const cancellationId = Number(formData.get("cancellationId"));
    const resolved = formData.get("resolved") === "true";

    try {
      await updateEquipmentCancellationResolved(cancellationId, resolved);
      return redirect("/dashboard/admin/settings?tab=cancelledEvents");
    } catch (error) {
      return {
        errors: {
          message: "Failed to update cancellation status",
        },
      };
    }
  }

  if (actionType === "generateAccessToken") {
    const selectedEquipment = formData.get("selectedEquipment") as string;
    const deviceTag = formData.get("deviceTag") as string;
    if (!selectedEquipment || !deviceTag) {
      return {
        success: false,
        message: "Please select equipment or door and enter a tag value.",
      };
    }

    const payload = {
      isDoor: selectedEquipment === "Door",
      type: selectedEquipment,
      tag: deviceTag.trim(),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      algorithm: "HS256",
    });

    return {
      success: true,
      token,
      message: "Access token generated successfully",
    };
  }

  if (actionType === "getAccessCardInfo") {
    const cardUUID = formData.get("cardUUID") as string;
    if (!cardUUID) {
      return {
        success: false,
        message: "Please enter a card UUID.",
      };
    }

    const accessCard = await getAccessCardByUUID(cardUUID);

    // If no card found, return default “unassigned” object
    const resultCard = accessCard ?? {
      id: cardUUID,
      userId: null,
      registeredAt: null,
      updatedAt: new Date(),
      permissions: [],
      status: "unassigned",
    };

    return {
      success: true,
      accessCard: resultCard,
      message: accessCard
        ? "Fetched Access Card Details successfully"
        : "No card found — showing unassigned card",
      accessCardExists: !!accessCard,
    };
  }
if (actionType === "updateAccessCard") {
  const cardUUID = formData.get("cardUUID") as string;
  const email = formData.get("email") as string | null;
  const permissionsRaw = formData.get("permissions") as string; // single JSON string

  if (!cardUUID) return { success: false, message: "Card UUID is required." };

  let permissions: number[] = [];
  try {
    permissions = JSON.parse(permissionsRaw);
  } catch {
    permissions = [];
  }

  try {
    await updateAccessCard(cardUUID, email || null, permissions);

    return {
      success: true,
      message: "Access Card updated successfully",
    };
  } catch (error) {
    logger.error(`Error updating access card: ${error}`, {
      url: request.url,
      cardUUID,
    });
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update Access Card",
    };
  }
}


  logger.warn(`[User: ${roleUser.userId}] Unknown actionType: ${actionType}`, {
    url: request.url,
  });

  return null;
}

/**
 * RoleControl component:
 * - Displays the user's current role level (read-only).
 * - If the user's roleLevel is 3, it shows a button:
 *    - "Allow Level 4" if allowLevel4 is false.
 *    - "Revoke Level 4" if allowLevel4 is true.
 * The ConfirmButton calls the updateAllowLevel4 action which now updates both allowLevel4 and roleLevel.
 */
function RoleControl({
  user,
}: {
  user: { id: number; roleLevel: number; allowLevel4: boolean };
}) {
  const [allowLevel4, setAllowLevel4] = useState<boolean>(user.allowLevel4);
  const submit = useSubmit();

  const updateAllow = (newAllow: boolean) => {
    const formData = new FormData();
    formData.append("actionType", "updateAllowLevel4");
    formData.append("userId", user.id.toString());
    formData.append("allowLevel4", newAllow.toString());
    submit(formData, { method: "post" });
    setAllowLevel4(newAllow);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{user.roleLevel}</span>
      {allowLevel4 ? (
        <ConfirmButton
          confirmTitle="Confirm Revoke Level 4"
          confirmDescription="Are you sure you want to revoke Level 4 for this user? This will remove the extra privileges."
          onConfirm={() => updateAllow(false)}
          buttonLabel="Revoke Level 4"
          buttonClassName="bg-red-500 hover:bg-red-600 text-white"
        />
      ) : (
        user.roleLevel === 3 && (
          <ConfirmButton
            confirmTitle="Confirm Enable Level 4"
            confirmDescription="Are you sure you want to enable Level 4 for this user? This will grant extra privileges."
            onConfirm={() => updateAllow(true)}
            buttonLabel="Allow Level 4"
            buttonClassName="bg-green-500 hover:bg-green-600 text-white"
          />
        )
      )}
    </div>
  );
}

/**
 * AdminControl component:
 * - Displays the user's current admin status.
 * - Shows "Make Admin" button if user is not admin.
 * - Shows "Remove Admin" button if user is admin.
 * Uses ConfirmButton with POST to updateAdminStatus.
 */
function AdminControl({
  user,
}: {
  user: { id: number; roleUser: { name: string } };
}) {
  const isAdmin = user.roleUser.name === "Admin";
  const submit = useSubmit();

  const updateAdminStatus = (makeAdmin: boolean) => {
    const formData = new FormData();
    formData.append("actionType", "updateAdminStatus");
    formData.append("userId", user.id.toString());
    formData.append("makeAdmin", makeAdmin.toString());
    submit(formData, { method: "post" });
  };

  return (
    <div className="flex items-center gap-2">
      {isAdmin ? (
        <ConfirmButton
          confirmTitle="Confirm Remove Admin"
          confirmDescription="Are you sure you want to remove admin privileges from this user?"
          onConfirm={() => updateAdminStatus(false)}
          buttonLabel="Remove Admin"
          buttonClassName="bg-red-500 hover:bg-red-600 text-white"
        />
      ) : (
        <ConfirmButton
          confirmTitle="Confirm Make Admin"
          confirmDescription="Are you sure you want to grant admin privileges to this user? They will have full administrative access."
          onConfirm={() => updateAdminStatus(true)}
          buttonLabel="Make Admin"
          buttonClassName="bg-green-500 hover:bg-green-600 text-white"
        />
      )}
    </div>
  );
}

function DoorAccessStatus({
  user,
}: {
  user: {
    id: number;
    roleLevel: number;
    membershipStatus: string;
    brivoPersonId?: string | null;
    brivoLastSyncedAt?: string | Date | null;
    brivoSyncError?: string | null;
  };
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const submit = useSubmit();

  const eligible = user.roleLevel >= 4 && user.membershipStatus !== "revoked";
  let badgeVariant: "secondary" | "outline" | "destructive" = "outline";
  let badgeLabel = "Disabled";

  if (user.brivoSyncError) {
    badgeVariant = "destructive";
    badgeLabel = "Sync Error";
  } else if (!eligible) {
    badgeVariant = "outline";
    badgeLabel = "Disabled";
  } else if (user.brivoPersonId) {
    badgeVariant = "secondary";
    badgeLabel = "Provisioned";
  } else {
    badgeVariant = "outline";
    badgeLabel = "Pending Sync";
  }

  const lastSynced =
    user.brivoLastSyncedAt && !Number.isNaN(new Date(user.brivoLastSyncedAt).getTime())
      ? new Date(user.brivoLastSyncedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

  const handleRetry = () => {
    setIsRetrying(true);
    const formData = new FormData();
    formData.append("actionType", "retryBrivoSync");
    formData.append("userId", user.id.toString());
    submit(formData, { method: "post" });
    setDialogOpen(false);
    setTimeout(() => setIsRetrying(false), 2000);
  };

  const badge = user.brivoSyncError ? (
    <button
      onClick={() => setDialogOpen(true)}
      className="cursor-pointer hover:opacity-80 transition-opacity"
      type="button"
    >
      <Badge variant={badgeVariant}>{badgeLabel}</Badge>
    </button>
  ) : (
    <Badge variant={badgeVariant}>{badgeLabel}</Badge>
  );

  return (
    <>
      <div className="space-y-1">
        {badge}
        {user.brivoSyncError ? (
          <p className="text-xs text-destructive">Click badge for details</p>
        ) : (
          <p className="text-xs text-gray-500">
            {eligible
              ? user.brivoPersonId
                ? "24/7 access active"
                : "Eligible – syncing shortly"
              : "Not eligible (role < 4 or membership revoked)"}
          </p>
        )}
        {lastSynced && !user.brivoSyncError && (
          <p className="text-xs text-gray-500">Last sync: {lastSynced}</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brivo Sync Error</DialogTitle>
            <DialogDescription>
              There was an error syncing this user's door access with Brivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold">Error Details:</Label>
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-mono break-words">
                  {user.brivoSyncError}
                </p>
              </div>
            </div>
            {lastSynced && (
              <div>
                <Label className="text-sm font-semibold">Last Successful Sync:</Label>
                <p className="text-sm text-gray-600 mt-1">{lastSynced}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isRetrying}
            >
              Close
            </Button>
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Sync
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * MembershipControl component:
 * - Shows "Revoke Membership" button for all users.
 * - Immediately revokes all active memberships with no refund.
 * Uses ConfirmButton with POST to revokeMembership.
 */
function MembershipControl({
  user,
}: {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    hasRevocableMembership: boolean;
    membershipStatus: "active" | "revoked";
    membershipRevokedAt: Date | null;
    membershipRevokedReason: string | null;
  };
}) {
  const submit = useSubmit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [messageError, setMessageError] = useState("");

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setCustomMessage("");
      setMessageError("");
    }
  };

  const handleRevoke = () => {
    if (!customMessage.trim()) {
      setMessageError("Please provide a message for the member.");
      return;
    }
    const formData = new FormData();
    formData.append("actionType", "revokeMembership");
    formData.append("userId", user.id.toString());
    formData.append("customMessage", customMessage.trim());
    submit(formData, { method: "post" });
    setCustomMessage("");
    setMessageError("");
    setDialogOpen(false);
  };

  const handleUnrevoke = () => {
    const formData = new FormData();
    formData.append("actionType", "unrevokeMembership");
    formData.append("userId", user.id.toString());
    submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={
            user.membershipStatus === "revoked" ? "destructive" : "secondary"
          }
        >
          {user.membershipStatus === "revoked" ? "Revoked" : "Allowed"}
        </Badge>
        <span className="text-xs text-gray-500">
          {user.hasRevocableMembership ? "Active membership on file" : "No active membership"}
        </span>
      </div>
      {user.membershipStatus === "revoked" && (
        <div className="text-xs text-gray-600 space-y-1">
          {user.membershipRevokedReason && (
            <p>
              Reason:{" "}
              <span className="font-medium">
                {user.membershipRevokedReason}
              </span>
            </p>
          )}
          {user.membershipRevokedAt && (
            <p>
              Since:{" "}
              {new Date(user.membershipRevokedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {user.membershipStatus === "revoked" ? (
          <ConfirmButton
            confirmTitle="Restore Membership Access"
            confirmDescription={`Allow ${user.firstName} ${user.lastName} to subscribe to memberships again?`}
            onConfirm={handleUnrevoke}
            buttonLabel="Unrevoke"
            buttonClassName="bg-green-500 hover:bg-green-600 text-white"
          />
        ) : (
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Revoke Membership
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Revoke membership for {user.firstName} {user.lastName}
                </DialogTitle>
                <DialogDescription>
                  Provide a message that will be emailed to the member. Explain
                  why access is being revoked. No refunds will be issued.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor={`revoke-message-${user.id}`}>
                  Custom message
                </Label>
                <Textarea
                  id={`revoke-message-${user.id}`}
                  rows={4}
                  value={customMessage}
                  onChange={(event) => {
                    setCustomMessage(event.target.value);
                    if (messageError) {
                      setMessageError("");
                    }
                  }}
                  placeholder="Describe why membership access is being revoked..."
                />
                {messageError && (
                  <p className="text-sm text-red-500">{messageError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDialogOpen(false);
                    setMessageError("");
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRevoke}>
                  Revoke Membership
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// For volunteer control, this component allows toggling volunteer status
function VolunteerControl({
  user,
}: {
  user: {
    id: number;
    isVolunteer: boolean;
    volunteerSince: Date | null;
    volunteerHistory?: Array<{
      id: number;
      volunteerStart: Date;
      volunteerEnd: Date | null;
    }>;
  };
}) {
  // Use the actual data from the server instead of maintaining separate state
  const isActuallyVolunteer = user.isVolunteer;

  const [isVolunteer, setIsVolunteer] = useState<boolean>(isActuallyVolunteer);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<boolean>(false);
  const submit = useSubmit();

  // Update local state when the actual data changes (important for pagination)
  React.useEffect(() => {
    setIsVolunteer(isActuallyVolunteer);
  }, [isActuallyVolunteer, user.id]); // Include user.id to reset when user changes

  const updateVolunteerStatus = (newStatus: boolean) => {
    const formData = new FormData();
    formData.append("actionType", "updateVolunteerStatus");
    formData.append("userId", user.id.toString());
    formData.append("isVolunteer", newStatus.toString());
    submit(formData, { method: "post" });
    setIsVolunteer(newStatus);
    setShowConfirmDialog(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    setPendingStatus(checked);
    setShowConfirmDialog(true);
  };

  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={isVolunteer}
        onChange={(e) => handleCheckboxChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
        id={`volunteer-${user.id}`}
      />
      <label
        htmlFor={`volunteer-${user.id}`}
        className="ml-2 text-sm text-gray-600"
      >
        Volunteer
      </label>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus
                ? "Start Volunteer Period"
                : "End Volunteer Period"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus
                ? "Are you sure you want to start a new volunteer period for this user? This will mark them as an active volunteer."
                : "Are you sure you want to end the volunteer period for this user? This will mark their current volunteer period as ended."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateVolunteerStatus(pendingStatus)}
            >
              {pendingStatus ? "Start Volunteer" : "End Volunteer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// For settings that need pagination, this component provides a simple pagination UI
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 10,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}) {
  const getVisiblePageNumbers = () => {
    // If total pages is less than or equal to max visible, show all
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const delta = Math.floor(maxVisiblePages / 2) - 1;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push("...", totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center space-x-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1"
      >
        Previous
      </Button>

      {getVisiblePageNumbers().map((page, index) => (
        <React.Fragment key={index}>
          {page === "..." ? (
            <span className="px-2 py-1 text-gray-500">...</span>
          ) : (
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 ${
                currentPage === page
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                  : ""
              }`}
            >
              {page}
            </Button>
          )}
        </React.Fragment>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1"
      >
        Next
      </Button>
    </div>
  );
}

const WorkshopCancellationsPagination = ({
  currentPage,
  totalPages,
  setCurrentPage,
}: {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-500">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNumber;
          if (totalPages <= 5) {
            pageNumber = i + 1;
          } else if (currentPage <= 3) {
            pageNumber = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNumber = totalPages - 4 + i;
          } else {
            pageNumber = currentPage - 2 + i;
          }

          return (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(pageNumber)}
              className="w-8 h-8"
            >
              {pageNumber}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

// For volunteer hour status control, this component allows changing the status of volunteer hours
function VolunteerHourStatusControl({
  hour,
}: {
  hour: {
    id: number;
    status: string;
    isResubmission?: boolean;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}) {
  const [status, setStatus] = useState<string>(hour.status);
  // Sync local state with prop changes from server
  React.useEffect(() => {
    setStatus(hour.status);
  }, [hour.status]);

  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingNewStatus, setPendingNewStatus] = useState<string>("");
  const submit = useSubmit();

  const updateStatus = (newStatus: string) => {
    const formData = new FormData();
    formData.append("actionType", "updateVolunteerHourStatus");
    formData.append("hourId", hour.id.toString());
    formData.append("newStatus", newStatus);
    submit(formData, { method: "post" });
    // Don't update local state immediately - let the server response handle it
    setShowConfirmDialog(false);
  };

  const handleStatusChange = (newStatus: string) => {
    // If the status is the same, no confirmation needed
    if (newStatus === status) {
      return;
    }

    // Show confirmation for any status change
    setPendingNewStatus(newStatus);
    setShowConfirmDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "denied":
        return "bg-red-100 text-red-800";
      case "resolved":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-indigo-100 text-indigo-800";
    }
  };

  const getStatusDisplayName = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getConfirmationMessage = (newStatus: string) => {
    const userName = `${hour.user.firstName} ${hour.user.lastName}`;
    const currentStatusName = getStatusDisplayName(status);
    const newStatusName = getStatusDisplayName(newStatus);

    switch (newStatus) {
      case "approved":
        return `Are you sure you want to change ${userName}'s volunteer hours from ${currentStatusName} to Approved? This will mark their submission as approved.`;
      case "denied":
        return `Are you sure you want to change ${userName}'s volunteer hours from ${currentStatusName} to Denied? This will reject their submission.`;
      case "resolved":
        return `Are you sure you want to change ${userName}'s volunteer hours from ${currentStatusName} to Resolved? This typically means the issue has been addressed.`;
      case "pending":
        return `Are you sure you want to change ${userName}'s volunteer hours from ${currentStatusName} to Pending? This will mark their submission as pending review.`;
      default:
        return `Are you sure you want to change the status from ${currentStatusName} to ${newStatusName}?`;
    }
  };

  const getActionButtonColor = (newStatus: string) => {
    switch (newStatus) {
      case "denied":
        return "bg-red-600 hover:bg-red-700";
      case "approved":
        return "bg-green-600 hover:bg-green-700";
      case "resolved":
        return "bg-purple-600 hover:bg-purple-700";
      case "pending":
        return "bg-indigo-600 hover:bg-indigo-700";
      default:
        return "bg-blue-600 hover:bg-blue-700";
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className={`px-2 py-1 rounded-full text-xs font-medium border-0 text-center ${getStatusColor(
            status
          )}`}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm Status Change to {getStatusDisplayName(pendingNewStatus)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmationMessage(pendingNewStatus)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateStatus(pendingNewStatus)}
              className={getActionButtonColor(pendingNewStatus)}
            >
              Change to {getStatusDisplayName(pendingNewStatus)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WorkshopCancellationResolvedControl({
  cancellation,
}: {
  cancellation: {
    id: number;
    resolved: boolean;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}) {
  const [resolved, setResolved] = useState<boolean>(cancellation.resolved);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<boolean>(false);
  const submit = useSubmit();

  // Update local state when the actual data changes
  React.useEffect(() => {
    setResolved(cancellation.resolved);
  }, [cancellation.resolved, cancellation.id]);

  const updateResolvedStatus = (newStatus: boolean) => {
    const formData = new FormData();
    formData.append("actionType", "updateWorkshopCancellationResolved");
    formData.append("cancellationId", cancellation.id.toString());
    formData.append("resolved", newStatus.toString());
    submit(formData, { method: "post" });
    setResolved(newStatus);
    setShowConfirmDialog(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    setPendingStatus(checked);
    setShowConfirmDialog(true);
  };

  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={resolved}
        onChange={(e) => handleCheckboxChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
        id={`resolved-${cancellation.id}`}
      />
      <label
        htmlFor={`resolved-${cancellation.id}`}
        className="ml-2 text-sm text-gray-600"
      >
        Resolved
      </label>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus ? "Mark as Resolved" : "Mark as Unresolved"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus
                ? "Are you sure you want to mark this workshop cancellation as resolved? This indicates the user's situation has been dealt with."
                : "Are you sure you want to mark this workshop cancellation as unresolved? This indicates the user's situation still needs attention."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateResolvedStatus(pendingStatus)}
            >
              {pendingStatus ? "Mark Resolved" : "Mark Unresolved"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const EquipmentCancellationsPagination = ({
  currentPage,
  totalPages,
  setCurrentPage,
}: {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-500">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </Button>

        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNumber;
          if (totalPages <= 5) {
            pageNumber = i + 1;
          } else if (currentPage <= 3) {
            pageNumber = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNumber = totalPages - 4 + i;
          } else {
            pageNumber = currentPage - 2 + i;
          }

          return (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? "default" : "outline"}
              size="sm"
              onClick={() => setCurrentPage(pageNumber)}
              className="w-8 h-8"
            >
              {pageNumber}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

function EquipmentCancellationResolvedControl({
  cancellation,
}: {
  cancellation: any;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const submit = useSubmit();

  const handleResolvedToggle = () => {
    const formData = new FormData();
    formData.append("actionType", "updateEquipmentCancellationResolved");
    formData.append("cancellationId", cancellation.id.toString());
    formData.append("resolved", (!cancellation.resolved).toString());

    submit(formData, { method: "post" });
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={cancellation.resolved}
          onChange={() => setIsDialogOpen(true)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="ml-2 text-sm">Resolved</span>
      </div>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancellation.resolved
                ? "Mark as Unresolved"
                : "Mark as Resolved"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancellation.resolved
                ? "Are you sure you want to mark this equipment cancellation as unresolved? This will move it back to the unresolved list."
                : "Are you sure you want to mark this equipment cancellation as resolved? This indicates that any necessary refunds or actions have been completed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolvedToggle}>
              {cancellation.resolved ? "Mark Unresolved" : "Mark Resolved"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
export default function AdminSettings() {
  const {
    settings,
    workshops,
    users,
    volunteerHours,
    recentVolunteerActions,
    workshopCancellations,
    equipmentCancellations,
    allEquipments,
  } = useLoaderData<{
    settings: {
      workshopVisibilityDays: number;
      pastWorkshopVisibility: number;
      equipmentVisibilityDays: number;
      level3Schedule: {
        [day: string]: { start: number; end: number; closed?: boolean };
      };
      level4UnavailableHours: {
        start: number;
        end: number;
      };
      plannedClosures: Array<{
        id: number;
        startDate: string;
        endDate: string;
      }>;
      maxEquipmentSlotsPerDay: number;
      maxEquipmentSlotsPerWeek: number;
      gstPercentage: number;
    };
    workshops: Array<{
      id: number;
      name: string;
      price: number;
      registrationCutoff: number;
      hasActiveOccurrences: boolean;
    }>;
    users: Array<{
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      trainingCardUserNumber: string;
      roleLevel: number;
      allowLevel4: boolean;
      roleUser: { name: string };
      isVolunteer: boolean;
      volunteerSince: Date | null;
      volunteerHistory?: Array<{
        id: number;
        volunteerStart: Date;
        volunteerEnd: Date | null;
      }>;
      hasRevocableMembership: boolean;
      membershipStatus: "active" | "revoked";
      membershipRevokedAt: Date | null;
      membershipRevokedReason: string | null;
      brivoPersonId?: string | null;
      brivoLastSyncedAt?: Date | string | null;
      brivoSyncError?: string | null;
    }>;
    volunteerHours: Array<{
      id: number;
      userId: number;
      startTime: string;
      endTime: string;
      description: string | null;
      status: string;
      isResubmission: boolean;
      createdAt: string;
      updatedAt: string;
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
    }>;
    recentVolunteerActions: Array<{
      id: number;
      userId: number;
      startTime: string;
      endTime: string;
      description: string | null;
      status: string;
      previousStatus: string | null;
      isResubmission: boolean;
      createdAt: string;
      updatedAt: string;
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
    }>;
    workshopCancellations: Array<{
      id: number;
      userId: number;
      workshopId: number;
      workshopOccurrenceId: number;
      registrationDate: string;
      cancellationDate: string;
      resolved: boolean;
      createdAt: string;
      updatedAt: string;
      stripePaymentIntentId: string | null;
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
      workshop: {
        id: number;
        name: string;
        type: string;
      };
      workshopOccurrence: {
        id: number;
        startDate: string;
        endDate: string;
        connectId: number | null;
      };
      priceVariation: {
        id: number;
        name: string;
        price: number;
      } | null;
      allOccurrences?: Array<any>;
    }>;
    equipmentCancellations: Array<{
      id: number;
      userId: number;
      equipmentId: number;
      paymentIntentId: string | null;
      totalSlotsBooked: number;
      slotsRefunded: number;
      totalPricePaid: number;
      priceToRefund: number;
      cancellationDate: string;
      eligibleForRefund: boolean;
      resolved: boolean;
      cancelledSlotTimes: Array<{
        startTime: string;
        endTime: string;
        slotId: number;
      }>;
      createdAt: string;
      updatedAt: string;
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
      equipment: {
        id: number;
        name: string;
        price: number;
      };
    }>;
    allEquipments: Array<{
      id: number;
      name: string;
      description: string | null;
      imageUrl: string | null;
      availability: boolean;
      totalSlots: number;
      bookedSlots: number;
      status: string;
    }>;
  }>();

  const actionData = useActionData<{
    success?: boolean;
    message?: string;
    token?: string;
    accessCard?: AccessCard | null;
    accessCardExists?: boolean;
  }>();

  const submit = useSubmit();

  const [workshopVisibilityDays, setWorkshopVisibilityDays] = useState(
    settings.workshopVisibilityDays.toString()
  );
  const [pastWorkshopVisibility, setPastWorkshopVisibility] = useState(
    settings.pastWorkshopVisibility.toString()
  );
  const [equipmentVisibilityDays, setEquipmentVisibilityDays] = useState(
    settings.equipmentVisibilityDays.toString()
  );

  const [maxEquipmentSlotsPerDay, setMaxEquipmentSlotsPerDay] = useState({
    value: settings.maxEquipmentSlotsPerDay, // In slots
    unit: "slots",
  });

  const [maxEquipmentSlotsPerWeek, setMaxEquipmentSlotsPerWeek] = useState({
    value: settings.maxEquipmentSlotsPerWeek, // Weekly slots are stored as slot count
    unit: "slots",
  });

  const [gstPercentage, setGstPercentage] = useState(
    settings.gstPercentage.toString()
  );

  const [level3Schedule, setLevel3Schedule] = useState(() => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const defaultSchedule = days.reduce(
      (acc, day) => {
        acc[day] = { start: 9, end: 17, closed: false };
        return acc;
      },
      {} as Record<string, { start: number; end: number; closed: boolean }>
    );

    // Merge the default with settings from the server
    return days.reduce((acc, day) => {
      acc[day] = {
        start: settings.level3Schedule[day]?.start ?? 9,
        end: settings.level3Schedule[day]?.end ?? 17,
        closed: settings.level3Schedule[day]?.closed ?? false,
      };
      return acc;
    }, defaultSchedule);
  });
  const [editingDay, setEditingDay] = useState<string | null>(null);

  const [level4UnavailableHours, setLevel4UnavailableHours] = useState({
    start: settings.level4UnavailableHours?.start ?? 0,
    end: settings.level4UnavailableHours?.end ?? 0,
  });
  const [editingLevel4Hours, setEditingLevel4Hours] = useState(false);

  const [editingWorkshop, setEditingWorkshop] = useState<number | null>(null);
  const [cutoffValues, setCutoffValues] = useState<Record<number, number>>({});
  const [cutoffUnits, setCutoffUnits] = useState<Record<number, string>>({});


  // Volunteer hours management state
  const [volunteerSearchName, setVolunteerSearchName] = useState("");
  const [volunteerFromDate, setVolunteerFromDate] = useState("");
  const [volunteerFromTime, setVolunteerFromTime] = useState("");
  const [volunteerToDate, setVolunteerToDate] = useState("");
  const [volunteerToTime, setVolunteerToTime] = useState("");
  const [appliedVolunteerFromDate, setAppliedVolunteerFromDate] = useState("");
  const [appliedVolunteerFromTime, setAppliedVolunteerFromTime] = useState("");
  const [appliedVolunteerToDate, setAppliedVolunteerToDate] = useState("");
  const [appliedVolunteerToTime, setAppliedVolunteerToTime] = useState("");
  const [volunteerCurrentPage, setVolunteerCurrentPage] = useState(1);
  const [volunteerHoursPerPage] = useState(10);
  const [actionsCurrentPage, setActionsCurrentPage] = useState(1);
  const [actionsPerPage] = useState(10);

  // Workshop cancellations
  const [unresolvedCurrentPage, setUnresolvedCurrentPage] = useState(1);
  const [resolvedCurrentPage, setResolvedCurrentPage] = useState(1);
  const [workshopCancellationsPerPage] = useState(10);

  // Equipment cancellations pagination
  const [equipmentUnresolvedCurrentPage, setEquipmentUnresolvedCurrentPage] =
    useState(1);
  const [equipmentResolvedCurrentPage, setEquipmentResolvedCurrentPage] =
    useState(1);
  const [equipmentCancellationsPerPage] = useState(10);

  // Unresolved and resolved workshop cancellations
  const unresolvedCancellations = workshopCancellations.filter(
    (cancellation: any) => !cancellation.resolved
  );
  const resolvedCancellations = workshopCancellations.filter(
    (cancellation: any) => cancellation.resolved
  );

  const unresolvedTotalPages = Math.ceil(
    unresolvedCancellations.length / workshopCancellationsPerPage
  );
  const unresolvedStartIndex =
    (unresolvedCurrentPage - 1) * workshopCancellationsPerPage;
  const unresolvedEndIndex =
    unresolvedStartIndex + workshopCancellationsPerPage;
  const paginatedUnresolvedCancellations = unresolvedCancellations.slice(
    unresolvedStartIndex,
    unresolvedEndIndex
  );

  const resolvedTotalPages = Math.ceil(
    resolvedCancellations.length / workshopCancellationsPerPage
  );
  const resolvedStartIndex =
    (resolvedCurrentPage - 1) * workshopCancellationsPerPage;
  const resolvedEndIndex = resolvedStartIndex + workshopCancellationsPerPage;
  const paginatedResolvedCancellations = resolvedCancellations.slice(
    resolvedStartIndex,
    resolvedEndIndex
  );

  // Equipment cancellations pagination logic
  const equipmentUnresolvedCancellations = equipmentCancellations.filter(
    (cancellation: any) => !cancellation.resolved
  );
  const equipmentResolvedCancellations = equipmentCancellations.filter(
    (cancellation: any) => cancellation.resolved
  );

  const equipmentUnresolvedTotalPages = Math.ceil(
    equipmentUnresolvedCancellations.length / equipmentCancellationsPerPage
  );
  const equipmentUnresolvedStartIndex =
    (equipmentUnresolvedCurrentPage - 1) * equipmentCancellationsPerPage;
  const equipmentUnresolvedEndIndex =
    equipmentUnresolvedStartIndex + equipmentCancellationsPerPage;
  const paginatedEquipmentUnresolvedCancellations =
    equipmentUnresolvedCancellations.slice(
      equipmentUnresolvedStartIndex,
      equipmentUnresolvedEndIndex
    );

  const equipmentResolvedTotalPages = Math.ceil(
    equipmentResolvedCancellations.length / equipmentCancellationsPerPage
  );
  const equipmentResolvedStartIndex =
    (equipmentResolvedCurrentPage - 1) * equipmentCancellationsPerPage;
  const equipmentResolvedEndIndex =
    equipmentResolvedStartIndex + equipmentCancellationsPerPage;
  const paginatedEquipmentResolvedCancellations =
    equipmentResolvedCancellations.slice(
      equipmentResolvedStartIndex,
      equipmentResolvedEndIndex
    );

  // Recent actions filters state
  const [actionsSearchName, setActionsSearchName] = useState("");
  const [actionsFromDate, setActionsFromDate] = useState("");
  const [actionsFromTime, setActionsFromTime] = useState("");
  const [actionsToDate, setActionsToDate] = useState("");
  const [actionsToTime, setActionsToTime] = useState("");
  const [appliedActionsFromDate, setAppliedActionsFromDate] = useState("");
  const [appliedActionsFromTime, setAppliedActionsFromTime] = useState("");
  const [appliedActionsToDate, setAppliedActionsToDate] = useState("");
  const [appliedActionsToTime, setAppliedActionsToTime] = useState("");

  // Security and Access state
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [deviceTag, setDeviceTag] = useState("");
  const [cardUUID, setCardUUID] = useState("");
  const [email, setEmail] = useState(actionData?.accessCard?.userEmail || "");
  const [permissions, setPermissions] = useState<number[]>(
    actionData?.accessCard?.permissions || []
  );

  // Status filters for volunteer hours
  const [volunteerStatusFilter, setVolunteerStatusFilter] =
    useState<string>("pending");

  // Show only resubmissions
  const [showResubmissionsOnly, setShowResubmissionsOnly] = useState(false);

  // Status filters for recent actions
  const [actionsStatusFilter, setActionsStatusFilter] = useState<string>("all");

  // User table filters
  const [adminStatusFilter, setAdminStatusFilter] = useState<string[]>([]);
  const [membershipFilter, setMembershipFilter] = useState<string[]>([]);
  const [doorAccessFilter, setDoorAccessFilter] = useState<string[]>([]);

  // Volunteer management state (for volunteers tab)
  const [searchName, setSearchName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);

  // Filter and sort users for volunteers tab
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return searchName === "" || fullName.includes(searchName.toLowerCase());
    });
  }, [users, searchName]);

  const sortedFilteredUsers = useMemo(() => {
    return filteredUsers.slice().sort((a, b) => {
      return a.lastName.localeCompare(b.lastName);
    });
  }, [filteredUsers]);

  const totalPages = Math.ceil(sortedFilteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const paginatedUsers = sortedFilteredUsers.slice(startIndex, endIndex);

  // Helper function to generate time options
  const generateVolunteerTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        const formattedHour = hour.toString().padStart(2, "0");
        const formattedMinute = minute.toString().padStart(2, "0");
        options.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    return options;
  };

  // Filter volunteer hours
  const filteredVolunteerHours = useMemo(() => {
    return volunteerHours.filter((hour) => {
      // Name filter
      const fullName =
        `${hour.user.firstName} ${hour.user.lastName}`.toLowerCase();
      const nameMatch =
        volunteerSearchName === "" ||
        fullName.includes(volunteerSearchName.toLowerCase());

      // Status filter
      let statusMatch = true;
      if (showResubmissionsOnly) {
        // When "Show resubmissions and denied hours only" is checked,
        // only show pending resubmissions and denied hours
        statusMatch =
          (hour.status === "pending" && hour.isResubmission) ||
          hour.status === "denied";
      } else {
        // Normal status filtering when checkbox is unchecked
        statusMatch =
          volunteerStatusFilter === "all" ||
          hour.status === volunteerStatusFilter;
      }

      // Date/time range filtering
      let dateTimeMatch = true;
      if (
        appliedVolunteerFromDate &&
        appliedVolunteerFromTime &&
        appliedVolunteerToDate &&
        appliedVolunteerToTime
      ) {
        const entryStartDate = new Date(hour.startTime);
        const fromDateTime = new Date(
          `${appliedVolunteerFromDate}T${appliedVolunteerFromTime}`
        );
        const toDateTime = new Date(
          `${appliedVolunteerToDate}T${appliedVolunteerToTime}`
        );
        dateTimeMatch =
          entryStartDate >= fromDateTime && entryStartDate < toDateTime;
      }

      return nameMatch && statusMatch && dateTimeMatch;
    });
  }, [
    volunteerHours,
    volunteerSearchName,
    volunteerStatusFilter,
    showResubmissionsOnly,
    appliedVolunteerFromDate,
    appliedVolunteerFromTime,
    appliedVolunteerToDate,
    appliedVolunteerToTime,
  ]);

  // Sort and paginate volunteer hours
  const sortedVolunteerHours = useMemo(() => {
    return filteredVolunteerHours
      .slice()
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
  }, [filteredVolunteerHours]);

  const volunteerTotalPages = Math.ceil(
    sortedVolunteerHours.length / volunteerHoursPerPage
  );
  const volunteerStartIndex =
    (volunteerCurrentPage - 1) * volunteerHoursPerPage;
  const volunteerEndIndex = volunteerStartIndex + volunteerHoursPerPage;
  const paginatedVolunteerHours = sortedVolunteerHours.slice(
    volunteerStartIndex,
    volunteerEndIndex
  );

  // Filter recent actions
  const filteredRecentActions = useMemo(() => {
    return recentVolunteerActions.filter((action) => {
      // Name filter
      const fullName =
        `${action.user.firstName} ${action.user.lastName}`.toLowerCase();
      const nameMatch =
        actionsSearchName === "" ||
        fullName.includes(actionsSearchName.toLowerCase());

      // Status filter
      const statusMatch =
        actionsStatusFilter === "all" || action.status === actionsStatusFilter;

      // Date/time range filtering
      let dateTimeMatch = true;
      if (
        appliedActionsFromDate &&
        appliedActionsFromTime &&
        appliedActionsToDate &&
        appliedActionsToTime
      ) {
        const entryStartDate = new Date(action.startTime);
        const fromDateTime = new Date(
          `${appliedActionsFromDate}T${appliedActionsFromTime}`
        );
        const toDateTime = new Date(
          `${appliedActionsToDate}T${appliedActionsToTime}`
        );
        dateTimeMatch =
          entryStartDate >= fromDateTime && entryStartDate < toDateTime;
      }

      return nameMatch && statusMatch && dateTimeMatch;
    });
  }, [
    recentVolunteerActions,
    actionsSearchName,
    actionsStatusFilter,
    appliedActionsFromDate,
    appliedActionsFromTime,
    appliedActionsToDate,
    appliedActionsToTime,
  ]);

  // Handle recent actions search
  const handleActionsSearch = () => {
    setAppliedActionsFromDate(actionsFromDate);
    setAppliedActionsFromTime(actionsFromTime);
    setAppliedActionsToDate(actionsToDate);
    setAppliedActionsToTime(actionsToTime);
  };

  // Handle clear actions filters
  const handleClearActionsFilters = () => {
    setActionsSearchName("");
    setActionsStatusFilter("all"); // Reset to default
    setActionsFromDate("");
    setActionsFromTime("");
    setActionsToDate("");
    setActionsToTime("");
    setAppliedActionsFromDate("");
    setAppliedActionsFromTime("");
    setAppliedActionsToDate("");
    setAppliedActionsToTime("");
  };

  // Sort and paginate recent actions
  const sortedRecentActions = useMemo(() => {
    return filteredRecentActions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [filteredRecentActions]);

  const actionsTotalPages = Math.ceil(
    sortedRecentActions.length / actionsPerPage
  );
  const actionsStartIndex = (actionsCurrentPage - 1) * actionsPerPage;
  const actionsEndIndex = actionsStartIndex + actionsPerPage;
  const paginatedRecentActions = sortedRecentActions.slice(
    actionsStartIndex,
    actionsEndIndex
  );

  // Handle volunteer hours search
  const handleVolunteerSearch = () => {
    setAppliedVolunteerFromDate(volunteerFromDate);
    setAppliedVolunteerFromTime(volunteerFromTime);
    setAppliedVolunteerToDate(volunteerToDate);
    setAppliedVolunteerToTime(volunteerToTime);
  };

  // Handle clear volunteer filters
  const handleClearVolunteerFilters = () => {
    setVolunteerSearchName("");
    setVolunteerStatusFilter("pending"); // Reset to default
    setShowResubmissionsOnly(false);
    setVolunteerFromDate("");
    setVolunteerFromTime("");
    setVolunteerToDate("");
    setVolunteerToTime("");
    setAppliedVolunteerFromDate("");
    setAppliedVolunteerFromTime("");
    setAppliedVolunteerToDate("");
    setAppliedVolunteerToTime("");
  };

  // Reset pagination when filters change
  React.useEffect(() => {
    setVolunteerCurrentPage(1);
  }, [
    volunteerSearchName,
    volunteerStatusFilter,
    appliedVolunteerFromDate,
    appliedVolunteerFromTime,
    appliedVolunteerToDate,
    appliedVolunteerToTime,
  ]);

  React.useEffect(() => {
    setActionsCurrentPage(1);
  }, [recentVolunteerActions]);

  // Reset actions pagination when filters change
  React.useEffect(() => {
    setActionsCurrentPage(1);
  }, [
    actionsSearchName,
    actionsStatusFilter,
    appliedActionsFromDate,
    appliedActionsFromTime,
    appliedActionsToDate,
    appliedActionsToTime,
  ]);

  // Reset workshop cancellations pagination when data changes
  React.useEffect(() => {
    setUnresolvedCurrentPage(1);
  }, [workshopCancellations]);

  React.useEffect(() => {
    setResolvedCurrentPage(1);
  }, [workshopCancellations]);

  // Reset equipment cancellations pagination when data changes
  React.useEffect(() => {
    setEquipmentUnresolvedCurrentPage(1);
  }, [equipmentCancellations]);

  React.useEffect(() => {
    setEquipmentResolvedCurrentPage(1);
  }, [equipmentCancellations]);

  // Update email and permissions when actionData changes
  React.useEffect(() => {
    if (actionData?.accessCard) {
      setEmail(actionData.accessCard.userEmail || "");
      setPermissions(actionData.accessCard.permissions || []);
    }
  }, [actionData?.accessCard?.id]);

  // Helper function to calculate total hours from volunteer hour entries
  const calculateTotalHours = (hours: any[]) => {
    return hours.reduce((total, entry) => {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      const durationMs = end.getTime() - start.getTime();
      const hoursDecimal = durationMs / (1000 * 60 * 60);
      return total + hoursDecimal;
    }, 0);
  };

  // Calculate total hours for filtered volunteer hours
  const totalVolunteerHours = useMemo(() => {
    return calculateTotalHours(filteredVolunteerHours);
  }, [filteredVolunteerHours]);

  // Calculate total hours for filtered recent actions
  const totalRecentActionHours = useMemo(() => {
    return calculateTotalHours(filteredRecentActions);
  }, [filteredRecentActions]);


  const [plannedClosures, setPlannedClosures] = useState(
    settings.plannedClosures.map((closure) => ({
      id: closure.id,
      startDate: new Date(closure.startDate),
      endDate: new Date(closure.endDate),
    }))
  );

  const [newClosure, setNewClosure] = useState(() => {
    // Initialize with today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to midnight

    return {
      startDate: today,
      startTime: "09:00",
      endDate: today, // Same day as start date, not tomorrow
      endTime: "17:00",
    };
  });

  const [validationError, setValidationError] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: "",
    message: "",
  });

  const [weeklyLimitError, setWeeklyLimitError] = useState<string>("");

  const [dailyFormBeingEdited, setDailyFormBeingEdited] =
    useState<boolean>(false);
  const [weeklyFormBeingEdited, setWeeklyFormBeingEdited] =
    useState<boolean>(false);

  // Filter users based on filter states
  const filteredUsersForTable = useMemo(() => {
    return users.filter((user) => {
      // Admin Status filter
      if (adminStatusFilter.length > 0) {
        const userAdminStatus = user.roleUser.name === "Admin" ? "Admin" : "Not Admin";
        if (!adminStatusFilter.includes(userAdminStatus)) return false;
      }

      // Membership filter
      if (membershipFilter.length > 0) {
        const userMembershipStatus = user.membershipStatus === "revoked" ? "Revoked" : "Active";
        if (!membershipFilter.includes(userMembershipStatus)) return false;
      }

      // Door Access filter
      if (doorAccessFilter.length > 0) {
        const eligible = user.roleLevel >= 4 && user.membershipStatus !== "revoked";
        let doorAccessStatus: string;
        if (user.brivoSyncError) {
          doorAccessStatus = "Sync Error";
        } else if (!eligible) {
          doorAccessStatus = "Disabled";
        } else if (user.brivoPersonId) {
          doorAccessStatus = "Provisioned";
        } else {
          doorAccessStatus = "Pending Sync";
        }
        if (!doorAccessFilter.includes(doorAccessStatus)) return false;
      }

      return true;
    });
  }, [users, adminStatusFilter, membershipFilter, doorAccessFilter]);

  // Get unique values for filter options
  const adminStatusOptions = useMemo(() => {
    const admins = users.filter((u) => u.roleUser.name === "Admin").length;
    const notAdmins = users.length - admins;
    return [
      { value: "Admin", count: admins },
      { value: "Not Admin", count: notAdmins },
    ];
  }, [users]);

  const membershipOptions = useMemo(() => {
    const revoked = users.filter((u) => u.membershipStatus === "revoked").length;
    const active = users.length - revoked;
    return [
      { value: "Revoked", count: revoked },
      { value: "Active", count: active },
    ];
  }, [users]);

  const doorAccessOptions = useMemo(() => {
    const counts = {
      "Sync Error": 0,
      "Disabled": 0,
      "Provisioned": 0,
      "Pending Sync": 0,
    };
    users.forEach((user) => {
      const eligible = user.roleLevel >= 4 && user.membershipStatus !== "revoked";
      if (user.brivoSyncError) {
        counts["Sync Error"]++;
      } else if (!eligible) {
        counts["Disabled"]++;
      } else if (user.brivoPersonId) {
        counts["Provisioned"]++;
      } else {
        counts["Pending Sync"]++;
      }
    });
    return Object.entries(counts).map(([value, count]) => ({ value, count }));
  }, [users]);

  // Define columns for the DataTable
  type UserRow = (typeof users)[number];
  const userColumns: ColumnDef<UserRow>[] = [
    {
      header: "First Name",
      accessorKey: "firstName",
      cell: ({ row }: { row: { getValue: (key: string) => string; original: UserRow } }) => (
        <div className="font-medium">{row.getValue("firstName")}</div>
      ),
      size: 120,
    },
    {
      header: "Last Name",
      accessorKey: "lastName",
      cell: ({ row }: { row: { getValue: (key: string) => string; original: UserRow } }) => (
        <div className="font-medium">{row.getValue("lastName")}</div>
      ),
      size: 120,
    },
    {
      header:"Training Card User Number",
    accessorKey: "trainingCardUserNumber",
    cell: ({ row }: { row: { getValue: (key: string) => string; original: UserRow } }) => (
      <div className="font-medium">{row.getValue("trainingCardUserNumber")}</div>
    ),
    size: 120,
  },
    {
      header: "Email",
      accessorKey: "email",
      size: 220,
    },
    {
      header: "Phone Number",
      accessorKey: "phone",
      size: 140,
    },
    {
      header: "Role Level",
      id: "roleLevel",
      cell: ({ row }: { row: { original: UserRow } }) => <RoleControl user={row.original} />,
      size: 200,
      enableSorting: false,
    },
    {
      header: "Admin Status",
      id: "adminStatus",
      accessorFn: (row) => row.roleUser.name === "Admin" ? "Admin" : "Not Admin",
      cell: ({ row }: { row: { original: UserRow } }) => <AdminControl user={row.original} />,
      size: 150,
      enableSorting: false,
      filterFn: (row, id, value) => {
        const status = row.original.roleUser.name === "Admin" ? "Admin" : "Not Admin";
        return value.includes(status);
      },
    },
    {
      header: "Membership",
      id: "membership",
      accessorFn: (row) => row.membershipStatus === "revoked" ? "Revoked" : "Active",
      cell: ({ row }: { row: { original: UserRow } }) => <MembershipControl user={row.original} />,
      size: 200,
      enableSorting: false,
      filterFn: (row, id, value) => {
        const status = row.original.membershipStatus === "revoked" ? "Revoked" : "Active";
        return value.includes(status);
      },
    },
    {
      header: "Door Access",
      id: "doorAccess",
      accessorFn: (row) => {
        const eligible = row.roleLevel >= 4 && row.membershipStatus !== "revoked";
        if (row.brivoSyncError) return "Sync Error";
        if (!eligible) return "Disabled";
        if (row.brivoPersonId) return "Provisioned";
        return "Pending Sync";
      },
      cell: ({ row }: { row: { original: UserRow } }) => <DoorAccessStatus user={row.original} />,
      size: 180,
      enableSorting: false,
      filterFn: (row, id, value) => {
        const eligible = row.original.roleLevel >= 4 && row.original.membershipStatus !== "revoked";
        let status: string;
        if (row.original.brivoSyncError) {
          status = "Sync Error";
        } else if (!eligible) {
          status = "Disabled";
        } else if (row.original.brivoPersonId) {
          status = "Provisioned";
        } else {
          status = "Pending Sync";
        }
        return value.includes(status);
      },
    },
  ];

  // Helper function to convert time units to minutes
  const convertToMinutes = (value: number, unit: string): number => {
    switch (unit) {
      case "hours":
        return value * 60;
      case "days":
        return value * 24 * 60;
      default: // minutes
        return value;
    }
  };

  // Helper function to determine best unit for display
  const getBestUnit = (minutes: number): { value: number; unit: string } => {
    if (minutes >= 1440 && minutes % 1440 === 0) {
      // Divisible by days
      return { value: minutes / 1440, unit: "days" };
    } else if (minutes >= 60 && minutes % 60 === 0) {
      // Divisible by hours
      return { value: minutes / 60, unit: "hours" };
    } else {
      return { value: minutes, unit: "minutes" };
    }
  };

  // Function to handle saving cutoff changes
  const handleCutoffSave = (workshopId: number) => {
    const bestUnit = getBestUnit(
      workshops.find((w) => w.id === workshopId)?.registrationCutoff || 60
    );
    const formData = new FormData();
    formData.append("actionType", "updateCutoff");
    formData.append("workshopId", workshopId.toString());
    formData.append(
      "cutoffMinutes",
      convertToMinutes(
        cutoffValues[workshopId] ?? bestUnit.value,
        cutoffUnits[workshopId] ?? bestUnit.unit
      ).toString()
    );

    submit(formData, { method: "post" });
    setEditingWorkshop(null);
  };

  // Function to handle saving level 3 schedule changes
  const handleScheduleSave = () => {
    const formData = new FormData();
    formData.append("actionType", "updateSettings");
    formData.append("settingType", "level3Schedule");
    formData.append("level3Schedule", JSON.stringify(level3Schedule));
    submit(formData, { method: "post" });
    setEditingDay(null);
  };

  // Function to update a day's schedule
  const updateDaySchedule = (
    day: string,
    field: "start" | "end" | "closed",
    value: number | boolean
  ) => {
    setLevel3Schedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  // Function to toggle editing mode for a day
  const toggleEditDay = (day: string) => {
    setEditingDay(editingDay === day ? null : day);
  };

  const handleLevel4HoursSave = () => {
    const formData = new FormData();
    formData.append("actionType", "updateSettings");
    formData.append("settingType", "level4UnavailableHours");
    formData.append(
      "level4UnavailableHours",
      JSON.stringify(level4UnavailableHours)
    );
    submit(formData, { method: "post" });
    setEditingLevel4Hours(false);
  };

  const calculateLevel3TimeRange = () => {
    let minHour = 24;
    let maxHour = 0;

    Object.values(level3Schedule).forEach((schedule) => {
      if (!schedule.closed) {
        minHour = Math.min(minHour, schedule.start);
        maxHour = Math.max(maxHour, schedule.end);
      }
    });

    // Return default if all days are closed
    if (minHour >= maxHour) {
      return { minHour: 9, maxHour: 17 };
    }

    return { minHour, maxHour };
  };

  // Function to add a new planned closure
  const handleAddClosure = () => {
    // Create dates from user input, preserving the selected day
    const startDateInput = newClosure.startDate.toISOString().split("T")[0]; // Get YYYY-MM-DD
    const endDateInput = newClosure.endDate.toISOString().split("T")[0]; // Get YYYY-MM-DD

    // Parse the dates using the date string directly to avoid timezone issues
    const [startYear, startMonth, startDay] = startDateInput
      .split("-")
      .map(Number);
    const [startHours, startMinutes] = newClosure.startTime
      .split(":")
      .map(Number);

    const [endYear, endMonth, endDay] = endDateInput.split("-").map(Number);
    const [endHours, endMinutes] = newClosure.endTime.split(":").map(Number);

    // Create Date objects with the correct day, ensuring we use local timezone
    const start = new Date(
      startYear,
      startMonth - 1,
      startDay,
      startHours,
      startMinutes,
      0
    );
    const end = new Date(
      endYear,
      endMonth - 1,
      endDay,
      endHours,
      endMinutes,
      0
    );

    // Validate dates
    if (end <= start) {
      setValidationError({
        show: true,
        title: "Invalid Time Period",
        message: "End date and time must be after start date and time.",
      });
      return;
    }

    // Check for overlapping closures
    const hasOverlap = plannedClosures.some((closure) => {
      const closureStart = new Date(closure.startDate);
      const closureEnd = new Date(closure.endDate);

      // Check if the new closure overlaps with an existing one
      return (
        (start <= closureEnd && end >= closureStart) ||
        (closureStart <= end && closureEnd >= start)
      );
    });

    if (hasOverlap) {
      setValidationError({
        show: true,
        title: "Overlapping Closure",
        message:
          "This closure period overlaps with an existing planned closure. Please choose a different time period.",
      });
      return;
    }

    const newId =
      plannedClosures.length > 0
        ? Math.max(...plannedClosures.map((c) => c.id)) + 1
        : 1;

    const updated = [
      ...plannedClosures,
      { id: newId, startDate: start, endDate: end },
    ];

    setPlannedClosures(updated);

    // Save to database
    const formData = new FormData();
    formData.append("actionType", "updatePlannedClosures");
    formData.append(
      "closures",
      JSON.stringify(
        updated.map((c) => ({
          id: c.id,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
        }))
      )
    );
    submit(formData, { method: "post" });

    // Reset form with today's date
    const today = new Date();

    setNewClosure({
      startDate: today,
      startTime: "09:00",
      endDate: today, // Same date as start
      endTime: "17:00",
    });
  };

  // Function to delete a planned closure
  const handleDeleteClosure = (id: number) => {
    const updated = plannedClosures.filter((c) => c.id !== id);
    setPlannedClosures(updated);

    // Save to database
    const formData = new FormData();
    formData.append("actionType", "updatePlannedClosures");
    formData.append(
      "closures",
      JSON.stringify(
        updated.map((c) => ({
          id: c.id,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
        }))
      )
    );
    submit(formData, { method: "post" });
  };

  // Generate time options in 30-minute increments
  const timeOptions = useMemo(() => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      options.push(`${hour.toString().padStart(2, "0")}:00`);
      options.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return options;
  }, []);

  const validateLimits = (): boolean => {
    const dailyInSlots = maxEquipmentSlotsPerDay.value;
    const weeklyInSlots = maxEquipmentSlotsPerWeek.value;

    if (weeklyInSlots < dailyInSlots) {
      setWeeklyLimitError(
        `Weekly limit (${weeklyInSlots} slots) cannot be less than daily limit (${dailyInSlots} slots)`
      );
      return false;
    }

    setWeeklyLimitError("");
    return true;
  };

  // Validate limits on initial load and when limits change
  React.useEffect(() => {
    validateLimits();
  }, [
    maxEquipmentSlotsPerDay.value,
    maxEquipmentSlotsPerDay.unit,
    maxEquipmentSlotsPerWeek.value,
  ]);

  const level3TimeRange = calculateLevel3TimeRange();

  // Create access token
  const generateNeverExpiringToken = () => {
    const formData = new FormData();
    formData.append("actionType", "generateAccessToken");
    formData.append("selectedEquipment", selectedEquipment);
    formData.append("deviceTag", deviceTag);

    submit(formData, { method: "post" });
  };

  // View access card details
  const handleSearchCard = () => {
    if (!cardUUID.trim()) return;

    const formData = new FormData();
    formData.append("actionType", "getAccessCardInfo");
    formData.append("cardUUID", cardUUID.trim());

    submit(formData, { method: "post" });
  };

  // Update or register access card details
  const handleUpdate = () => {
    const formData = new FormData();
    if (!cardUUID.trim()) return;

    formData.append(
      "actionType",
      "updateAccessCard"
    );
    formData.append("cardUUID", cardUUID.trim());
    formData.append("email", email.trim());
    formData.append("permissions", JSON.stringify(permissions));

    submit(formData, { method: "post" });
  };

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        <AdminAppSidebar />
        <main className="flex-grow p-6 overflow-auto">
          <div className="w-full">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Admin Settings</h1>
            </div>

            <div className="hidden md:flex items-center gap-2 mb-6">
              <Settings className="h-6 w-6 text-indigo-500" />
              <h1 className="text-2xl font-bold">Admin Settings</h1>
            </div>

            {actionData?.message && (
              <Alert
                className={`mb-6 ${
                  actionData.success ? "bg-green-50" : "bg-red-50"
                }`}
                variant={actionData.success ? "default" : "destructive"}
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {actionData.success ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>{actionData.message}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="workshops" className="w-full">
              <div className="w-full overflow-x-auto mb-4">
                <TabsList className="inline-flex w-max min-w-full">
                  <TabsTrigger value="workshops" className="whitespace-nowrap">
                    Workshop Settings
                  </TabsTrigger>
                  <TabsTrigger value="users" className="whitespace-nowrap">
                    User Settings
                  </TabsTrigger>
                  <TabsTrigger value="volunteers" className="whitespace-nowrap">
                    Volunteer Settings
                  </TabsTrigger>
                  <TabsTrigger value="equipment" className="whitespace-nowrap">
                    Equipment Settings
                  </TabsTrigger>
                  <TabsTrigger
                    value="plannedClosures"
                    className="whitespace-nowrap"
                  >
                    Planned Closures
                  </TabsTrigger>
                  <TabsTrigger
                    value="cancelledEvents"
                    className="whitespace-nowrap"
                  >
                    Cancelled Events
                  </TabsTrigger>
                  <TabsTrigger
                    value="miscellaneous"
                    className="whitespace-nowrap"
                  >
                    Miscellaneous Settings
                  </TabsTrigger>
                  <TabsTrigger
                    value="integrations"
                    className="whitespace-nowrap"
                  >
                    Integrations
                  </TabsTrigger>
                  <TabsTrigger
                    value="securityAccess"
                    className="whitespace-nowrap"
                  >
                    Security & Access
                  </TabsTrigger>
                  <TabsTrigger
                    value="placeholder"
                    className="whitespace-nowrap"
                  >
                    Other Settings
                  </TabsTrigger>
                  {/* Add more tabs here in the future */}
                </TabsList>
              </div>

              {/* Tab 1: All Workshop Settings */}
              <TabsContent value="workshops">
                {/* Workshop Visibility Days Section */}
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input type="hidden" name="settingType" value="workshop" />
                  <Card>
                    <CardHeader>
                      <CardTitle>Workshop Visibility Days Settings</CardTitle>
                      <CardDescription>
                        Configure how far ahead users can see workshops
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="workshopVisibilityDays">
                          Workshop Visibility Days
                        </Label>
                        <Input
                          id="workshopVisibilityDays"
                          name="workshopVisibilityDays"
                          type="number"
                          value={workshopVisibilityDays}
                          onChange={(e) =>
                            setWorkshopVisibilityDays(e.target.value)
                          }
                          min="1"
                          max="365"
                          className="w-full max-w-xs"
                        />
                        <p className="text-sm text-gray-500">
                          Number of days in the future to display workshop
                          dates. This controls how far ahead users can see
                          upcoming workshops.
                        </p>
                      </div>
                      {/* Additional general workshop settings can be added here */}
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Visibility Settings
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>

                {/* Past Workshop Visibility Section */}
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input
                    type="hidden"
                    name="settingType"
                    value="pastWorkshop"
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Past Workshop Visibility</CardTitle>
                      <CardDescription>
                        Configure how far back users can see past workshops
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pastWorkshopVisibility">
                          Past Workshop Visibility (In Days)
                        </Label>
                        <Input
                          id="pastWorkshopVisibility"
                          name="pastWorkshopVisibility"
                          type="number"
                          value={pastWorkshopVisibility}
                          onChange={(e) =>
                            setPastWorkshopVisibility(e.target.value)
                          }
                          min="1"
                          max="365"
                          className="w-full max-w-xs"
                        />
                        <p className="text-sm text-gray-500">
                          Number of days in the past to show entire workshops in
                          past events. If any workshop date falls within this
                          period, the entire workshop will appear in past
                          events.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Past Visibility Settings
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>

                {/* Workshop Registration Cutoffs Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Workshop Registration Cutoffs</CardTitle>
                    <CardDescription>
                      Manage the registration cutoff times before each workshop
                      starts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="active" className="w-full">
                      <TabsList className="mb-4">
                        <TabsTrigger value="active">
                          Active Workshops
                        </TabsTrigger>
                        <TabsTrigger value="past">Past Workshops</TabsTrigger>
                      </TabsList>

                      <TabsContent value="active">
                        <Table>
                          <TableCaption>
                            Active workshops with at least one future date.
                            Registration cutoff is the minimum time before a
                            workshop starts that users can register. Values are
                            stored in minutes in the database.
                          </TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead className="w-[150px]">
                                Registration Cutoff
                              </TableHead>
                              <TableHead className="w-[100px]">Unit</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {workshops
                              .filter(
                                (workshop) => workshop.hasActiveOccurrences
                              )
                              .map((workshop) => {
                                // Calculate best display unit for the current value
                                const bestUnit = getBestUnit(
                                  workshop.registrationCutoff
                                );
                                const displayValue =
                                  editingWorkshop === workshop.id
                                    ? (cutoffValues[workshop.id] ??
                                      bestUnit.value)
                                    : bestUnit.value;
                                const displayUnit =
                                  editingWorkshop === workshop.id
                                    ? (cutoffUnits[workshop.id] ??
                                      bestUnit.unit)
                                    : bestUnit.unit;

                                return (
                                  <TableRow key={workshop.id}>
                                    <TableCell className="font-medium">
                                      {workshop.id}
                                    </TableCell>
                                    <TableCell>{workshop.name}</TableCell>
                                    <TableCell>${workshop.price}</TableCell>
                                    <TableCell>
                                      {editingWorkshop === workshop.id ? (
                                        <Input
                                          type="number"
                                          min="1"
                                          max="10000"
                                          value={displayValue}
                                          onChange={(e) => {
                                            setCutoffValues({
                                              ...cutoffValues,
                                              [workshop.id]: Number(
                                                e.target.value
                                              ),
                                            });
                                          }}
                                          className="w-24"
                                        />
                                      ) : (
                                        displayValue
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {editingWorkshop === workshop.id ? (
                                        <select
                                          value={displayUnit}
                                          onChange={(e) => {
                                            setCutoffUnits({
                                              ...cutoffUnits,
                                              [workshop.id]: e.target.value,
                                            });
                                          }}
                                          className="border rounded px-2 py-1 text-sm"
                                        >
                                          <option value="minutes">
                                            Minutes
                                          </option>
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                        </select>
                                      ) : (
                                        displayUnit
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {editingWorkshop === workshop.id ? (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleCutoffSave(workshop.id)
                                            }
                                          >
                                            <Check className="h-4 w-4 text-green-500" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              setEditingWorkshop(null)
                                            }
                                          >
                                            <X className="h-4 w-4 text-red-500" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            setEditingWorkshop(workshop.id);
                                            // Initialize with the best unit for this workshop
                                            const currentBestUnit = getBestUnit(
                                              workshop.registrationCutoff
                                            );
                                            setCutoffUnits({
                                              ...cutoffUnits,
                                              [workshop.id]:
                                                currentBestUnit.unit,
                                            });
                                            setCutoffValues({
                                              ...cutoffValues,
                                              [workshop.id]:
                                                currentBestUnit.value,
                                            });
                                          }}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>

                        {workshops.filter(
                          (workshop) => workshop.hasActiveOccurrences
                        ).length === 0 && (
                          <div className="text-center py-10 text-gray-500">
                            No active workshops found.
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="past">
                        <Table>
                          <TableCaption>
                            Past workshops with no future dates. Registration
                            cutoff is the minimum time before a workshop starts
                            that users can register. Values are stored in
                            minutes in the database.
                          </TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead className="w-[150px]">
                                Registration Cutoff
                              </TableHead>
                              <TableHead className="w-[100px]">Unit</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {workshops
                              .filter(
                                (workshop) => !workshop.hasActiveOccurrences
                              )
                              .map((workshop) => {
                                // Calculate best display unit for the current value
                                const bestUnit = getBestUnit(
                                  workshop.registrationCutoff
                                );
                                const displayValue =
                                  editingWorkshop === workshop.id
                                    ? (cutoffValues[workshop.id] ??
                                      bestUnit.value)
                                    : bestUnit.value;
                                const displayUnit =
                                  editingWorkshop === workshop.id
                                    ? (cutoffUnits[workshop.id] ??
                                      bestUnit.unit)
                                    : bestUnit.unit;

                                return (
                                  <TableRow key={workshop.id}>
                                    <TableCell className="font-medium">
                                      {workshop.id}
                                    </TableCell>
                                    <TableCell>{workshop.name}</TableCell>
                                    <TableCell>${workshop.price}</TableCell>
                                    <TableCell>
                                      {editingWorkshop === workshop.id ? (
                                        <Input
                                          type="number"
                                          min="1"
                                          max="10000"
                                          value={displayValue}
                                          onChange={(e) => {
                                            setCutoffValues({
                                              ...cutoffValues,
                                              [workshop.id]: Number(
                                                e.target.value
                                              ),
                                            });
                                          }}
                                          className="w-24"
                                        />
                                      ) : (
                                        displayValue
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      {editingWorkshop === workshop.id ? (
                                        <select
                                          value={displayUnit}
                                          onChange={(e) => {
                                            setCutoffUnits({
                                              ...cutoffUnits,
                                              [workshop.id]: e.target.value,
                                            });
                                          }}
                                          className="border rounded px-2 py-1 text-sm"
                                        >
                                          <option value="minutes">
                                            Minutes
                                          </option>
                                          <option value="hours">Hours</option>
                                          <option value="days">Days</option>
                                        </select>
                                      ) : (
                                        displayUnit
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {editingWorkshop === workshop.id ? (
                                        <div className="flex justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              handleCutoffSave(workshop.id)
                                            }
                                          >
                                            <Check className="h-4 w-4 text-green-500" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                              setEditingWorkshop(null)
                                            }
                                          >
                                            <X className="h-4 w-4 text-red-500" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            setEditingWorkshop(workshop.id);
                                            // Initialize with the best unit for this workshop (the current displayed unit)
                                            const currentBestUnit = getBestUnit(
                                              workshop.registrationCutoff
                                            );
                                            setCutoffUnits({
                                              ...cutoffUnits,
                                              [workshop.id]:
                                                currentBestUnit.unit,
                                            });
                                            setCutoffValues({
                                              ...cutoffValues,
                                              [workshop.id]:
                                                currentBestUnit.value,
                                            });
                                          }}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>

                        {workshops.filter(
                          (workshop) => !workshop.hasActiveOccurrences
                        ).length === 0 && (
                          <div className="text-center py-10 text-gray-500">
                            No past workshops found.
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      View and manage all registered users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {/* Admin Status Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">
                            <FilterIcon
                              className="-ms-1 opacity-60"
                              size={16}
                              aria-hidden="true"
                            />
                            Admin Status
                            {adminStatusFilter.length > 0 && (
                              <span className="-me-1 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
                                {adminStatusFilter.length}
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto min-w-36 p-3" align="start">
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">
                              Filter by Admin Status
                            </div>
                            <div className="space-y-3">
                              {adminStatusOptions.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`admin-status-${option.value}`}
                                    checked={adminStatusFilter.includes(option.value)}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setAdminStatusFilter([...adminStatusFilter, option.value]);
                                      } else {
                                        setAdminStatusFilter(
                                          adminStatusFilter.filter((f) => f !== option.value)
                                        );
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`admin-status-${option.value}`}
                                    className="flex grow justify-between gap-2 font-normal cursor-pointer"
                                  >
                                    {option.value}{" "}
                                    <span className="ms-2 text-xs text-muted-foreground">
                                      {option.count}
                                    </span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                            {adminStatusFilter.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAdminStatusFilter([])}
                                className="w-full"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Membership Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">
                            <FilterIcon
                              className="-ms-1 opacity-60"
                              size={16}
                              aria-hidden="true"
                            />
                            Membership
                            {membershipFilter.length > 0 && (
                              <span className="-me-1 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
                                {membershipFilter.length}
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto min-w-36 p-3" align="start">
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">
                              Filter by Membership
                            </div>
                            <div className="space-y-3">
                              {membershipOptions.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`membership-${option.value}`}
                                    checked={membershipFilter.includes(option.value)}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setMembershipFilter([...membershipFilter, option.value]);
                                      } else {
                                        setMembershipFilter(
                                          membershipFilter.filter((f) => f !== option.value)
                                        );
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`membership-${option.value}`}
                                    className="flex grow justify-between gap-2 font-normal cursor-pointer"
                                  >
                                    {option.value}{" "}
                                    <span className="ms-2 text-xs text-muted-foreground">
                                      {option.count}
                                    </span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                            {membershipFilter.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMembershipFilter([])}
                                className="w-full"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Door Access Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline">
                            <FilterIcon
                              className="-ms-1 opacity-60"
                              size={16}
                              aria-hidden="true"
                            />
                            Door Access
                            {doorAccessFilter.length > 0 && (
                              <span className="-me-1 inline-flex h-5 max-h-full items-center rounded border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
                                {doorAccessFilter.length}
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto min-w-36 p-3" align="start">
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground">
                              Filter by Door Access
                            </div>
                            <div className="space-y-3">
                              {doorAccessOptions.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`door-access-${option.value}`}
                                    checked={doorAccessFilter.includes(option.value)}
                                    onCheckedChange={(checked: boolean) => {
                                      if (checked) {
                                        setDoorAccessFilter([...doorAccessFilter, option.value]);
                                      } else {
                                        setDoorAccessFilter(
                                          doorAccessFilter.filter((f) => f !== option.value)
                                        );
                                      }
                                    }}
                                  />
                                  <Label
                                    htmlFor={`door-access-${option.value}`}
                                    className="flex grow justify-between gap-2 font-normal cursor-pointer"
                                  >
                                    {option.value}{" "}
                                    <span className="ms-2 text-xs text-muted-foreground">
                                      {option.count}
                                    </span>
                                  </Label>
                                </div>
                              ))}
                            </div>
                            {doorAccessFilter.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDoorAccessFilter([])}
                                className="w-full"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <DataTable
                      columns={userColumns}
                      data={filteredUsersForTable}
                      enableGlobalFilter={true}
                      globalFilterPlaceholder="Search by first or last name..."
                      globalFilterAccessor={(user) => `${user.firstName} ${user.lastName} ${user.email}`}
                      enableColumnVisibility={true}
                      emptyMessage="No users found"
                      initialSorting={[
                        {
                          id: "id",
                          desc: false,
                        },
                      ]}
                      initialPageSize={10}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipment">
                {/* Equipment Visibility Days Form */}
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input type="hidden" name="settingType" value="equipment" />
                  <Card>
                    <CardHeader>
                      <CardTitle>Equipment Booking Visibility</CardTitle>
                      <CardDescription>
                        Configure how far ahead users can book equipment
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="equipmentVisibilityDays">
                          Equipment Booking Visibility Days
                        </Label>
                        <Input
                          id="equipmentVisibilityDays"
                          name="equipmentVisibilityDays"
                          type="number"
                          value={equipmentVisibilityDays}
                          onChange={(e) =>
                            setEquipmentVisibilityDays(e.target.value)
                          }
                          min="1"
                          max="365"
                          className="w-full max-w-xs"
                        />
                        <p className="text-sm text-gray-500">
                          Number of days in the future to display equipment
                          booking slots. This controls how far ahead users can
                          book equipment.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Visibility Settings
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>

                {/* Max Equipment Slots Per Day Form */}
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input
                    type="hidden"
                    name="settingType"
                    value="maxEquipmentSlotsPerDay"
                  />
                  <input
                    type="hidden"
                    name="maxEquipmentSlotsPerDay"
                    value={maxEquipmentSlotsPerDay.value}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Daily Equipment Booking Limits</CardTitle>
                      <CardDescription>
                        Set the maximum amount of time a user can book equipment
                        per day
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* ADD BLOCKING UI WHEN WEEKLY IS BEING EDITED */}
                      {weeklyFormBeingEdited && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Cannot edit daily limits while weekly limits are
                            being modified. Please save or cancel your weekly
                            changes first.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* ADD ERROR DISPLAY FOR DAILY FORM  */}
                      {weeklyLimitError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {weeklyLimitError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="maxEquipmentSlotsPerDay">
                          Maximum Equipment Booking Time Per Day
                        </Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="maxEquipmentSlotsPerDay"
                            type="number"
                            value={maxEquipmentSlotsPerDay.value}
                            disabled={weeklyFormBeingEdited}
                            onFocus={() => setDailyFormBeingEdited(true)}
                            onBlur={() => setDailyFormBeingEdited(false)}
                            onChange={(e) => {
                              const inputValue = parseInt(e.target.value) || 1;
                              // For slots: minimum 1, maximum 48 (24 hours * 2 slots per hour)
                              const validValue = Math.max(
                                1,
                                Math.min(48, inputValue)
                              );

                              const newDailyState = {
                                ...maxEquipmentSlotsPerDay,
                                value: validValue,
                              };
                              setMaxEquipmentSlotsPerDay(newDailyState);

                              // Validate with the new values immediately
                              const dailyInSlots = validValue;
                              const weeklyInSlots =
                                maxEquipmentSlotsPerWeek.value;

                              if (weeklyInSlots < dailyInSlots) {
                                setWeeklyLimitError(
                                  `Weekly limit (${weeklyInSlots} slots) cannot be less than daily limit (${dailyInSlots} slots)`
                                );
                              } else {
                                setWeeklyLimitError("");
                              }
                            }}
                            min="1"
                            max="48"
                            step="1"
                            className={`w-24 ${
                              weeklyLimitError ? "border-red-500" : ""
                            } ${weeklyFormBeingEdited ? "opacity-50" : ""}`}
                          />
                          <span
                            className={`text-sm text-gray-600 w-16 ${
                              weeklyFormBeingEdited ? "opacity-50" : ""
                            }`}
                          >
                            Slots
                          </span>
                        </div>
                        {/* Updated description for slots */}
                        <p className="text-sm text-gray-500">
                          Maximum number of 30-minute slots a user can book per
                          day. Range: 1-48 slots (each slot = 30 minutes).
                          Current setting: {maxEquipmentSlotsPerDay.value} slots
                          ({maxEquipmentSlotsPerDay.value * 30} minutes). Must
                          be no greater than {maxEquipmentSlotsPerWeek.value}{" "}
                          slots (weekly limit).
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        disabled={weeklyFormBeingEdited || !!weeklyLimitError}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Daily Limits
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>

                {/* Max Equipment Slots Per Week Form */}
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input
                    type="hidden"
                    name="settingType"
                    value="maxEquipmentSlotsPerWeek"
                  />
                  <input
                    type="hidden"
                    name="maxEquipmentSlotsPerWeek"
                    value={maxEquipmentSlotsPerWeek.value}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Equipment Booking Limits</CardTitle>
                      <CardDescription>
                        Set the maximum number of slots a user can book
                        equipment per week (7-day period)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* ADD BLOCKING UI WHEN DAILY IS BEING EDITED */}
                      {dailyFormBeingEdited && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Cannot edit weekly limits while daily limits are
                            being modified. Please save or cancel your daily
                            changes first.
                          </AlertDescription>
                        </Alert>
                      )}

                      {weeklyLimitError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {weeklyLimitError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="maxEquipmentSlotsPerWeek">
                          Maximum Equipment Booking Slots Per Week
                        </Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="maxEquipmentSlotsPerWeek"
                            type="number"
                            value={maxEquipmentSlotsPerWeek.value}
                            disabled={dailyFormBeingEdited}
                            onFocus={() => setWeeklyFormBeingEdited(true)}
                            onBlur={() => setWeeklyFormBeingEdited(false)}
                            onChange={(e) => {
                              const inputValue = parseInt(e.target.value) || 1;
                              // For slots: minimum 1, maximum 168 (7 days * 24 hours * 2 slots per hour)
                              const validValue = Math.max(
                                1,
                                Math.min(168, inputValue)
                              );

                              setMaxEquipmentSlotsPerWeek((prev) => ({
                                ...prev,
                                value: validValue,
                              }));

                              // Validate with the new weekly value immediately
                              const dailyInMinutes =
                                maxEquipmentSlotsPerDay.unit === "hours"
                                  ? maxEquipmentSlotsPerDay.value * 60
                                  : maxEquipmentSlotsPerDay.value;
                              const dailyInSlots = dailyInMinutes / 30;

                              if (validValue < dailyInSlots) {
                                setWeeklyLimitError(
                                  `Weekly limit (${validValue} slots) cannot be less than daily limit (${dailyInSlots} slots)`
                                );
                              } else {
                                setWeeklyLimitError("");
                              }
                            }}
                            min="1"
                            max="168"
                            step="1"
                            className={`w-24 ${
                              weeklyLimitError ? "border-red-500" : ""
                            } ${dailyFormBeingEdited ? "opacity-50" : ""}`}
                          />
                          <span
                            className={`text-sm text-gray-600 w-16 ${
                              dailyFormBeingEdited ? "opacity-50" : ""
                            }`}
                          >
                            Slots
                          </span>
                        </div>
                        {/* Calculation since both are now in slots */}
                        <p className="text-sm text-gray-500">
                          Maximum number of 30-minute slots a user can book per
                          7-day period. Range: 1-168 slots (each slot = 30
                          minutes). Current setting:{" "}
                          {maxEquipmentSlotsPerWeek.value} slots (
                          {maxEquipmentSlotsPerWeek.value / 2} hours). Must be
                          at least {maxEquipmentSlotsPerDay.value} slots (daily
                          limit).
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        disabled={dailyFormBeingEdited || !!weeklyLimitError}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Weekly Limits
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>

                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Level 3 User Booking Hours</CardTitle>
                    <CardDescription>
                      Configure when level 3 users can book equipment on each
                      day of the week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-md text-blue-700 text-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-medium">Dynamic Time Range:</span>
                        <span className="font-bold">
                          {level3TimeRange.minHour}:00
                        </span>{" "}
                        to
                        <span className="font-bold">
                          {level3TimeRange.maxHour}:00
                        </span>
                      </div>
                      <p className="text-s text-blue-600">
                        Reflects earliest start and latest end times across all
                        open days. The booking grid will automatically adjust to
                        these hours.
                      </p>
                    </div>
                    <Table>
                      <TableCaption>
                        Set the time range during which level 3 users can book
                        equipment for each day. Default is 9 AM to 5 PM. You can
                        also mark days as closed.
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Day</TableHead>
                          <TableHead>Start Hour (24h)</TableHead>
                          <TableHead>End Hour (24h)</TableHead>
                          <TableHead>Closed</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(level3Schedule).map(
                          ([day, schedule]) => (
                            <TableRow key={day}>
                              <TableCell className="font-medium">
                                {day}
                              </TableCell>
                              <TableCell>
                                {editingDay === day ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={schedule.start}
                                    onChange={(e) =>
                                      updateDaySchedule(
                                        day,
                                        "start",
                                        parseInt(e.target.value)
                                      )
                                    }
                                    className="w-20"
                                    disabled={schedule.closed}
                                  />
                                ) : (
                                  <span
                                    className={
                                      schedule.closed ? "text-gray-400" : ""
                                    }
                                  >
                                    {schedule.start}:00
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {editingDay === day ? (
                                  <Input
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={schedule.end}
                                    onChange={(e) =>
                                      updateDaySchedule(
                                        day,
                                        "end",
                                        parseInt(e.target.value)
                                      )
                                    }
                                    className="w-20"
                                    disabled={schedule.closed}
                                  />
                                ) : (
                                  <span
                                    className={
                                      schedule.closed ? "text-gray-400" : ""
                                    }
                                  >
                                    {schedule.end}:00
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={schedule.closed}
                                    onChange={(e) =>
                                      updateDaySchedule(
                                        day,
                                        "closed",
                                        e.target.checked
                                      )
                                    }
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500"
                                    id={`closed-${day}`}
                                  />
                                  <label
                                    htmlFor={`closed-${day}`}
                                    className="ml-2 text-sm text-gray-600"
                                  >
                                    Closed
                                  </label>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {editingDay === day ? (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={handleScheduleSave}
                                    >
                                      <Check className="h-4 w-4 text-green-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingDay(null)}
                                    >
                                      <X className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleEditDay(day)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={handleScheduleSave}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Schedule Changes
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Level 4 User Booking Hours</CardTitle>
                    <CardDescription>
                      Configure when level 4 users cannot book equipment
                      (applies to all days)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <p className="text-sm text-gray-500">
                        Level 4 users can book equipment 24/7 by default, but
                        you can set a daily time window when booking is not
                        allowed. For example, if you set "Start: 20" and "End:
                        5", they cannot book from 8 PM to 5 AM. Setting both
                        "Start: 0" and "End: 0" means no restrictions.
                      </p>

                      <div className="flex space-x-6 items-end">
                        <div className="space-y-2">
                          <Label htmlFor="level4-start">
                            Unavailable Start Hour (24h)
                          </Label>
                          <Input
                            id="level4-start"
                            type="number"
                            min="0"
                            max="23"
                            value={level4UnavailableHours.start}
                            onChange={(e) =>
                              setLevel4UnavailableHours((prev) => ({
                                ...prev,
                                start: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-24"
                            disabled={!editingLevel4Hours}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="level4-end">
                            Unavailable End Hour (24h)
                          </Label>
                          <Input
                            id="level4-end"
                            type="number"
                            min="0"
                            max="23"
                            value={level4UnavailableHours.end}
                            onChange={(e) =>
                              setLevel4UnavailableHours((prev) => ({
                                ...prev,
                                end: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-24"
                            disabled={!editingLevel4Hours}
                          />
                        </div>

                        {!editingLevel4Hours ? (
                          <Button
                            variant="outline"
                            onClick={() => setEditingLevel4Hours(true)}
                            className="mb-[2px]"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit Hours
                          </Button>
                        ) : (
                          <div className="flex space-x-2 mb-[2px]">
                            <Button
                              variant="outline"
                              onClick={handleLevel4HoursSave}
                              className="text-green-600"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingLevel4Hours(false);
                                setLevel4UnavailableHours({
                                  start:
                                    settings.level4UnavailableHours?.start ?? 0,
                                  end:
                                    settings.level4UnavailableHours?.end ?? 0,
                                });
                              }}
                              className="text-red-600"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="pt-4">
                        <div className="p-4 bg-gray-50 rounded-md">
                          <div className="text-sm font-medium mb-2">
                            Current Setting
                          </div>
                          {level4UnavailableHours.start === 0 &&
                          level4UnavailableHours.end === 0 ? (
                            <p className="text-sm text-gray-600">
                              No restrictions - Level 4 users can book 24/7
                            </p>
                          ) : (
                            <p className="text-sm text-gray-600">
                              Level 4 users cannot book from{" "}
                              {level4UnavailableHours.start}:00 to{" "}
                              {level4UnavailableHours.end}:00
                              {level4UnavailableHours.start >
                              level4UnavailableHours.end
                                ? " (overnight)"
                                : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="volunteers">
                <Card>
                  <CardHeader>
                    <CardTitle>Manage All Volunteers</CardTitle>
                    <CardDescription>
                      View and manage volunteer status for all users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <FiSearch className="text-gray-500" />
                        <Input
                          placeholder="Search by first or last name"
                          value={searchName}
                          onChange={(e) => setSearchName(e.target.value)}
                          className="w-full md:w-64"
                        />
                      </div>
                      <div className="text-sm text-gray-500">
                        Showing {startIndex + 1}-
                        {Math.min(endIndex, sortedFilteredUsers.length)} of{" "}
                        {sortedFilteredUsers.length} users
                      </div>
                    </div>

                    <ShadTable
                      columns={[
                        {
                          header: "First Name",
                          render: (user: any) => user.firstName,
                        },
                        {
                          header: "Last Name",
                          render: (user: any) => user.lastName,
                        },
                        { header: "Email", render: (user: any) => user.email },
                        {
                          header: "Phone Number",
                          render: (user: any) => user.phone,
                        },
                        {
                          header: "Volunteer Status",
                          render: (user: any) => (
                            <div className="space-y-1">
                              <VolunteerControl user={user} />
                              {user.volunteerHistory &&
                                user.volunteerHistory.length > 0 && (
                                  <details className="text-xs text-gray-500">
                                    <summary className="cursor-pointer hover:text-gray-700">
                                      History ({user.volunteerHistory.length})
                                    </summary>
                                    <div className="mt-1 space-y-1">
                                      {user.volunteerHistory
                                        .slice(0, 3)
                                        .map((period: any) => (
                                          <div
                                            key={period.id}
                                            className="text-xs"
                                          >
                                            {new Date(
                                              period.volunteerStart
                                            ).toLocaleDateString()}{" "}
                                            -{" "}
                                            {period.volunteerEnd
                                              ? new Date(
                                                  period.volunteerEnd
                                                ).toLocaleDateString()
                                              : "Active"}
                                          </div>
                                        ))}
                                      {user.volunteerHistory.length > 3 && (
                                        <div className="text-xs">
                                          ...and{" "}
                                          {user.volunteerHistory.length - 3}{" "}
                                          more
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                            </div>
                          ),
                        },
                      ]}
                      data={paginatedUsers}
                      emptyMessage="No users found"
                    />

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      maxVisiblePages={10}
                    />
                  </CardContent>
                </Card>

                {/* Volunteer Hours Management */}
                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Manage Volunteer Hours</CardTitle>
                    <CardDescription>
                      Review and approve/deny/resolve/pending volunteer hour
                      submissions. Use the "Show resubmissions and denied hours
                      only" filter to focus on hours that need attention -
                      denied hours that need feedback and resubmissions that
                      need review.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Search and Filter Controls */}
                      <div className="space-y-4 mb-6">
                        {/* Name Search and Status Filter Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Name Search */}
                          <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Search by volunteer name
                            </label>
                            <div className="relative">
                              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="Enter first name or last name to search..."
                                value={volunteerSearchName}
                                onChange={(e) =>
                                  setVolunteerSearchName(e.target.value)
                                }
                                className="pl-10 h-10 text-base"
                              />
                            </div>
                          </div>

                          {/* Status Filter */}
                          <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Filter by status
                            </label>
                            <select
                              value={volunteerStatusFilter}
                              onChange={(e) =>
                                setVolunteerStatusFilter(e.target.value)
                              }
                              disabled={showResubmissionsOnly}
                              className={`w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base ${
                                showResubmissionsOnly
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <option value="all">All Status</option>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="denied">Denied</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            {showResubmissionsOnly && (
                              <p className="text-xs text-gray-500 mt-1">
                                Status filter is disabled when showing
                                resubmissions and denied hours only
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mb-6">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="showResubmissionsOnly"
                              checked={showResubmissionsOnly}
                              onChange={(e) =>
                                setShowResubmissionsOnly(e.target.checked)
                              }
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <label
                              htmlFor="showResubmissionsOnly"
                              className="text-sm font-medium text-gray-700"
                            >
                              Show resubmissions and denied hours only
                            </label>
                            <span className="text-xs text-gray-500">
                              (Shows only pending resubmissions and denied hours
                              - overrides status filter)
                            </span>
                          </div>
                          {showResubmissionsOnly && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                              <strong>Active:</strong> Showing only pending
                              hours marked as resubmissions and denied hours.
                              Status filter is disabled. Uncheck to use normal
                              filtering.
                            </div>
                          )}
                        </div>

                        {/* Date and Time Filters - Two Rows */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* From Date and Time */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
                              Filter From
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Start Date
                                </label>
                                <Input
                                  type="date"
                                  value={volunteerFromDate}
                                  onChange={(e) =>
                                    setVolunteerFromDate(e.target.value)
                                  }
                                  className="w-full h-10"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Start Time
                                </label>
                                <select
                                  value={volunteerFromTime}
                                  onChange={(e) =>
                                    setVolunteerFromTime(e.target.value)
                                  }
                                  disabled={!volunteerFromDate}
                                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 text-base"
                                >
                                  <option value="">
                                    {!volunteerFromDate
                                      ? "Select start date first"
                                      : "Choose start time"}
                                  </option>
                                  {generateVolunteerTimeOptions().map(
                                    (time) => (
                                      <option key={time} value={time}>
                                        {time}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* To Date and Time */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
                              Filter To
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  End Date
                                </label>
                                <Input
                                  type="date"
                                  value={volunteerToDate}
                                  onChange={(e) =>
                                    setVolunteerToDate(e.target.value)
                                  }
                                  className="w-full h-10"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  End Time
                                </label>
                                <select
                                  value={volunteerToTime}
                                  onChange={(e) =>
                                    setVolunteerToTime(e.target.value)
                                  }
                                  disabled={!volunteerToDate}
                                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 text-base"
                                >
                                  <option value="">
                                    {!volunteerToDate
                                      ? "Select end date first"
                                      : "Choose end time"}
                                  </option>
                                  {generateVolunteerTimeOptions().map(
                                    (time) => (
                                      <option key={time} value={time}>
                                        {time}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button
                            onClick={handleVolunteerSearch}
                            disabled={
                              !volunteerFromDate ||
                              !volunteerFromTime ||
                              !volunteerToDate ||
                              !volunteerToTime
                            }
                            className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed h-10 px-6 font-medium"
                          >
                            Apply Date/Time Filter
                          </Button>

                          {(volunteerSearchName ||
                            volunteerStatusFilter !== "pending" ||
                            showResubmissionsOnly ||
                            appliedVolunteerFromDate ||
                            appliedVolunteerFromTime ||
                            appliedVolunteerToDate ||
                            appliedVolunteerToTime) && (
                            <Button
                              variant="outline"
                              onClick={handleClearVolunteerFilters}
                              className="h-10 px-6"
                            >
                              Clear All Filters
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Volunteer Hours Table */}
                      <ShadTable
                        key={`volunteer-table-${volunteerStatusFilter}-${volunteerSearchName}-${volunteerCurrentPage}`}
                        columns={[
                          {
                            header: "User",
                            render: (hour: any) => (
                              <div>
                                <div className="font-medium">
                                  {hour.user.firstName} {hour.user.lastName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {hour.user.email}
                                </div>
                              </div>
                            ),
                          },
                          {
                            header: "Date",
                            render: (hour: any) =>
                              new Date(hour.startTime).toLocaleDateString(),
                          },
                          {
                            header: "Time",
                            render: (hour: any) => {
                              const start = new Date(hour.startTime);
                              const end = new Date(hour.endTime);
                              return `${start.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} - ${end.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`;
                            },
                          },
                          {
                            header: "Hours",
                            render: (hour: any) => {
                              const start = new Date(hour.startTime);
                              const end = new Date(hour.endTime);
                              const durationMs =
                                end.getTime() - start.getTime();
                              const hours =
                                Math.round(
                                  (durationMs / (1000 * 60 * 60)) * 10
                                ) / 10;
                              return `${hours} hours`;
                            },
                          },
                          {
                            header: "Description",
                            render: (hour: any) => hour.description || "—",
                          },
                          {
                            header: "Status",
                            render: (hour: any) => (
                              <div className="flex flex-col items-center gap-1">
                                <VolunteerHourStatusControl hour={hour} />
                                {hour.isResubmission && (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Resubmission
                                  </span>
                                )}
                              </div>
                            ),
                          },
                          {
                            header: "Logged",
                            render: (hour: any) =>
                              new Date(hour.createdAt).toLocaleDateString(),
                          },
                        ]}
                        data={paginatedVolunteerHours}
                        emptyMessage="No volunteer hours found"
                      />

                      {/* Pagination for Volunteer Hours */}
                      <Pagination
                        currentPage={volunteerCurrentPage}
                        totalPages={volunteerTotalPages}
                        onPageChange={setVolunteerCurrentPage}
                        maxVisiblePages={10}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Actions */}
                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Recently Managed Volunteer Actions</CardTitle>
                    <CardDescription>
                      Recently modified volunteer hour statuses and number of
                      total hours per filter
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Search and Filter Controls for Recent Actions */}
                    <div className="space-y-4 mb-6">
                      {/* Name Search and Status Filter Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name Search */}
                        <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search by volunteer name
                          </label>
                          <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                              placeholder="Enter first name or last name to search..."
                              value={actionsSearchName}
                              onChange={(e) =>
                                setActionsSearchName(e.target.value)
                              }
                              className="pl-10 h-10 text-base"
                            />
                          </div>
                        </div>

                        {/* Status Filter */}
                        <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filter by status
                          </label>
                          <select
                            value={actionsStatusFilter}
                            onChange={(e) =>
                              setActionsStatusFilter(e.target.value)
                            }
                            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                          >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="denied">Denied</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>

                      {/* Date and Time Filters - Two Rows */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* From Date and Time */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
                            Filter From
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                Start Date
                              </label>
                              <Input
                                type="date"
                                value={actionsFromDate}
                                onChange={(e) =>
                                  setActionsFromDate(e.target.value)
                                }
                                className="w-full h-10"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                Start Time
                              </label>
                              <select
                                value={actionsFromTime}
                                onChange={(e) =>
                                  setActionsFromTime(e.target.value)
                                }
                                disabled={!actionsFromDate}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 text-base"
                              >
                                <option value="">
                                  {!actionsFromDate
                                    ? "Select start date first"
                                    : "Choose start time"}
                                </option>
                                {generateVolunteerTimeOptions().map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* To Date and Time */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
                            Filter To
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                End Date
                              </label>
                              <Input
                                type="date"
                                value={actionsToDate}
                                onChange={(e) =>
                                  setActionsToDate(e.target.value)
                                }
                                className="w-full h-10"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                End Time
                              </label>
                              <select
                                value={actionsToTime}
                                onChange={(e) =>
                                  setActionsToTime(e.target.value)
                                }
                                disabled={!actionsToDate}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 text-base"
                              >
                                <option value="">
                                  {!actionsToDate
                                    ? "Select end date first"
                                    : "Choose end time"}
                                </option>
                                {generateVolunteerTimeOptions().map((time) => (
                                  <option key={time} value={time}>
                                    {time}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                          onClick={handleActionsSearch}
                          disabled={
                            !actionsFromDate ||
                            !actionsFromTime ||
                            !actionsToDate ||
                            !actionsToTime
                          }
                          className="bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed h-10 px-6 font-medium"
                        >
                          Apply Date/Time Filter
                        </Button>

                        {(actionsSearchName ||
                          actionsStatusFilter !== "all" ||
                          appliedActionsFromDate ||
                          appliedActionsFromTime ||
                          appliedActionsToDate ||
                          appliedActionsToTime) && (
                          <Button
                            variant="outline"
                            onClick={handleClearActionsFilters}
                            className="h-10 px-6"
                          >
                            Clear All Filters
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Stats for Recently Managed Volunteer Actions */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>
                            Showing {actionsStartIndex + 1}-
                            {Math.min(
                              actionsEndIndex,
                              sortedRecentActions.length
                            )}{" "}
                            of {sortedRecentActions.length} entries
                            {appliedActionsFromDate &&
                              appliedActionsFromTime &&
                              appliedActionsToDate &&
                              appliedActionsToTime && (
                                <span className="ml-2 text-indigo-600">
                                  (filtered from{" "}
                                  {new Date(
                                    `${appliedActionsFromDate}T${appliedActionsFromTime}`
                                  ).toLocaleString()}{" "}
                                  to{" "}
                                  {new Date(
                                    `${appliedActionsToDate}T${appliedActionsToTime}`
                                  ).toLocaleString()}
                                  )
                                </span>
                              )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-blue-700 font-medium">
                              {actionsStatusFilter === "all"
                                ? "Total Hours (All Status)"
                                : `Total Hours (${
                                    actionsStatusFilter
                                      .charAt(0)
                                      .toUpperCase() +
                                    actionsStatusFilter.slice(1)
                                  } Status)`}
                              : {totalRecentActionHours.toFixed(1)} hours
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Actions Table */}
                    <ShadTable
                      key={`actions-table-${actionsStatusFilter}-${actionsSearchName}-${actionsCurrentPage}`}
                      columns={[
                        {
                          header: "User",
                          render: (action: any) => (
                            <div>
                              <div className="font-medium">
                                {action.user.firstName} {action.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {action.user.email}
                              </div>
                            </div>
                          ),
                        },
                        {
                          header: "Date",
                          render: (action: any) =>
                            new Date(action.startTime).toLocaleDateString(),
                        },
                        {
                          header: "Time",
                          render: (action: any) => {
                            const start = new Date(action.startTime);
                            const end = new Date(action.endTime);
                            return `${start.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} - ${end.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`;
                          },
                        },
                        {
                          header: "Status History",
                          render: (action: any) => {
                            const currentStatus = action.status;
                            const previousStatus = action.previousStatus;

                            return (
                              <div className="flex flex-col items-center space-y-1">
                                {/* Status Change Display */}
                                <div className="flex items-center justify-center space-x-2">
                                  {previousStatus && (
                                    <>
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          previousStatus === "approved"
                                            ? "bg-green-100 text-green-800"
                                            : previousStatus === "denied"
                                              ? "bg-red-100 text-red-800"
                                              : previousStatus === "resolved"
                                                ? "bg-purple-100 text-purple-800"
                                                : "bg-indigo-100 text-indigo-800"
                                        }`}
                                      >
                                        {previousStatus
                                          .charAt(0)
                                          .toUpperCase() +
                                          previousStatus.slice(1)}
                                      </span>
                                      <span className="text-gray-400">→</span>
                                    </>
                                  )}
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      currentStatus === "approved"
                                        ? "bg-green-100 text-green-800"
                                        : currentStatus === "denied"
                                          ? "bg-red-100 text-red-800"
                                          : currentStatus === "resolved"
                                            ? "bg-purple-100 text-purple-800"
                                            : "bg-indigo-100 text-indigo-800"
                                    }`}
                                  >
                                    {currentStatus.charAt(0).toUpperCase() +
                                      currentStatus.slice(1)}
                                  </span>
                                </div>

                                {action.isResubmission && (
                                  <div className="flex justify-center">
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Resubmission
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          },
                        },
                        {
                          header: "Last Modified",
                          render: (action: any) =>
                            new Date(action.updatedAt).toLocaleString(),
                        },
                      ]}
                      data={paginatedRecentActions}
                      emptyMessage="No recent actions found"
                    />

                    {/* Pagination for Recent Actions */}
                    <Pagination
                      currentPage={actionsCurrentPage}
                      totalPages={actionsTotalPages}
                      onPageChange={setActionsCurrentPage}
                      maxVisiblePages={50}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="plannedClosures">
                <Card>
                  <CardHeader>
                    <CardTitle>Planned Closures for Level 3 Users</CardTitle>
                    <CardDescription>
                      Set specific time periods when level 3 users cannot book
                      equipment. Level 4 users will still be able to book during
                      these times.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6">
                        <h3 className="text-blue-800 font-medium mb-1">
                          About Planned Closures
                        </h3>
                        <p className="text-blue-700 text-sm">
                          Use this feature to block equipment bookings for level
                          3 users during special events, holidays, or
                          maintenance periods. Level 4 users will still be able
                          to make bookings during these times.
                        </p>
                      </div>

                      {/* Add new closure form */}
                      <div className="border p-4 rounded-md bg-gray-50">
                        <h3 className="font-medium mb-3">
                          Add New Planned Closure
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="start-date">Start Date</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={
                                newClosure.startDate.toISOString().split("T")[0]
                              }
                              onChange={(e) => {
                                const date = new Date(e.target.value);
                                setNewClosure((prev) => ({
                                  ...prev,
                                  startDate: date,
                                }));
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="start-time">Start Time</Label>
                            <select
                              id="start-time"
                              className="w-full rounded-md border border-gray-300 p-2"
                              value={newClosure.startTime}
                              onChange={(e) =>
                                setNewClosure((prev) => ({
                                  ...prev,
                                  startTime: e.target.value,
                                }))
                              }
                            >
                              {timeOptions.map((time) => (
                                <option key={`start-${time}`} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="end-date">End Date</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={
                                newClosure.endDate.toISOString().split("T")[0]
                              }
                              onChange={(e) => {
                                const date = new Date(e.target.value);
                                setNewClosure((prev) => ({
                                  ...prev,
                                  endDate: date,
                                }));
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="end-time">End Time</Label>
                            <select
                              id="end-time"
                              className="w-full rounded-md border border-gray-300 p-2"
                              value={newClosure.endTime}
                              onChange={(e) =>
                                setNewClosure((prev) => ({
                                  ...prev,
                                  endTime: e.target.value,
                                }))
                              }
                            >
                              {timeOptions.map((time) => (
                                <option key={`end-${time}`} value={time}>
                                  {time}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button
                          onClick={handleAddClosure}
                          className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                          Add Closure Period
                        </Button>

                        {/* Validation Error Dialog */}
                        <AlertDialog
                          open={validationError.show}
                          onOpenChange={(open) =>
                            setValidationError((prev) => ({
                              ...prev,
                              show: open,
                            }))
                          }
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {validationError.title}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {validationError.message}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogAction
                                onClick={() =>
                                  setValidationError({
                                    ...validationError,
                                    show: false,
                                  })
                                }
                              >
                                OK
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* List of existing closures */}
                      <div className="mt-6">
                        <h3 className="font-medium mb-3">
                          Current Planned Closures
                        </h3>
                        {plannedClosures.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-md border border-gray-200">
                            No planned closures set. Add one using the form
                            above.
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Start Date & Time</TableHead>
                                <TableHead>End Date & Time</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead className="text-right">
                                  Actions
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {plannedClosures.map((closure) => {
                                const start = new Date(closure.startDate);
                                const end = new Date(closure.endDate);
                                const durationMs =
                                  end.getTime() - start.getTime();
                                const durationDays = Math.floor(
                                  durationMs / (1000 * 60 * 60 * 24)
                                );
                                const durationHours = Math.floor(
                                  (durationMs % (1000 * 60 * 60 * 24)) /
                                    (1000 * 60 * 60)
                                );

                                return (
                                  <TableRow key={closure.id}>
                                    <TableCell className="font-medium">
                                      {closure.id}
                                    </TableCell>
                                    <TableCell>
                                      {start.toLocaleDateString()}{" "}
                                      {start.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </TableCell>
                                    <TableCell>
                                      {end.toLocaleDateString()}{" "}
                                      {end.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </TableCell>
                                    <TableCell>
                                      {durationDays > 0
                                        ? `${durationDays} day${
                                            durationDays !== 1 ? "s" : ""
                                          }`
                                        : ""}
                                      {durationHours > 0
                                        ? `${
                                            durationDays > 0 ? ", " : ""
                                          }${durationHours} hour${
                                            durationHours !== 1 ? "s" : ""
                                          }`
                                        : ""}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <ConfirmButton
                                        confirmTitle="Confirm Delete"
                                        confirmDescription="Are you sure you want to delete this planned closure? This action cannot be undone."
                                        onConfirm={() =>
                                          handleDeleteClosure(closure.id)
                                        }
                                        buttonLabel="Delete"
                                        buttonClassName="bg-red-500 hover:bg-red-600 text-white"
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cancelledEvents">
                {/* Unresolved Workshop Cancelled Events Card */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Workshop Cancelled Events</CardTitle>
                    <CardDescription>
                      View and manage unresolved workshop cancellations to track
                      refunds and resolve user issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShadTable
                      columns={[
                        {
                          header: "User",
                          render: (cancellation: any) => (
                            <div>
                              <div className="font-medium">
                                {cancellation.user.firstName}{" "}
                                {cancellation.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cancellation.user.email}
                              </div>
                            </div>
                          ),
                        },
                        {
                          header: "Workshop Name",
                          render: (cancellation: any) =>
                            cancellation.workshop.name,
                        },
                        {
                          header: "Workshop Time(s)",
                          render: (cancellation: any) => {
                            const startDate = new Date(
                              cancellation.workshopOccurrence.startDate
                            );
                            const endDate = new Date(
                              cancellation.workshopOccurrence.endDate
                            );

                            // Check if this is a multi-day workshop
                            const isMultiDay =
                              cancellation.workshop.type === "multi_day" ||
                              (cancellation.workshopOccurrence.connectId !==
                                null &&
                                cancellation.workshopOccurrence.connectId !==
                                  undefined);

                            if (isMultiDay) {
                              // Multi-day workshop with clickable link - show Connect ID
                              return (
                                <div className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`/dashboard/workshops/${cancellation.workshop.id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Multi-Day Workshop
                                    </a>
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Connect ID:{" "}
                                    {cancellation.workshopOccurrence.connectId}
                                  </div>
                                </div>
                              );
                            } else {
                              // Single occurrence workshop
                              return (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {startDate.toLocaleDateString()}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {startDate.toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    →{" "}
                                    {endDate.toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                </div>
                              );
                            }
                          },
                        },
                        {
                          header: "Price Variation",
                          render: (cancellation: any) =>
                            cancellation.priceVariation ? (
                              <span className="text-sm font-medium">
                                {cancellation.priceVariation.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            ),
                        },
                        {
                          header: "Stripe Payment ID",
                          render: (cancellation: any) => (
                            <div className="text-sm font-mono">
                              {cancellation.stripePaymentIntentId || "N/A"}
                            </div>
                          ),
                        },
                        {
                          header: "Eligible for Refund",
                          render: (cancellation: any) => {
                            const cancellationDate = new Date(
                              cancellation.cancellationDate
                            );

                            // Check if this is a multi-day workshop
                            const isMultiDay =
                              cancellation.workshop.type === "multi_day" ||
                              (cancellation.workshopOccurrence.connectId !==
                                null &&
                                cancellation.workshopOccurrence.connectId !==
                                  undefined);

                            let workshopStartDate: Date;

                            if (
                              isMultiDay &&
                              cancellation.allOccurrences &&
                              cancellation.allOccurrences.length > 0
                            ) {
                              // For multi-day workshops, find the earliest start date from all occurrences
                              const earliestOccurrence =
                                cancellation.allOccurrences.reduce(
                                  (earliest: any, current: any) => {
                                    const currentStart = new Date(
                                      current.startDate
                                    );
                                    const earliestStart = new Date(
                                      earliest.startDate
                                    );
                                    return currentStart < earliestStart
                                      ? current
                                      : earliest;
                                  }
                                );
                              workshopStartDate = new Date(
                                earliestOccurrence.startDate
                              );
                            } else {
                              // For regular workshops, use the single occurrence start date
                              workshopStartDate = new Date(
                                cancellation.workshopOccurrence.startDate
                              );
                            }

                            // Check if cancelled at least 2 days before the workshop start time
                            const eligibleDate = new Date(
                              workshopStartDate.getTime() -
                                2 * 24 * 60 * 60 * 1000
                            );
                            const isEligible = cancellationDate <= eligibleDate;

                            return (
                              <div className="flex items-center">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    isEligible
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {isEligible ? "Yes" : "No"}
                                </span>
                              </div>
                            );
                          },
                        },
                        {
                          header: "Resolved?",
                          render: (cancellation: any) => (
                            <WorkshopCancellationResolvedControl
                              cancellation={cancellation}
                            />
                          ),
                        },
                      ]}
                      data={paginatedUnresolvedCancellations}
                      emptyMessage="No unresolved cancelled workshop events found"
                    />
                    <WorkshopCancellationsPagination
                      currentPage={unresolvedCurrentPage}
                      totalPages={unresolvedTotalPages}
                      setCurrentPage={setUnresolvedCurrentPage}
                    />
                  </CardContent>
                </Card>

                {/* Resolved Workshop Cancelled Events Card */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Resolved Workshop Cancelled Events</CardTitle>
                    <CardDescription>
                      Previously resolved workshop cancellations for reference
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShadTable
                      columns={[
                        {
                          header: "User",
                          render: (cancellation: any) => (
                            <div>
                              <div className="font-medium">
                                {cancellation.user.firstName}{" "}
                                {cancellation.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cancellation.user.email}
                              </div>
                            </div>
                          ),
                        },
                        {
                          header: "Workshop Name",
                          render: (cancellation: any) =>
                            cancellation.workshop.name,
                        },
                        {
                          header: "Workshop Time(s)",
                          render: (cancellation: any) => {
                            const startDate = new Date(
                              cancellation.workshopOccurrence.startDate
                            );
                            const endDate = new Date(
                              cancellation.workshopOccurrence.endDate
                            );

                            // Check if this is a multi-day workshop
                            const isMultiDay =
                              cancellation.workshop.type === "multi_day" ||
                              (cancellation.workshopOccurrence.connectId !==
                                null &&
                                cancellation.workshopOccurrence.connectId !==
                                  undefined);

                            if (isMultiDay) {
                              // Multi-day workshop with clickable link - show Connect ID
                              return (
                                <div className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`/dashboard/workshops/${cancellation.workshop.id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Multi-Day Workshop
                                    </a>
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    Connect ID:{" "}
                                    {cancellation.workshopOccurrence.connectId}
                                  </div>
                                </div>
                              );
                            } else {
                              // Single occurrence workshop
                              return (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {startDate.toLocaleDateString()}
                                  </div>
                                  <div className="text-gray-500 text-xs">
                                    {startDate.toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    →{" "}
                                    {endDate.toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                </div>
                              );
                            }
                          },
                        },
                        {
                          header: "Price Variation",
                          render: (cancellation: any) =>
                            cancellation.priceVariation ? (
                              <span className="text-sm font-medium">
                                {cancellation.priceVariation.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            ),
                        },
                        {
                          header: "Stripe Payment ID",
                          render: (cancellation: any) => (
                            <div className="text-sm font-mono">
                              {cancellation.stripePaymentIntentId || "N/A"}
                            </div>
                          ),
                        },
                        {
                          header: "Eligible for Refund",
                          render: (cancellation: any) => {
                            const cancellationDate = new Date(
                              cancellation.cancellationDate
                            );

                            // Check if this is a multi-day workshop
                            const isMultiDay =
                              cancellation.workshop.type === "multi_day" ||
                              (cancellation.workshopOccurrence.connectId !==
                                null &&
                                cancellation.workshopOccurrence.connectId !==
                                  undefined);

                            let workshopStartDate: Date;

                            if (
                              isMultiDay &&
                              cancellation.allOccurrences &&
                              cancellation.allOccurrences.length > 0
                            ) {
                              // For multi-day workshops, find the earliest start date from all occurrences
                              const earliestOccurrence =
                                cancellation.allOccurrences.reduce(
                                  (earliest: any, current: any) => {
                                    const currentStart = new Date(
                                      current.startDate
                                    );
                                    const earliestStart = new Date(
                                      earliest.startDate
                                    );
                                    return currentStart < earliestStart
                                      ? current
                                      : earliest;
                                  }
                                );
                              workshopStartDate = new Date(
                                earliestOccurrence.startDate
                              );
                            } else {
                              // For regular workshops, use the single occurrence start date
                              workshopStartDate = new Date(
                                cancellation.workshopOccurrence.startDate
                              );
                            }

                            // Check if cancelled at least 2 days before the workshop start time
                            const eligibleDate = new Date(
                              workshopStartDate.getTime() -
                                2 * 24 * 60 * 60 * 1000
                            );
                            const isEligible = cancellationDate <= eligibleDate;

                            return (
                              <div className="flex items-center">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    isEligible
                                      ? "bg-green-100 text-green-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {isEligible ? "Yes" : "No"}
                                </span>
                              </div>
                            );
                          },
                        },
                        {
                          header: "Resolved",
                          render: (cancellation: any) => (
                            <WorkshopCancellationResolvedControl
                              cancellation={cancellation}
                            />
                          ),
                        },
                      ]}
                      data={paginatedResolvedCancellations}
                      emptyMessage="No resolved cancelled workshop events found"
                    />
                    <WorkshopCancellationsPagination
                      currentPage={resolvedCurrentPage}
                      totalPages={resolvedTotalPages}
                      setCurrentPage={setResolvedCurrentPage}
                    />
                  </CardContent>
                </Card>

                {/* Equipment Cancelled Events Card */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Equipment Cancelled Events</CardTitle>
                    <CardDescription>
                      View and manage unresolved equipment cancellations to
                      track refunds and resolve user issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShadTable
                      columns={[
                        {
                          header: "User",
                          render: (cancellation: any) => (
                            <div>
                              <div className="font-medium">
                                {cancellation.user.firstName}{" "}
                                {cancellation.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cancellation.user.email}
                              </div>
                            </div>
                          ),
                        },
                        {
                          header: "Equipment Name",
                          render: (cancellation: any) => (
                            <div className="font-medium">
                              {cancellation.equipment.name}
                            </div>
                          ),
                        },
                        {
                          header: "Equipment Time(s)",
                          render: (cancellation: any) => {
                            const times = cancellation.cancelledSlotTimes;
                            if (!times || times.length === 0) {
                              return (
                                <span className="text-gray-500">No times</span>
                              );
                            }

                            if (times.length === 1) {
                              const time = times[0];
                              return (
                                <div className="text-sm">
                                  {new Date(
                                    time.startTime
                                  ).toLocaleDateString()}{" "}
                                  {new Date(time.startTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}{" "}
                                  -{" "}
                                  {new Date(time.endTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </div>
                              );
                            }

                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="p-0 h-auto text-sm"
                                    >
                                      {times.length} time slots
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {times.map((time: any, index: number) => (
                                        <div key={index} className="text-xs">
                                          {new Date(
                                            time.startTime
                                          ).toLocaleDateString()}{" "}
                                          {new Date(
                                            time.startTime
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}{" "}
                                          -{" "}
                                          {new Date(
                                            time.endTime
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          },
                        },
                        {
                          header: "Slots Refunded / Total",
                          render: (cancellation: any) => {
                            // Calculate cumulative slots refunded for this payment intent
                            const cumulativeRefunded = equipmentCancellations
                              .filter(
                                (c) =>
                                  c.userId === cancellation.userId &&
                                  c.equipmentId === cancellation.equipmentId &&
                                  c.paymentIntentId ===
                                    cancellation.paymentIntentId &&
                                  c.id <= cancellation.id // Only count cancellations up to this one
                              )
                              .reduce((total, c) => total + c.slotsRefunded, 0);

                            return (
                              <div className="text-sm font-medium">
                                {cumulativeRefunded}/
                                {cancellation.totalSlotsBooked}
                              </div>
                            );
                          },
                        },
                        {
                          header: "Price to Refund",
                          render: (cancellation: any) => (
                            <div className="text-sm font-medium">
                              ${cancellation.priceToRefund.toFixed(2)}
                            </div>
                          ),
                        },
                        {
                          header: "Total Price Paid",
                          render: (cancellation: any) => (
                            <div className="text-sm font-medium">
                              ${cancellation.totalPricePaid.toFixed(2)}
                            </div>
                          ),
                        },
                        {
                          header: "Stripe Payment ID",
                          render: (cancellation: any) => (
                            <div className="text-sm font-mono">
                              {cancellation.paymentIntentId ? (
                                <span className="text-blue-600">
                                  {cancellation.paymentIntentId}
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  No Payment ID
                                </span>
                              )}
                            </div>
                          ),
                        },
                        {
                          header: "Eligible for Refund",
                          render: (cancellation: any) => (
                            <div>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  cancellation.eligibleForRefund
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {cancellation.eligibleForRefund ? "Yes" : "No"}
                              </span>
                            </div>
                          ),
                        },
                        {
                          header: "Resolved?",
                          render: (cancellation: any) => (
                            <EquipmentCancellationResolvedControl
                              cancellation={cancellation}
                            />
                          ),
                        },
                      ]}
                      data={paginatedEquipmentUnresolvedCancellations}
                      emptyMessage="No unresolved cancelled equipment events found"
                    />
                    <EquipmentCancellationsPagination
                      currentPage={equipmentUnresolvedCurrentPage}
                      totalPages={equipmentUnresolvedTotalPages}
                      setCurrentPage={setEquipmentUnresolvedCurrentPage}
                    />
                  </CardContent>
                </Card>

                {/* Resolved Equipment Cancelled Events Card */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Resolved Equipment Cancelled Events</CardTitle>
                    <CardDescription>
                      Previously resolved equipment cancellations for reference
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShadTable
                      columns={[
                        {
                          header: "User",
                          render: (cancellation: any) => (
                            <div>
                              <div className="font-medium">
                                {cancellation.user.firstName}{" "}
                                {cancellation.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {cancellation.user.email}
                              </div>
                            </div>
                          ),
                        },
                        {
                          header: "Equipment Name",
                          render: (cancellation: any) => (
                            <div className="font-medium">
                              {cancellation.equipment.name}
                            </div>
                          ),
                        },
                        {
                          header: "Equipment Time(s)",
                          render: (cancellation: any) => {
                            const times = cancellation.cancelledSlotTimes;
                            if (!times || times.length === 0) {
                              return (
                                <span className="text-gray-500">No times</span>
                              );
                            }

                            if (times.length === 1) {
                              const time = times[0];
                              return (
                                <div className="text-sm">
                                  {new Date(
                                    time.startTime
                                  ).toLocaleDateString()}{" "}
                                  {new Date(time.startTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}{" "}
                                  -{" "}
                                  {new Date(time.endTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </div>
                              );
                            }

                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="p-0 h-auto text-sm"
                                    >
                                      {times.length} time slots
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      {times.map((time: any, index: number) => (
                                        <div key={index} className="text-xs">
                                          {new Date(
                                            time.startTime
                                          ).toLocaleDateString()}{" "}
                                          {new Date(
                                            time.startTime
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}{" "}
                                          -{" "}
                                          {new Date(
                                            time.endTime
                                          ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          },
                        },
                        {
                          header: "Slots Refunded / Total",
                          render: (cancellation: any) => {
                            // Calculate cumulative slots refunded for this payment intent
                            const cumulativeRefunded = equipmentCancellations
                              .filter(
                                (c) =>
                                  c.userId === cancellation.userId &&
                                  c.equipmentId === cancellation.equipmentId &&
                                  c.paymentIntentId ===
                                    cancellation.paymentIntentId &&
                                  c.id <= cancellation.id // Only count cancellations up to this one
                              )
                              .reduce((total, c) => total + c.slotsRefunded, 0);

                            return (
                              <div className="text-sm font-medium">
                                {cumulativeRefunded}/
                                {cancellation.totalSlotsBooked}
                              </div>
                            );
                          },
                        },
                        {
                          header: "Price to Refund",
                          render: (cancellation: any) => (
                            <div className="text-sm font-medium">
                              ${cancellation.priceToRefund.toFixed(2)}
                            </div>
                          ),
                        },
                        {
                          header: "Total Price Paid",
                          render: (cancellation: any) => (
                            <div className="text-sm font-medium">
                              ${cancellation.totalPricePaid.toFixed(2)}
                            </div>
                          ),
                        },
                        {
                          header: "Stripe Payment ID",
                          render: (cancellation: any) => (
                            <div className="text-sm font-mono">
                              {cancellation.paymentIntentId ? (
                                <span className="text-blue-600">
                                  {cancellation.paymentIntentId}
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  No Payment ID
                                </span>
                              )}
                            </div>
                          ),
                        },
                        {
                          header: "Eligible for Refund",
                          render: (cancellation: any) => (
                            <div>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  cancellation.eligibleForRefund
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {cancellation.eligibleForRefund ? "Yes" : "No"}
                              </span>
                            </div>
                          ),
                        },
                        {
                          header: "Resolved",
                          render: (cancellation: any) => (
                            <EquipmentCancellationResolvedControl
                              cancellation={cancellation}
                            />
                          ),
                        },
                      ]}
                      data={paginatedEquipmentResolvedCancellations}
                      emptyMessage="No resolved cancelled equipment events found"
                    />
                    <EquipmentCancellationsPagination
                      currentPage={equipmentResolvedCurrentPage}
                      totalPages={equipmentResolvedTotalPages}
                      setCurrentPage={setEquipmentResolvedCurrentPage}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Miscellaneous Settings */}
              <TabsContent value="miscellaneous">
                <Form method="post" className="space-y-6">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input
                    type="hidden"
                    name="settingType"
                    value="gstPercentage"
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Tax Settings</CardTitle>
                      <CardDescription>
                        Configure tax rates applied to all payments
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="gstPercentage">
                          GST/HST Percentage
                        </Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="gstPercentage"
                            name="gstPercentage"
                            type="number"
                            value={gstPercentage}
                            onChange={(e) => setGstPercentage(e.target.value)}
                            min="0"
                            max="20"
                            step="0.1"
                            className="w-24"
                          />
                          <span className="text-sm text-gray-600">%</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          GST/HST tax percentage applied to all payments.
                          Standard Canadian GST is 5%. HST varies by province
                          (13% in Ontario, 15% in Atlantic Canada). This rate
                          will be applied to all memberships, workshops, and
                          equipment bookings.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-indigo-500 hover:bg-indigo-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Tax Settings
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>
              </TabsContent>

              <TabsContent value="integrations">
                <Card>
                  <CardHeader>
                    <CardTitle>Google Calendar</CardTitle>
                    <CardDescription>
                      Connect an organization Google account and choose a public
                      calendar. New workshops and orientations will be published
                      automatically. You can make the calendar public in Google
                      Calendar settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* @ts-ignore server-injected via loader */}
                    {(() => {
                      const data = (
                        typeof window === "undefined" ? undefined : undefined
                      ) as any;
                      return null;
                    })()}
                    {/* Using loader data through hook */}
                    {(() => {
                      const { google } = (useLoaderData() as any) || {
                        google: {},
                      };
                      return (
                        <div className="space-y-4">
                          {!google?.connected ? (
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600">
                                Not connected to Google Calendar.
                              </p>
                              <a
                                href="/api/google-calendar/connect"
                                className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md"
                              >
                                Connect Google
                              </a>
                              <p className="text-xs text-gray-500">
                                After granting access, you will come back here
                                to select a calendar.
                              </p>
                            </div>
                          ) : (
                            <Form method="post" className="space-y-4">
                              <input
                                type="hidden"
                                name="actionType"
                                value="googleCalendarSave"
                              />
                              <div className="space-y-2">
                                <Label htmlFor="googleCalendarId">
                                  Select Calendar
                                </Label>
                                <select
                                  id="googleCalendarId"
                                  name="googleCalendarId"
                                  defaultValue={
                                    google?.selectedCalendarId || ""
                                  }
                                  className="border rounded px-3 py-2 w-full max-w-md"
                                >
                                  <option value="" disabled>
                                    Choose a calendar
                                  </option>
                                  {google?.calendars?.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.summary} ({c.id})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-xs text-gray-500">
                                  Ensure this calendar is public in Google
                                  Calendar settings to embed it on the website.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="googleTimezone">Timezone</Label>
                                <Input
                                  id="googleTimezone"
                                  name="googleTimezone"
                                  type="text"
                                  defaultValue={
                                    google?.timezone || "America/Yellowknife"
                                  }
                                  className="w-full max-w-md"
                                />
                                <p className="text-xs text-gray-500">
                                  Use a valid IANA timezone like
                                  America/Yellowknife.
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button
                                  type="submit"
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white"
                                >
                                  Save Google Calendar Settings
                                </Button>
                                <a
                                  href="/api/google-calendar/disconnect"
                                  className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
                                >
                                  Sign out
                                </a>
                              </div>
                            </Form>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="securityAccess">
                <div className="flex flex-col space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Access Provisioning</CardTitle>
                      <CardDescription>
                        Manage and view access card details including assignee
                        and permissions.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      {/* Info Box */}
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6">
                        <h3 className="text-blue-800 font-medium mb-1">
                          Access Card Provisioning
                        </h3>
                        <p className="text-blue-700 text-sm">
                          Use this feature to view or register access cards.
                          Provide the UUID of a card to fetch details such as
                          assignee information and equipment permissions.
                        </p>
                      </div>

                      {/* Search Section */}
                      <div className="border p-4 rounded-md bg-gray-50">
                        <h3 className="font-medium mb-3">Search Card</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                          {/* UUID Input */}
                          <div className="space-y-2">
                            <Label htmlFor="uuid">Card UUID</Label>
                            <Input
                              id="uuid"
                              type="text"
                              placeholder="Enter card UUID"
                              value={cardUUID}
                              onChange={(e) => setCardUUID(e.target.value)}
                              className="bg-white"
                            />
                          </div>

                          {/* Search Button */}
                          <Button
                            onClick={handleSearchCard}
                            className="bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            Search
                          </Button>
                        </div>

                        {/* Card Info Display */}
                        {actionData?.accessCard && (
                          <div className="mt-6 border-t pt-4">
                            <h4 className="font-semibold text-gray-800 mb-3">
                              Card Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                              <p>
                                <span className="font-medium">Card UUID:</span>{" "}
                                {actionData.accessCard.id || "Unknown"}
                              </p>
                              <p>
                                <span className="font-medium">User Name:</span>{" "}
                                {actionData.accessCard.userId
                                  ? `${actionData.accessCard.userFirstName} ${actionData.accessCard.userLastName}`
                                  : "Unassigned"}
                              </p>

                              {/* Editable User Email */}
                              <div className="space-y-1">
                                <Label htmlFor="email">User Email</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="Enter user email"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  className="bg-white text-sm"
                                />
                              </div>
                              <p>
                                <span className="font-medium">
                                  Last Updated:
                                </span>{" "}
                                {actionData.accessCardExists
                                  ? new Date(
                                      actionData.accessCard.updatedAt
                                    ).toLocaleString()
                                  : "Unregistered"}
                              </p>
                            </div>

                            {/* Permissions */}
                            <div className="mt-5">
                              <h4 className="font-semibold text-gray-800 mb-2">
                                Equipment Permissions
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {allEquipments.map((eq) => {
                                  const hasPermission = permissions.includes(
                                    eq.id
                                  );
                                  return (
                                    <div
                                      key={eq.id}
                                      className={`flex items-center space-x-2 p-2 rounded-md border ${
                                        hasPermission
                                          ? "bg-green-50 border-green-200"
                                          : "bg-gray-50 border-gray-200"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={hasPermission}
                                        onChange={() => {
                                          setPermissions((prev) =>
                                            prev.includes(eq.id)
                                              ? prev.filter((p) => p !== eq.id)
                                              : [...prev, eq.id]
                                          );
                                        }}
                                        className="h-4 w-4 text-green-600 border-gray-300 rounded cursor-pointer"
                                      />
                                      <span
                                        className={`text-sm ${
                                          hasPermission
                                            ? "text-green-700"
                                            : "text-gray-600"
                                        }`}
                                      >
                                        {eq.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mt-6">
                              <Button
                                onClick={handleUpdate}
                                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                                disabled={
                                  email === actionData.accessCard.userEmail &&
                                  JSON.stringify(permissions) ===
                                    JSON.stringify(
                                      actionData.accessCard.permissions
                                    )
                                }
                              >
                                {actionData.accessCardExists ? "Update" : "Register"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Access Token */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Access Tokens</CardTitle>
                      <CardDescription>
                        Manage API access tokens for equipment and door locking
                        systems.
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6">
                        <h3 className="text-blue-800 font-medium mb-1">
                          Generating Access Tokens
                        </h3>
                        <p className="text-blue-700 text-sm">
                          Use this feature to get access tokens for internal
                          locking and logging devices for equipment and doors.
                          Select the equipment type or "Door" and provide a tag
                          to uniquely identify the device. Save the generated
                          access token in the device for authentication with the
                          server.
                        </p>
                      </div>

                      <div className="border p-4 rounded-md bg-gray-50">
                        <h3 className="font-medium mb-3">
                          Generate New Access Token
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Equipment Dropdown */}
                          <div className="space-y-2">
                            <Label htmlFor="equipment">
                              Select Equipment or Door
                            </Label>
                            <select
                              id="equipment"
                              className="w-full rounded-md border border-gray-300 p-2"
                              value={selectedEquipment}
                              onChange={(e) =>
                                setSelectedEquipment(e.target.value)
                              }
                            >
                              <option value="">Select Equipment</option>
                              {allEquipments.map((eq) => (
                                <option key={eq.id} value={eq.name}>
                                  {eq.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Tag Input Field */}
                          <div className="space-y-2">
                            <Label htmlFor="tag">Device Tag</Label>
                            <Input
                              id="tag"
                              type="text"
                              placeholder="Enter unique tag identifier"
                              value={deviceTag}
                              onChange={(e) => setDeviceTag(e.target.value)}
                              className="w-full max-w-xs bg-white"
                            />
                          </div>
                        </div>

                        {/* Generate Button */}
                        <Button
                          onClick={generateNeverExpiringToken}
                          className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                          Generate Access Token
                        </Button>

                        {/* Display Generated Token */}
                        {actionData?.token && (
                          <div
                            onClick={() => {
                              navigator.clipboard.writeText(actionData.token!);
                            }}
                            className="mt-4 bg-green-50 border border-green-100 p-3 rounded-md cursor-pointer hover:bg-green-100 transition"
                            title="Click to copy"
                          >
                            <p className="text-green-700 font-mono text-sm break-all">
                              {actionData.token}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              {/* Tabb Placeholder for Future Settings */}
              <TabsContent value="placeholder">
                <Card>
                  <CardHeader>
                    <CardTitle>Other Settings</CardTitle>
                    <CardDescription>
                      Additional settings will be added here in the future
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-500">
                      This section is reserved for future settings.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
