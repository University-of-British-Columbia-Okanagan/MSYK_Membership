import {
  registerForWorkshop,
  checkUserRegistration,
} from "~/models/workshop.server";
import { getUser } from "~/utils/session.server"; // Fetch user details
import formData from "form-data";
import Mailgun from "mailgun.js";

// Initialize Mailgun Client
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY as string,
});

// Function to send confirmation email using Mailgun
async function sendConfirmationEmail(
  userEmail: string,
  workshopName: string,
  startDate: Date,
  endDate: Date
) {
  const domain = process.env.MAILGUN_DOMAIN;

  if (!domain) {
    console.error("MAILGUN_DOMAIN environment variable is not set");
    throw new Error("Mailgun domain is not configured");
  }

  const emailData = {
    from: `Makerspace YK <info@${domain}>`,
    to: userEmail,
    subject: "Workshop Registration Confirmation",
    text: `Thank you for registering for the workshop: ${workshopName}. 
    Your selected session is from ${startDate.toLocaleString()} to ${endDate.toLocaleString()}. 
    We look forward to seeing you there!`,
  };

  try {
    await mg.messages.create(domain, emailData);
    console.log("Email sent successfully via Mailgun");
  } catch (error) {
    console.error(" Error sending email via Mailgun:", error);
    throw new Error("Failed to send confirmation email.");
  }
}

export async function action({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const workshopId = parseInt(params.id);

  // Fetch form data
  const formData = await request.formData();
  const userId = parseInt(formData.get("userId") as string);
  const occurrenceId = parseInt(formData.get("occurrenceId") as string);

  console.log("🛠 Workshop ID:", workshopId);
  console.log("🛠 Occurrence ID:", occurrenceId);
  console.log("🛠 User ID:", userId);

  if (!userId || !occurrenceId) {
    return new Response(
      JSON.stringify({ error: "User ID and Occurrence ID are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch user details dynamically
    const user = await getUser(request);
    if (!user || !user.email) {
      return new Response(
        JSON.stringify({ error: "User not found or email missing" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the user is already registered for this occurrence
    const existingRegistration = await checkUserRegistration(
      workshopId,
      occurrenceId,
      user.id
    );

    if (existingRegistration) {
      return new Response(
        JSON.stringify({
          error: "You are already registered for this workshop occurrence.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Register the user for the selected occurrence
    const registration = await registerForWorkshop(
      workshopId,
      occurrenceId,
      user.id
    );

    // Send confirmation email to the user with the occurrence details
    await sendConfirmationEmail(
      user.email,
      registration.workshopName,
      registration.startDate,
      registration.endDate
    );

    console.log("Registration successful:", registration);

    return new Response(
      JSON.stringify({ success: true, message: "Registration successful!" }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Registration error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
