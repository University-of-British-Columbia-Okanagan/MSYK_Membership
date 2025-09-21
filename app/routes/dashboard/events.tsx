import { useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";
import { getRoleUser } from "~/utils/session.server";
import { getAdminSetting } from "~/models/admin.server";
import { isGoogleConnected } from "~/utils/googleCalendar.server";
import {
  Calendar,
  ExternalLink,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const connected = await isGoogleConnected();
  const calendarId = await getAdminSetting("google_calendar_id", "");

  return { roleUser, connected, calendarId };
}

export default function EventsPage() {
  const { roleUser, connected, calendarId } = useLoaderData<{
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    } | null;
    connected: boolean;
    calendarId: string;
  }>();

  // Determine which sidebar to show based on role
  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  const renderSidebar = () => {
    if (isAdmin) {
      return <AdminAppSidebar />;
    } else if (isGuest) {
      return <GuestAppSidebar />;
    } else {
      return <AppSidebar />;
    }
  };

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {renderSidebar()}

        <main className="flex-1 bg-gray-50 overflow-y-auto">
          {/* Hero Section */}
          <div className="relative bg-indigo-500 text-white overflow-hidden">
            <div className="absolute inset-0"></div>
            <div className="relative container mx-auto px-4 py-16 md:py-24">
              <div className="text-center max-w-4xl mx-auto">
                <Badge
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white mb-4"
                >
                  MAKERSPACE YK
                </Badge>
                <h1 className="text-4xl md:text-6xl font-bold mb-6">
                  Event Calendar
                </h1>
                <p className="text-xl md:text-2xl leading-relaxed mb-8">
                  Stay up to date with all our workshops, orientations, and
                  events
                </p>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-4 pb-16">
            {/* Calendar Status Section - Only for Admins */}
            {isAdmin && (
              <div className="mb-8">
                <Card className="border-2 border-indigo-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-indigo-500" />
                        <CardTitle className="text-2xl text-gray-900">
                          Calendar Status
                        </CardTitle>
                      </div>
                      {connected && calendarId ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {connected && calendarId ? (
                      <div className="space-y-4">
                        <p className="text-gray-600">
                          Your Google Calendar is connected and displaying
                          events below.
                        </p>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                            onClick={() =>
                              window.open("/dashboard/admin/settings", "_blank")
                            }
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Manage Settings
                          </Button>
                          <Button
                            variant="outline"
                            className="border-blue-500 text-blue-600 hover:bg-blue-50"
                            onClick={() =>
                              window.open(
                                "https://calendar.google.com",
                                "_blank"
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Google Calendar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-indigo-600 mt-0.5" />
                            <div>
                              <h3 className="font-semibold text-indigo-800 mb-2">
                                Calendar Not Connected
                              </h3>
                              <p className="text-indigo-700 mb-3">
                                The event calendar is not currently connected to
                                Google Calendar.
                              </p>
                                <p className="text-sm text-indigo-600">
                                As an admin, you can connect Google Calendar in{" "}
                                <Button
                                  variant="link"
                                  className="p-0 h-auto text-indigo-600 underline"
                                  onClick={() =>
                                    window.open(
                                      "/dashboard/admin/settings",
                                      "_blank"
                                    )
                                  }
                                >
                                  Dashboard → Admin → Settings → Integrations
                                </Button>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Calendar Display Section */}
            <div>
              <Card className="border border-gray-200 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl text-gray-900 flex items-center gap-3">
                    <Calendar className="h-6 w-6 text-indigo-500" />
                    Upcoming Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {connected && calendarId ? (
                    <iframe
                      src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
                        calendarId
                      )}&ctz=America%2FYellowknife`}
                      style={{ border: 0, width: "100%", height: "700px" }}
                      frameBorder="0"
                      scrolling="no"
                      title="MSYK Events Calendar"
                      className="rounded-b-lg"
                    />
                  ) : (
                    <div
                      className={
                        isAdmin ? "p-12 text-center" : "p-16 text-center"
                      }
                    >
                      <div className="max-w-md mx-auto">
                        <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                          <Calendar className="h-12 w-12 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                          Calendar Coming Soon
                        </h3>
                        <p className="text-gray-600 mb-6">
                          We're working on connecting our event calendar. Check
                          back soon for all upcoming workshops and events!
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>Stay tuned for updates</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
