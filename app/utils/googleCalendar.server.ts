import { google, calendar_v3 } from "googleapis";
import CryptoJS from "crypto-js";
import { getAdminSetting, updateAdminSetting } from "~/models/admin.server";
import { logger } from "~/logging/logger";

type OAuthClient = InstanceType<typeof google.auth.OAuth2>;

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const DEFAULT_TIMEZONE = "America/Yellowknife";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} environment variable must be set`);
  return v;
}

function getOAuth2Client(): OAuthClient {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requireEnv("GOOGLE_OAUTH_REDIRECT_URI");
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthUrl(): Promise<string> {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

function encrypt(text: string): string {
  const key = requireEnv("GOOGLE_OAUTH_ENCRYPTION_KEY");
  return CryptoJS.AES.encrypt(text, key).toString();
}

function decrypt(cipher: string): string {
  const key = requireEnv("GOOGLE_OAUTH_ENCRYPTION_KEY");
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

async function getStoredRefreshToken(): Promise<string | null> {
  const enc = await getAdminSetting("google_oauth_refresh_token_enc", "");
  if (!enc) return null;
  try {
    return decrypt(enc);
  } catch (err) {
    logger.error(`Failed to decrypt Google refresh token: ${String(err)}`);
    return null;
  }
}

export async function isGoogleConnected(): Promise<boolean> {
  const token = await getStoredRefreshToken();
  return Boolean(token);
}

export async function handleOAuthCallbackAndStore(code: string): Promise<void> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google OAuth did not return a refresh token. Ensure prompt=consent and access_type=offline.");
  }
  const enc = encrypt(tokens.refresh_token);
  await updateAdminSetting("google_oauth_refresh_token_enc", enc, "Encrypted Google OAuth refresh token");
}

async function getAuthorizedClient(): Promise<OAuthClient | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;
  try {
    const client = getOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });
    return client;
  } catch (err) {
    logger.error(`Failed to build authorized Google client: ${String(err)}`);
    return null;
  }
}

export type CalendarListItem = {
  id: string;
  summary: string;
  accessRole: string;
  primary?: boolean;
};

export async function listCalendars(): Promise<CalendarListItem[]> {
  const client = await getAuthorizedClient();
  if (!client) return [];
  const cal = google.calendar({ version: "v3", auth: client });
  const res = await cal.calendarList.list({});
  const items = res.data.items ?? [];
  return items
    .filter((i) => i.id && i.summary && i.accessRole)
    .map((i) => ({
      id: i.id as string,
      summary: i.summary as string,
      accessRole: i.accessRole as string,
      primary: i.primary ?? false,
    }));
}

function getTimezone(tzOverride?: string | null): string {
  return tzOverride && tzOverride.length > 0 ? tzOverride : DEFAULT_TIMEZONE;
}

export type WorkshopLike = {
  id: number;
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  hasPriceVariations?: boolean;
  priceVariations?: Array<{ name: string; description?: string | null; price: number }>;
};

export type OccurrenceLike = {
  id: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date | null;
  endDatePST?: Date | null;
  googleEventId?: string | null;
};

function formatLocalNoTimezone(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${M}-${d}T${h}:${m}:${s}`;
}

function buildEventResource(
  workshop: WorkshopLike,
  occ: OccurrenceLike,
  tz: string,
  baseUrl: string
): calendar_v3.Schema$Event {
  // Use the exact local times chosen in the app (Yellowknife). No conversions.
  const start = occ.startDate;
  const end = occ.endDate;
  const summary = workshop.name;
  const pricingLines: string[] = [];
  const variations = workshop.priceVariations ?? [];
  if (workshop.hasPriceVariations && variations.length > 0) {
    pricingLines.push("Pricing options:");
    for (const v of variations) {
      const main = `${v.name} - $${v.price.toFixed(2)}`;
      const withDesc = v.description ? `${main} — ${v.description}` : main;
      pricingLines.push(withDesc);
    }
  } else if (typeof workshop.price === "number") {
    pricingLines.push(`Price: $${workshop.price.toFixed(2)}`);
  }

  const descriptionLines = [
    workshop.description,
    pricingLines.length > 0 ? "" : undefined,
    pricingLines.length > 0 ? pricingLines.join("\n") : undefined,
    "",
    `Type: ${workshop.type}`,
    `Capacity: ${workshop.capacity}`,
    "",
    `Register: ${baseUrl.replace(/\/$/, "")}/dashboard/workshops/${workshop.id}`,
  ].filter(Boolean) as string[];
  return {
    summary,
    description: descriptionLines.join("\n"),
    location: workshop.location,
    start: { dateTime: formatLocalNoTimezone(start), timeZone: tz },
    end: { dateTime: formatLocalNoTimezone(end), timeZone: tz },
  };
}

async function getTargetCalendarId(): Promise<string | null> {
  const id = await getAdminSetting("google_calendar_id", "");
  return id || null;
}

export async function createEventForOccurrence(
  workshop: WorkshopLike,
  occ: OccurrenceLike
): Promise<string | null> {
  const client = await getAuthorizedClient();
  if (!client) return null;
  const calendarId = await getTargetCalendarId();
  if (!calendarId) return null;
  const tz = getTimezone(await getAdminSetting("google_calendar_timezone", DEFAULT_TIMEZONE));
  const cal = google.calendar({ version: "v3", auth: client });
  const baseUrl = process.env.BASE_URL || "";
  const event = buildEventResource(workshop, occ, tz, baseUrl);
  const res = await cal.events.insert({ calendarId, requestBody: event });
  return res.data.id ?? null;
}

export async function updateEventForOccurrence(
  workshop: WorkshopLike,
  occ: OccurrenceLike
): Promise<void> {
  if (!occ.googleEventId) return;
  const client = await getAuthorizedClient();
  if (!client) return;
  const calendarId = await getTargetCalendarId();
  if (!calendarId) return;
  const tz = getTimezone(await getAdminSetting("google_calendar_timezone", DEFAULT_TIMEZONE));
  const cal = google.calendar({ version: "v3", auth: client });
  const baseUrl = process.env.BASE_URL || "";
  const event = buildEventResource(workshop, occ, tz, baseUrl);
  await cal.events.update({ calendarId, eventId: occ.googleEventId, requestBody: event });
}

export async function deleteEventForOccurrence(googleEventId: string): Promise<void> {
  const client = await getAuthorizedClient();
  if (!client) return;
  const calendarId = await getTargetCalendarId();
  if (!calendarId) return;
  const cal = google.calendar({ version: "v3", auth: client });
  await cal.events.delete({ calendarId, eventId: googleEventId });
}


