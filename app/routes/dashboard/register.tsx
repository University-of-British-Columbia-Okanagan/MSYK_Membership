import type { Route } from "./+types/register"; // Correct import for `json`
import { registerForWorkshop } from "~/models/workshop.server";

export async function action({ params, request }: Route.ActionArgs) {
  const workshopId = parseInt(params.id as string);
  const formData = await request.formData();
  const userId = parseInt(formData.get("userId") as string);

  console.log("Workshop ID:", workshopId); // Debugging
  console.log("User ID:", userId); // Debugging

  if (!userId) {
    return json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const registration = await registerForWorkshop(workshopId, userId);
    console.log("Registration successful:", registration); // Debugging
    return json({ success: true, registration }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error); // Debugging
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
