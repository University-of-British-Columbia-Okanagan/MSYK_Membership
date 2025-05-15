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

export async function loader({ request }: { request: Request }) {
  // Check if user is admin
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }

  // Load current settings
  const workshopVisibilityDays = await getWorkshopVisibilityDays();
  const equipmentVisibilityDays = await getEquipmentVisibilityDays();

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

  // Return settings to the component
  return {
    roleUser,
    settings: {
      workshopVisibilityDays,
      equipmentVisibilityDays,
      level3Schedule,
      level4UnavailableHours,
    },
    workshops,
    users,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

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

      return {
        success: true,
        message: "Settings updated successfully",
      };
    } catch (error) {
      console.error("Error updating settings:", error);
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

      return {
        success: true,
        message: "Workshop registration cutoff updated successfully",
        workshopId,
      };
    } catch (error) {
      console.error("Error updating workshop cutoff:", error);
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
      return {
        success: true,
        message: "User role updated successfully",
      };
    } catch (error) {
      console.error("Error updating user role:", error);
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
      return {
        success: true,
        message: "User permissions updated successfully",
      };
    } catch (error) {
      console.error("Error updating allowLevel4:", error);
      return {
        success: false,
        message: "Failed to update user permissions",
      };
    }
  }

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
      return { value: minutes / 1440, unit: "day(s)" };
    } else if (minutes >= 60 && minutes % 60 === 0) {
      // Divisible by hours
      return { value: minutes / 60, unit: "hour(s)" };
    } else {
      return { value: minutes, unit: "minute(s)" };
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
                                            setCutoffUnits({
                                              ...cutoffUnits,
                                              [workshop.id]: bestUnit.unit,
                                            });
                                            setCutoffValues({
                                              ...cutoffValues,
                                              [workshop.id]: bestUnit.value,
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
    const currentBestUnit = getBestUnit(workshop.registrationCutoff);
    setCutoffUnits({
      ...cutoffUnits,
      [workshop.id]: currentBestUnit.unit,
    });
    setCutoffValues({
      ...cutoffValues,
      [workshop.id]: currentBestUnit.value,
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
                <Form method="post" className="space-y-6 mb-8">
                  <input
                    type="hidden"
                    name="actionType"
                    value="updateSettings"
                  />
                  <input type="hidden" name="settingType" value="equipment" />
                  <Card>
                    <CardHeader>
                      <CardTitle>Equipment Booking Settings</CardTitle>
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
                      {/* Additional equipment settings can be added here */}
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Equipment Settings
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
