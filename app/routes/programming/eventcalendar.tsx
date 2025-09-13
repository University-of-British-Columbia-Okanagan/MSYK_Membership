import HeroSection from "@/components/ui/HeroSection";
import Footer from "@/components/ui/Home/Footer";
import { useLoaderData } from "react-router";
import { getAdminSetting } from "~/models/admin.server";
import { isGoogleConnected } from "~/utils/googleCalendar.server";

export async function loader() {
  const connected = await isGoogleConnected();
  const calendarId = await getAdminSetting("google_calendar_id", "");
  return { connected, calendarId };
}

export default function EventCalendarPage() {
  const { connected, calendarId } = useLoaderData() as {
    connected: boolean;
    calendarId: string;
  };
  return (
    <main>
      <HeroSection title="Event Calendar" />
      <section className="py-12 bg-gray-600">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-white rounded-lg p-6 shadow-lg overflow-hidden">
            {connected && calendarId ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(
                    calendarId
                  )}&ctz=America%2FYellowknife`}
                  style={{ border: 0, width: "100%", height: "700px" }}
                  frameBorder="0"
                  scrolling="no"
                  title="MSYK Events Calendar"
                />
              </div>
            ) : (
              <div className="text-gray-700">
                <p>Calendar coming soon.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Admins: connect Google and select a public calendar in
                  Dashboard → Admin → Settings → Integrations.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
