import React, { useState } from "react";
import { Form, useLoaderData, useActionData, redirect } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  updateAdminSetting, 
  getWorkshopVisibilityDays 
} from "~/models/admin.server";
import { getRoleUser } from "~/utils/session.server";

export async function loader({ request }: { request: Request }) {
  // Check if user is admin
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }
  
  // Load current settings
  const workshopVisibilityDays = await getWorkshopVisibilityDays();
  
  // Return settings to the component
  return {
    roleUser,
    settings: {
      workshopVisibilityDays
    }
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
        message: "Settings updated successfully" 
      };
    } catch (error) {
      console.error("Error updating settings:", error);
      return { 
        success: false, 
        message: "Failed to update settings" 
      };
    }
  }
  
  return null;
}

export default function AdminSettings() {
  const { roleUser, settings } = useLoaderData<{
    roleUser: { roleId: number; roleName: string },
    settings: { workshopVisibilityDays: number }
  }>();
  
  const actionData = useActionData<{
    success?: boolean;
    message?: string;
  }>();
  
  const [workshopVisibilityDays, setWorkshopVisibilityDays] = useState(
    settings.workshopVisibilityDays.toString()
  );

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
                className={`mb-6 ${actionData.success ? "bg-green-50" : "bg-red-50"}`}
                variant={actionData.success ? "default" : "destructive"}
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {actionData.success ? "Success" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {actionData.message}
                </AlertDescription>
              </Alert>
            )}
            
            <Form method="post" className="space-y-6">
              <input type="hidden" name="actionType" value="updateSettings" />
              
              <Card>
                <CardHeader>
                  <CardTitle>Workshop Settings</CardTitle>
                  <CardDescription>
                    Configure settings related to workshops
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
                      onChange={(e) => setWorkshopVisibilityDays(e.target.value)}
                      min="1"
                      max="365"
                      className="w-full max-w-xs"
                    />
                    <p className="text-sm text-gray-500">
                      Number of days in the future to display workshop dates. 
                      This controls how far ahead users can see upcoming workshops.
                    </p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  {/* Additional workshop settings can be added here in the future */}
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Additional settings cards can be added here in the future */}
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}