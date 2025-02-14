import type { Route } from "./+types/register";
import { registerForWorkshop } from "~/models/workshop.server";
import { getUser } from "~/utils/session.server"; // Fetch user details
import sgMail from "@sendgrid/mail";


sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

// Function to send confirmation email using SendGrid
async function sendConfirmationEmail(userEmail: string, workshopName: string) {
  const msg = {
    to: userEmail,
    from: process.env.EMAIL_USER as string, 
    subject: "Workshop Registration Confirmation",
    text: `Thank you for registering for the workshop: ${workshopName}. We look forward to seeing you there!`,
   
  };

  try {
    await sgMail.send(msg);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send confirmation email.");
  }
}

export async function action({ params, request }: Route.ActionArgs) {
  const workshopId = parseInt(params.id as string);

  // Fetch form data
  const formData = await request.formData();
  const userId = parseInt(formData.get("userId") as string);

  console.log("Workshop ID:", workshopId); // Debugging
  console.log("User ID:", userId); // Debugging

  if (!userId) {
    return json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Fetch user details dynamically
    const user = await getUser(request); // Retrieves user details from session
    if (!user || !user.email) {
      return json({ error: "User not found or email missing" }, { status: 404 });
    }

    // Register the user for the workshop
    const registration = await registerForWorkshop(workshopId, user.id);

    // Send confirmation email to the user
    await sendConfirmationEmail(user.email, registration.workshopName);

    console.log("Registration successful:", registration); // Debugging
    return json({ success: true, registration }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error); // Debugging
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}