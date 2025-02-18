import type { Route } from "./+types/register";
import {
  registerForWorkshop,
  checkUserRegistration,
} from "~/models/workshop.server";
import { getUser } from "~/utils/session.server"; // Fetch user details
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

// Function to send confirmation email using SendGrid
async function sendConfirmationEmail(
  userEmail: string,
  workshopName: string,
  startDate: Date,
  endDate: Date
) {
  const msg = {
    to: userEmail,
    from: process.env.EMAIL_USER as string,
    subject: "Workshop Registration Confirmation",
    text: `Thank you for registering for the workshop: ${workshopName}. 
    Your selected session is from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}. 
    We look forward to seeing you there!`,
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
  const occurrenceId = parseInt(formData.get("occurrenceId") as string); // 🛠 Get the selected occurrence

  console.log("Workshop ID:", workshopId); // Debugging
  console.log("Occurrence ID:", occurrenceId); // Debugging
  console.log("User ID:", userId); // Debugging

  if (!userId || !occurrenceId) {
    return json(
      { error: "User ID and Occurrence ID are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch user details dynamically
    const user = await getUser(request);
    if (!user || !user.email) {
      return json(
        { error: "User not found or email missing" },
        { status: 404 }
      );
    }

    // Check if the user is already registered for this occurrence
    const existingRegistration = await checkUserRegistration(
      occurrenceId,
      user.id
    );

    if (existingRegistration) {
      return json(
        { error: "You are already registered for this workshop occurrence." },
        { status: 400 }
      );
    }

    // Register the user for the selected occurrence
    const registration = await registerForWorkshop(occurrenceId, user.id);

    // Send confirmation email to the user with the occurrence details
    await sendConfirmationEmail(
      user.email,
      registration.workshopName,
      registration.startDate,
      registration.endDate
    );

    console.log("Registration successful:", registration); // Debugging
    return json(
      { success: true, message: "Registration successful!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
