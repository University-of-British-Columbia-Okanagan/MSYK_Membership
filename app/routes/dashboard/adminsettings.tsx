import React, { useState, useMemo } from "react";
import {
  Form,
  useLoaderData,
  useActionData,
  redirect,
  useSubmit,
} from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
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
import { Separator } from "@/components/ui/separator";
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
} from "~/models/admin.server";
import {
  getLevel3ScheduleRestrictions,
  getLevel4UnavailableHours,
} from "~/models/equipment.server";
import { getWorkshops } from "~/models/workshop.server";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2, Check, X } from "lucide-react";
import { FiSearch } from "react-icons/fi";
import {
  getAllUsers,
  updateUserRole,
  updateUserAllowLevel,
} from "~/models/user.server";
import { ShadTable, type ColumnDefinition } from "@/components/ui/ShadTable";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logger } from "~/logging/logger";

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
  const users = await getAllUsers();

  const level3Schedule = await getLevel3ScheduleRestrictions();
  const level4UnavailableHours = await getLevel4UnavailableHours();

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
      equipmentVisibilityDays,
      level3Schedule,
      level4UnavailableHours,
      plannedClosures,
      maxEquipmentSlotsPerDay: parseInt(maxEquipmentSlotsPerDay, 10),
      maxEquipmentSlotsPerWeek: parseInt(maxEquipmentSlotsPerWeek, 10), // this is in slots, not minutes
      gstPercentage: parseFloat(gstPercentage),
    },
    workshops,
    users,
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

export default function AdminSettings() {
  const { roleUser, settings, workshops, users } = useLoaderData<{
    roleUser: { roleId: number; roleName: string };
    settings: {
      workshopVisibilityDays: number;
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
    }>;
  }>();

  const actionData = useActionData<{
    success?: boolean;
    message?: string;
  }>();

  const submit = useSubmit();

  const [workshopVisibilityDays, setWorkshopVisibilityDays] = useState(
    settings.workshopVisibilityDays.toString()
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
    const defaultSchedule = days.reduce((acc, day) => {
      acc[day] = { start: 9, end: 17, closed: false };
      return acc;
    }, {} as Record<string, { start: number; end: number; closed: boolean }>);

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

  const [searchName, setSearchName] = useState("");
  // Filter users by first and last name
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return searchName === "" || fullName.includes(searchName.toLowerCase());
    });
  }, [users, searchName]);
  // Sort filtered users by user.id in ascending order
  const sortedFilteredUsers = useMemo(() => {
    return filteredUsers.slice().sort((a, b) => a.id - b.id);
  }, [filteredUsers]);

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

  // Define columns for the ShadTable
  type UserRow = (typeof users)[number];
  const columns: ColumnDefinition<UserRow>[] = [
    { header: "First Name", render: (user) => user.firstName },
    { header: "Last Name", render: (user) => user.lastName },
    { header: "Email", render: (user) => user.email },
    { header: "Phone Number", render: (user) => user.phone },
    {
      header: "Training Card User Number",
      render: (user) => user.trainingCardUserNumber,
    },
    { header: "Role Level", render: (user) => <RoleControl user={user} /> },
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

  // Keep the old function name for compatibility but call the new one
  const validateWeeklyLimit = (
    weeklyValue: number,
    weeklyUnit: string
  ): boolean => {
    return validateLimits();
  };

  React.useEffect(() => {
    validateLimits();
  }, [
    maxEquipmentSlotsPerDay.value,
    maxEquipmentSlotsPerDay.unit,
    maxEquipmentSlotsPerWeek.value,
  ]);

  const level3TimeRange = calculateLevel3TimeRange();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AdminAppSidebar />
        <main className="flex-grow p-6 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="h-6 w-6 text-yellow-500" />
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
              <TabsList className="mb-4">
                <TabsTrigger value="workshops">Workshop Settings</TabsTrigger>
                <TabsTrigger value="users">User Settings</TabsTrigger>
                <TabsTrigger value="equipment">Equipment Settings</TabsTrigger>
                <TabsTrigger value="plannedClosures">
                  Planned Closures
                </TabsTrigger>
                <TabsTrigger value="miscellaneous">Miscellaneous Settings</TabsTrigger>
                <TabsTrigger value="placeholder">Other Settings</TabsTrigger>
                {/* Add more tabs here in the future */}
              </TabsList>

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
                      <CardTitle>Workshop Visibility Settings</CardTitle>
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
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Visibility Settings
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
                                    ? cutoffValues[workshop.id] ??
                                      bestUnit.value
                                    : bestUnit.value;
                                const displayUnit =
                                  editingWorkshop === workshop.id
                                    ? cutoffUnits[workshop.id] ?? bestUnit.unit
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
                                    ? cutoffValues[workshop.id] ??
                                      bestUnit.value
                                    : bestUnit.value;
                                const displayUnit =
                                  editingWorkshop === workshop.id
                                    ? cutoffUnits[workshop.id] ?? bestUnit.unit
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
                    <div className="flex items-center gap-2 mb-6">
                      <FiSearch className="text-gray-500" />
                      <Input
                        placeholder="Search by first or last name"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        className="w-full md:w-64"
                      />
                    </div>
                    <ShadTable
                      columns={columns}
                      data={sortedFilteredUsers}
                      emptyMessage="No users found"
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
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
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

                      {/* ADD ERROR DISPLAY FOR DAILY FORM TOO */}
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
                        {/* CHANGE: Simplified to only handle slots */}
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
                        className="bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                    // value={
                    //   maxEquipmentSlotsPerWeek.unit === "hours"
                    //     ? maxEquipmentSlotsPerWeek.value * 2 // Convert hours to 30-min slots
                    //     : maxEquipmentSlotsPerWeek.value
                    // }
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
                        className="bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
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
                      className="bg-yellow-500 hover:bg-yellow-600 text-white"
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
                          className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white"
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

              {/* Tab: Miscellaneous Settings */}
              <TabsContent value="miscellaneous">
                <Form method="post" className="space-y-6">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input type="hidden" name="settingType" value="gstPercentage" />
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
                          GST/HST tax percentage applied to all payments. Standard Canadian GST is 5%. 
                          HST varies by province (13% in Ontario, 15% in Atlantic Canada). This rate 
                          will be applied to all memberships, workshops, and equipment bookings.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Tax Settings
                      </Button>
                    </CardFooter>
                  </Card>
                </Form>
              </TabsContent>

              {/* Tab 2: Placeholder for Future Settings */}
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
