import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Mailgun from "mailgun.js";
import formData from "form-data";

dotenv.config();

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAILGUN_API_KEY as string,
});

const MAILGUN_DOMAIN: string | undefined = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM_EMAIL: string | undefined = process.env.MAILGUN_FROM_EMAIL;

function assertEmailEnvConfigured(): void {
  if (!process.env.MAILGUN_API_KEY) {
    throw new Error("MAILGUN_API_KEY is not configured");
  }
  if (!MAILGUN_DOMAIN) {
    throw new Error("MAILGUN_DOMAIN is not configured");
  }
  if (!MAILGUN_FROM_EMAIL) {
    throw new Error("MAILGUN_FROM_EMAIL is not configured");
  }
}

async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  assertEmailEnvConfigured();
  const domain = MAILGUN_DOMAIN as string;
  const from = `Makerspace YK <${MAILGUN_FROM_EMAIL as string}>`;

  await mg.messages.create(domain, {
    from,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}

async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string,
): Promise<void> {
  await sendMail({
    to: userEmail,
    subject: "Password Reset Request",
    text: `Please use the following link to reset your password. The following link is valid for next 1 hour.\n${resetLink}`,
  });
}

function generateResetToken(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign({ email }, secret, { expiresIn: '1h' });
}

export async function sendResetEmail(email: string): Promise<void> {
  const token = generateResetToken(email);
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    throw new Error("BASE_URL is not configured");
  }
  let origin: URL;
  try {
    origin = new URL(baseUrl);
  } catch {
    throw new Error("BASE_URL must be a valid absolute URL origin");
  }
  const resetUrl = new URL('/passwordReset', origin);
  resetUrl.searchParams.set('token', token);
  await sendPasswordResetEmail(email, resetUrl.toString());
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

  await sendMail({
    to: userEmail,
    subject,
    text,
  });
}

export async function sendWorkshopCancellationEmail(params: {
  userEmail: string;
  workshopName: string;
  // Single-session fields (regular workshop)
  startDate?: Date;
  endDate?: Date;
  // Multi-session fields (multi-day workshop)
  sessions?: Array<{ startDate: Date; endDate: Date }>;
  // Pricing
  basePrice?: number;
  priceVariation?: { name: string; description?: string | null; price: number } | null;
}): Promise<void> {
  const { userEmail, workshopName, startDate, endDate, sessions, basePrice, priceVariation } = params;

  const pricingLines: string[] = [];
  if (priceVariation) {
    pricingLines.push(`Pricing option: ${priceVariation.name} - $${priceVariation.price.toFixed(2)}`);
    if (priceVariation.description) {
      pricingLines.push(`Details: ${priceVariation.description}`);
    }
  } else if (typeof basePrice === "number") {
    pricingLines.push(`Price: $${basePrice.toFixed(2)}`);
  }

  let detailsBlock = "";
  if (sessions && sessions.length > 0) {
    const lines = sessions
      .map((s, idx) => `${idx + 1}. ${new Date(s.startDate).toLocaleString()} - ${new Date(s.endDate).toLocaleString()}`)
      .join("\n");
    detailsBlock = sessions.length > 1 ? `Sessions cancelled:\n${lines}` : `Session cancelled:\n${lines}`;
  } else if (startDate && endDate) {
    detailsBlock = `Session: ${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()}`;
  }

  const parts = [
    `Your registration for "${workshopName}" has been cancelled.`,
    detailsBlock,
    pricingLines.join("\n"),
    `If this was a mistake, please re-register from your dashboard.`,
  ].filter(Boolean);

  await sendMail({
    to: userEmail,
    subject: `Cancellation confirmed: ${workshopName}`,
    text: parts.join("\n\n"),
  });
}

export async function sendEquipmentCancellationEmail(params: {
  userEmail: string;
  equipmentName: string;
  startTime: Date;
  endTime: Date;
}): Promise<void> {
  const { userEmail, equipmentName, startTime, endTime } = params;
  const start = new Date(startTime).toLocaleString();
  const end = new Date(endTime).toLocaleString();
  const text = `Your booking for "${equipmentName}" has been cancelled.\nTime: ${start} - ${end}.`;
  await sendMail({
    to: userEmail,
    subject: `Equipment booking cancelled: ${equipmentName}`,
    text,
  });
}

export async function sendMembershipPaymentReminderEmail(params: {
  userEmail: string;
  planTitle: string;
  nextPaymentDate: Date;
  amountDue: number;
  gstPercentage?: number;
}): Promise<void> {
  const { userEmail, planTitle, nextPaymentDate, amountDue, gstPercentage } = params;
  const when = new Date(nextPaymentDate).toLocaleString();
  const gstLine = typeof gstPercentage === "number" ? ` (includes ${gstPercentage}% GST)` : "";
  const text = `Reminder: Your membership plan "${planTitle}" will be charged on ${when}.\nAmount due: $${amountDue.toFixed(2)}${gstLine}.\nIf you need to update your payment method, please visit your account settings.`;
  await sendMail({
    to: userEmail,
    subject: `Membership payment reminder: ${planTitle}`,
    text,
  });
}
