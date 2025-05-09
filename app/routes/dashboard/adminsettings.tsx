import React, { useState } from "react";
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
} from "~/models/admin.server";
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

export async function loader({ request }: { request: Request }) {
  // Check if user is admin
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }

  // Load current settings
  const workshopVisibilityDays = await getWorkshopVisibilityDays();
  const workshops = await getWorkshops();

  // Return settings to the component
  return {
    roleUser,
    settings: {
      workshopVisibilityDays,
    },
    workshops,
  };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "updateSettings") {
    try {
      // Get values from form
      const workshopVisibilityDays = formData.get("workshopVisibilityDays");

      // Update workshop visibility days
      if (workshopVisibilityDays) {
        await updateAdminSetting(
          "workshop_visibility_days",
          workshopVisibilityDays.toString(),
          "Number of days to show future workshop dates"
        );
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

  return null;
}

export default function AdminSettings() {
  const { roleUser, settings, workshops } = useLoaderData<{
    roleUser: { roleId: number; roleName: string };
    settings: { workshopVisibilityDays: number };
    workshops: Array<{
      id: number;
      name: string;
      price: number;
      registrationCutoff: number;
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
  const [editingWorkshop, setEditingWorkshop] = useState<number | null>(null);
  const [cutoffValues, setCutoffValues] = useState<Record<number, number>>({});
  const [cutoffUnits, setCutoffUnits] = useState<Record<number, string>>({});

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
                    <Table>
                      <TableCaption>
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
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workshops.map((workshop) => {
                          // Calculate best display unit for the current value
                          const bestUnit = getBestUnit(
                            workshop.registrationCutoff
                          );
                          const displayValue =
                            editingWorkshop === workshop.id
                              ? cutoffValues[workshop.id] ?? bestUnit.value
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
                                        [workshop.id]: Number(e.target.value),
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
                                    <option value="minutes">Minutes</option>
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
                                      onClick={() => setEditingWorkshop(null)}
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
