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


export async function sendWorkshopConfirmationEmail(params: {
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
    detailsBlock = sessions.length > 1 ? `Sessions confirmed:\n${lines}` : `Session confirmed:\n${lines}`;
  } else if (startDate && endDate) {
    detailsBlock = `Session: ${new Date(startDate).toLocaleString()} - ${new Date(endDate).toLocaleString()}`;
  }

  const parts = [
    `Thank you for registering for "${workshopName}".`,
    `Your registration has been confirmed.`,
    detailsBlock,
    pricingLines.join("\n"),
    `We look forward to seeing you there!`,
  ].filter(Boolean);

  await sendMail({
    to: userEmail,
    subject: `Registration confirmed: ${workshopName}`,
    text: parts.join("\n\n"),
  });
}

export async function sendEquipmentConfirmationEmail(params: {
  userEmail: string;
  equipmentName: string;
  startTime: Date;
  endTime: Date;
  price?: number;
}): Promise<void> {
  const { userEmail, equipmentName, startTime, endTime, price } = params;
  const start = new Date(startTime).toLocaleString();
  const end = new Date(endTime).toLocaleString();

  const parts = [
    `Your equipment booking for "${equipmentName}" has been confirmed.`,
    `Time: ${start} - ${end}`,
    ...(typeof price === "number" ? [`Price: $${price.toFixed(2)}`] : []),
    `We look forward to seeing you there!`,
  ].filter(Boolean);

  await sendMail({
    to: userEmail,
    subject: `Equipment booking confirmed: ${equipmentName}`,
    text: parts.join("\n\n"),
  });
}

export async function sendEquipmentBulkConfirmationEmail(params: {
  userEmail: string;
  equipmentName: string;
  slots: Array<{ startTime: Date; endTime: Date }>;
  pricePerSlot?: number;
}): Promise<void> {
  const { userEmail, equipmentName, slots, pricePerSlot } = params;
  const lines = slots
    .map((s, idx) => `${idx + 1}. ${new Date(s.startTime).toLocaleString()} - ${new Date(s.endTime).toLocaleString()}`)
    .join("\n");

  const parts = [
    `Your equipment booking for "${equipmentName}" has been confirmed.`,
    `Times:`,
    lines,
    ...(typeof pricePerSlot === "number"
      ? [`Price per slot: $${pricePerSlot.toFixed(2)}`, `Total: $${(pricePerSlot * slots.length).toFixed(2)}`]
      : []),
    `We look forward to seeing you there!`,
  ].filter(Boolean);

  await sendMail({
    to: userEmail,
    subject: `Equipment bookings confirmed: ${equipmentName}`,
    text: parts.join("\n\n"),
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

export async function sendMembershipConfirmationEmail(params: {
  userEmail: string;
  planTitle: string;
  planDescription: string;
  monthlyPrice: number;
  features: Record<string, string>;
  accessHours?: string | Record<string, unknown>;
  gstPercentage?: number;
  nextBillingDate?: Date;
}): Promise<void> {
  const { userEmail, planTitle, planDescription, monthlyPrice, features, accessHours, gstPercentage, nextBillingDate } = params;

  function formatAccessHours(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const hasStartEnd = typeof obj.start === "string" || typeof obj.end === "string";
      if (hasStartEnd) {
        const start = typeof obj.start === "string" ? obj.start : "";
        const end = typeof obj.end === "string" ? obj.end : "";
        const joined = [start, end].filter(Boolean).join(" - ");
        return joined.length > 0 ? joined : null;
      }
      const entries = Object.entries(obj).map(([key, val]) => {
        if (val && typeof val === "object") {
          const nested = val as Record<string, unknown>;
          if (typeof nested.start === "string" || typeof nested.end === "string") {
            const s = typeof nested.start === "string" ? nested.start : "";
            const e = typeof nested.end === "string" ? nested.end : "";
            const range = [s, e].filter(Boolean).join(" - ");
            return `${key}: ${range}`;
          }
        }
        return `${key}: ${String(val)}`;
      });
      return entries.length > 0 ? entries.join("\n") : null;
    }
    return String(value);
  }

  const gstLine = typeof gstPercentage === "number" ? ` (includes ${gstPercentage}% GST)` : "";
  const billingInfo = nextBillingDate ? `\nNext billing date: ${new Date(nextBillingDate).toLocaleDateString()}` : "";

  // Format features list
  const featuresList = Object.values(features)
    .filter(feature => feature && feature.trim() !== "")
    .map(feature => `• ${feature}`)
    .join("\n");

  const accessFormatted = formatAccessHours(accessHours ?? null);
  const accessInfo = accessFormatted ? `\nAccess Hours:\n${accessFormatted}` : "";

  const parts = [
    `Welcome to your new membership: "${planTitle}"!`,
    `Your membership subscription has been confirmed.`,
    `Plan Details:`,
    `Description: ${planDescription}`,
    `Monthly Price: $${monthlyPrice.toFixed(2)}${gstLine}${billingInfo}`,
    `Features included:`,
    featuresList,
    accessInfo,
    `Thank you for joining Makerspace YK! We're excited to have you as a member.`,
  ].filter(Boolean);

  await sendMail({
    to: userEmail,
    subject: `Membership confirmed: ${planTitle}`,
    text: parts.join("\n\n"),
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

export async function sendMembershipDowngradeEmail(params: {
  userEmail: string;
  currentPlanTitle: string;
  newPlanTitle: string;
  currentMonthlyPrice?: number;
  newMonthlyPrice?: number;
  effectiveDate: Date;
}): Promise<void> {
  const { userEmail, currentPlanTitle, newPlanTitle, currentMonthlyPrice, newMonthlyPrice, effectiveDate } = params;
  const priceLine = currentMonthlyPrice != null && newMonthlyPrice != null
    ? `Current price: $${currentMonthlyPrice.toFixed(2)} → New price: $${newMonthlyPrice.toFixed(2)}`
    : undefined;
  const parts = [
    `Your membership downgrade has been scheduled.`,
    `Current plan: ${currentPlanTitle}`,
    `New plan: ${newPlanTitle}`,
    priceLine,
    `Effective on: ${new Date(effectiveDate).toLocaleDateString()}`,
    `You'll continue to enjoy your current benefits until the effective date.`,
  ].filter(Boolean) as string[];
  await sendMail({
    to: userEmail,
    subject: `Membership downgrade scheduled: ${newPlanTitle}`,
    text: parts.join("\n\n"),
  });
}

export async function sendMembershipCancellationEmail(params: {
  userEmail: string;
  planTitle: string;
  accessUntil?: Date | null;
}): Promise<void> {
  const { userEmail, planTitle, accessUntil } = params;
  const accessLine = accessUntil
    ? `You'll retain access until ${new Date(accessUntil).toLocaleDateString()}.`
    : `Your access has ended.`;
  const text = `Your membership for "${planTitle}" has been cancelled.\n${accessLine}\nIf this was a mistake, you can resubscribe from your dashboard at any time.`;
  await sendMail({
    to: userEmail,
    subject: `Membership cancelled: ${planTitle}`,
    text,
  });
}

export async function sendMembershipResubscribeEmail(params: {
  userEmail: string;
  planTitle: string;
  monthlyPrice?: number;
  nextBillingDate?: Date;
}): Promise<void> {
  const { userEmail, planTitle, monthlyPrice, nextBillingDate } = params;
  const priceLine = monthlyPrice != null ? `Monthly price: $${monthlyPrice.toFixed(2)}` : undefined;
  const nextLine = nextBillingDate ? `Next billing date: ${new Date(nextBillingDate).toLocaleDateString()}` : undefined;
  const parts = [
    `Your membership has been reactivated: "${planTitle}".`,
    priceLine,
    nextLine,
    `Welcome back to Makerspace YK!`,
  ].filter(Boolean) as string[];
  await sendMail({
    to: userEmail,
    subject: `Membership reactivated: ${planTitle}`,
    text: parts.join("\n\n"),
  });
}
