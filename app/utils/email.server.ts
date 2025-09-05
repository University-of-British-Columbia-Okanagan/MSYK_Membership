import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Mailgun from "mailgun.js";
import formData from "form-data";

dotenv.config();

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY as string
});

async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string,
) {
  const emailData = {
    from: `Makerspace YK <info@makerspaceyk.com>`,
    to: userEmail,
    subject: "Password Reset Request",
    text: `Please use the following link to reset your password. The following link is valid for next 1 hour.\n${resetLink}`,
  };

  try {
    await mg.messages.create("makerspaceyk.com", emailData);
  } catch (error) {
    throw new Error("Failed to send confirmation email.");
  }
}

function generateResetToken(email: string): string {
  return jwt.sign({ email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

export async function sendResetEmail(email: string) {
  const token = generateResetToken(email);
  const resetLink = `${process.env.BASE_URL}/passwordReset?token=${token}`;
  await sendPasswordResetEmail(email, resetLink);
}

export async function sendEmailConfirmation(
  userEmail: string,
  bookingType: "workshop" | "equipment" | "membership",
  details: {
    description: string;
    extra?: string;
  }
) {
  let subject = "";
  let text = "";

  switch (bookingType) {
    case "workshop":
      subject = "Workshop Booking Confirmation";
      text = `Thank you for registering for the workshop: ${details.description}.
You have successfully booked your spot.
${details.extra ? `\n\nAdditional Info: ${details.extra}` : ""}`;
      break;

    case "equipment":
      subject = "Equipment Booking Confirmation";
      text = `Your equipment booking is confirmed: ${details.description}.
You have successfully reserved your equipment.
${details.extra ? `\n\nAdditional Info: ${details.extra}` : ""}`;
      break;

    case "membership":
      subject = "Membership Subscription Confirmation";
      text = `Your membership subscription is confirmed: ${details.description}.
${details.extra ? `\n\nAdditional Info: ${details.extra}` : ""}`;
      break;

    default:
      throw new Error("Invalid booking type for email confirmation");
  }

  const emailData = {
    from: `Makerspace YK <info@makerspaceyk.com>`,
    to: userEmail,
    subject,
    text,
  };

  try {
    await mg.messages.create("makerspaceyk.com", emailData);
  } catch (error) {
    console.error("Email confirmation failed:", error);
    throw new Error("Failed to send confirmation email.");
  }
}
