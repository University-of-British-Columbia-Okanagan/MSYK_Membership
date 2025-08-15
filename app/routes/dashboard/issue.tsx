import { useLoaderData, useFetcher } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { getRoleUser } from "~/utils/session.server";
import { json } from "@remix-run/node";
import { SidebarProvider } from "~/components/ui/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import { AppSidebar } from "~/components/ui/Dashboard/Sidebar";
import { createIssue } from "~/models/issue.server";
import { logger } from "~/logging/logger";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  return { roleUser };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const roleUser = await getRoleUser(request);

  if (!roleUser) {
    logger.warn(`User must be logged in to submit an issue.`, {
      url: request.url,
    });
    throw new Response("Not Authorized", { status: 401 });
  }

  const title = form.get("title") as string;
  const description = form.get("description") as string;
  const priority = form.get("severity") as string;
  // const screenshots = form.getAll("screenshots") as string[];

  if (!title || !description || !priority) {
    return json({ success: false, error: "Please fill all required fields." });
  }

  try {
    await createIssue({
      title,
      description,
      priority,
      reportedById: roleUser.userId,
      //   screenshots, // TODO
    });
    logger.info(`[User: ${roleUser?.userId ?? "unknown"}] New issue created`, {
      url: request.url,
    });
    return json({ success: true });
  } catch (err) {
    logger.error(`Error creating new issue ${err}`, { url: request.url });
    logger.error(err);
    return json({ success: false, error: "Failed to submit issue." });
  }
}

export default function SubmitIssue() {
  const { roleUser } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("3");
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setPopupMessage("🎉 Issue submitted successfully!");
      setShowPopup(true);
      setTitle("");
      setDescription("");
      setSeverity("3");
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setShowPopup(true);
    }
  }, [fetcher.data]);

  return (
    <SidebarProvider>
      {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
      <div className="w-full p-10">
        {showPopup && (
          <div className="fixed top-4 right-4 p-4 bg-green-500 text-white rounded-lg shadow-lg">
            {popupMessage}
          </div>
        )}

        <h1 className="text-2xl font-bold mb-10">Submit Issue</h1>

        <fetcher.Form
          method="post"
          encType="multipart/form-data"
          className="space-y-5 max-w-2xl"
        >
          <div className="space-y-1">
            <Label htmlFor="title" className="pl-1 text-lg">
              Issue Title
            </Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="pl-1 text-lg">
              Description / Steps to Reproduce
            </Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="severity" className="pl-1 text-lg">
              Severity / Priority (1 = Low, 5 = High)
            </Label>
            <select
              name="severity"
              id="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="screenshots" className="pl-1 text-lg">
              Attach Screenshots (optional)
            </Label>
            <Input
              id="screenshots"
              name="screenshots"
              type="file"
              multiple
              accept="image/*"
            />
          </div>

          <Separator />

          <div className="flex justify-end gap-4">
            <Button type="submit" className="bg-yellow-500 text-white">
              Submit Issue
            </Button>
          </div>
        </fetcher.Form>
      </div>
    </SidebarProvider>
  );
}
