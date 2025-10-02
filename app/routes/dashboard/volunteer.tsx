import { useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/guestsidebar";
import { getRoleUser } from "~/utils/session.server";
import {
  Mail,
  MapPin,
  Clock,
  Heart,
  Users,
  Wrench,
  Monitor,
  Calendar,
  MessageSquare,
  UserPlus,
} from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  return { roleUser };
}

export default function VolunteerPage() {
  const { roleUser } = useLoaderData<{
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    } | null;
  }>();

  const volunteerRoles = [
    {
      title: "Woodshop Supervisor",
      icon: <Wrench className="h-8 w-8 text-indigo-500" />,
      description:
        "Help people with their woodworking projects and ensure they stay safe and following our community guidelines when using the woodshop!",
      skills: ["Safety Knowledge", "Woodworking Experience", "Teaching Skills"],
    },
    {
      title: "Hackspace Supervisor",
      icon: <Monitor className="h-8 w-8 text-indigo-500" />,
      description:
        "Help people use the equipment in the Hackspace. Support them with their digital fabrication projects and ensure they are following our community guidelines.",
      skills: ["Technical Knowledge", "3D Printing", "Digital Fabrication"],
    },
    {
      title: "Front Desk Support",
      icon: <Users className="h-8 w-8 text-indigo-500" />,
      description:
        "Help people sign-in when they visit the makerspace for events and workshops, collect payments and give short tours to visitors.",
      skills: ["Customer Service", "Organization", "Communication"],
    },
    {
      title: "Workshop Facilitator",
      icon: <Calendar className="h-8 w-8 text-indigo-500" />,
      description:
        "Have an idea for a workshop you would like to host at MSYK?",
      skills: ["Teaching", "Subject Expertise", "Workshop Planning"],
    },
    {
      title: "Social Media and Marketing",
      icon: <MessageSquare className="h-8 w-8 text-indigo-500" />,
      description:
        "Support MSYK with our digital communications! Update our Instagram and Facebook, create our monthly newsletter and share content from activities in the space!",
      skills: ["Social Media", "Content Creation", "Marketing"],
    },
    {
      title: "General Event Volunteer",
      icon: <Heart className="h-8 w-8 text-indigo-500" />,
      description:
        "We don't always have events, but when we do we may need volunteers! This could be for tradeshows, concerts at our space, and more. Event volunteers will be notified when an event is on!",
      skills: ["Flexibility", "Event Support", "Community Spirit"],
    },
  ];

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

        <main className="flex-1 overflow-auto bg-gray-50">
          {/* Mobile Header with Sidebar Trigger */}
          <div className="flex items-center gap-4 p-4 md:hidden bg-white border-b">
            <SidebarTrigger />
            <h1 className="text-xl font-bold">Volunteer</h1>
          </div>

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
                  Volunteer
                </h1>
                <p className="text-xl md:text-2xl leading-relaxed mb-8">
                  Want to support the MSYK community?
                  <br />
                  Here's how you can help!
                </p>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-12">
            {/* Introduction Section */}
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Join Our Community of Makers
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Volunteering at Makerspace YK is a rewarding way to give back to
                the community, share your skills, and help others discover the
                joy of making. Whether you have technical expertise or just
                enthusiasm to help, there's a place for you!
              </p>

              {/* Volunteer Hours Tracking Section */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Clock className="h-8 w-8 text-blue-500" />
                  <h3 className="text-xl font-semibold text-blue-900">
                    Track Your Volunteer Hours
                  </h3>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  Once you become a volunteer, you'll be able to log and track
                  your volunteer hours directly in your profile. This helps us
                  recognize your contributions and provides you with a record of
                  your community service for personal or professional use.
                </p>
              </div>

              {/* Contact Information Cards */}
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <Card className="border-2 border-indigo-200 hover:border-indigo-300 transition-colors">
                  <CardContent className="p-8 text-center">
                    <Mail className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      Email Us
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Send us an email with your interests and availability
                    </p>
                    <Button
                      className="bg-indigo-500 hover:bg-indigo-600 text-white"
                      onClick={() =>
                        window.open("mailto:info@makerspaceyk.com", "_blank")
                      }
                    >
                      info@makerspaceyk.com
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-indigo-200 hover:border-indigo-300 transition-colors">
                  <CardContent className="p-8 text-center">
                    <MapPin className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      Visit Our Space
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Come by during our open hours to learn more about
                      volunteering
                    </p>
                    <Button
                      variant="outline"
                      className="border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                      onClick={() =>
                        window.open(
                          "https://www.google.com/maps/place/Makerspace+YK/@62.4457716,-114.3921434,17z/data=!3m1!4b1!4m6!3m5!1s0x53d1f793bd5706f1:0xf9c85b974c229a12!8m2!3d62.4457691!4d-114.3895685!16s%2Fg%2F11tjfg42z0?entry=ttu&g_ep=EgoyMDI1MDcyMC4wIKXMDSoASAFQAw%3D%3D",
                          "_blank"
                        )
                      }
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      See Our Hours
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Volunteer Opportunities */}
            <div className="mb-16">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Volunteer Opportunities
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Find the perfect role that matches your skills and interests
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {volunteerRoles.map((role, index) => (
                  <Card
                    key={index}
                    className="hover:shadow-lg transition-shadow border border-gray-200"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3 mb-3">
                        {role.icon}
                        <CardTitle className="text-lg text-gray-900">
                          {role.title}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-gray-600 mb-4 leading-relaxed">
                        {role.description}
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900">
                          Skills needed:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {role.skills.map((skill, skillIndex) => (
                            <Badge
                              key={skillIndex}
                              variant="outline"
                              className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <Card className="border-2 border-indigo-200 bg-indigo-50/50">
                <CardContent className="p-12">
                  <UserPlus className="h-16 w-16 text-indigo-500 mx-auto mb-6" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Ready to Get Started?
                  </h2>
                  <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                    Whether you want to share your expertise, learn new skills,
                    or simply be part of an amazing community, we'd love to have
                    you join our volunteer team.
                    {!isGuest && (
                      <span className="block mt-4 text-blue-600 font-medium">
                        As a registered user, you'll be able to track your
                        volunteer hours in your profile once you become a
                        volunteer!
                      </span>
                    )}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      size="lg"
                      className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3"
                      onClick={() =>
                        window.open("mailto:info@makerspaceyk.com", "_blank")
                      }
                    >
                      <Mail className="h-5 w-5 mr-2" />
                      Contact Us Today
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-indigo-500 text-indigo-600 hover:bg-indigo-50 px-8 py-3"
                      onClick={() =>
                        window.open(
                          "https://www.google.com/maps/place/Makerspace+YK/@62.4457716,-114.3921434,17z/data=!3m1!4b1!4m6!3m5!1s0x53d1f793bd5706f1:0xf9c85b974c229a12!8m2!3d62.4457691!4d-114.3895685!16s%2Fg%2F11tjfg42z0?entry=ttu&g_ep=EgoyMDI1MDcyMC4wIKXMDSoASAFQAw%3D%3D",
                          "_blank"
                        )
                      }
                    >
                      <MapPin className="h-5 w-5 mr-2" />
                      Visit Our Space
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
