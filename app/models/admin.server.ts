import { db } from "../utils/db.server";

/**
 * Get an admin setting by key
 * @param key The setting key to retrieve
 * @param defaultValue Default value if setting doesn't exist
 * @returns The setting value or default
 */
export async function getAdminSetting(
  key: string,
  defaultValue: string = ""
): Promise<string> {
  const setting = await db.adminSettings.findUnique({
    where: { key },
  });
  return setting?.value ?? defaultValue;
}

/**
 * Update an admin setting
 * @param key The setting key to update
 * @param value The new value
 * @param description Optional description
 */
export async function updateAdminSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await db.adminSettings.upsert({
    where: { key },
    update: {
      value,
      updatedAt: new Date(),
      ...(description && { description }),
    },
    create: {
      key,
      value,
      description: description || `Setting for ${key}`,
    },
  });
}

/**
 * Get workshop visibility days setting
 * @returns Number of days to show future workshop dates
 */
export async function getWorkshopVisibilityDays(): Promise<number> {
  const visibilityDays = await getAdminSetting(
    "workshop_visibility_days",
    "60"
  );
  return parseInt(visibilityDays, 10);
}

/**
 * Update a workshop's registration cutoff
 * @param workshopId The workshop ID to update
 * @param cutoffMinutes The new cutoff time in minutes
 * @returns The updated workshop
 */
export async function updateWorkshopCutoff(workshopId: number, cutoffMinutes: number) {
  return db.workshop.update({
    where: {
      id: workshopId,
    },
    data: {
      registrationCutoff: cutoffMinutes,
    },
  });
}
