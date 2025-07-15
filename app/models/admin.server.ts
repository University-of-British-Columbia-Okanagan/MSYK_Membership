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
 * Get past workshop visibility days setting
 * @returns Number of days in the past to show entire workshops in past events
 */
export async function getPastWorkshopVisibility(): Promise<number> {
  const pastWorkshopVisibility = await getAdminSetting(
    "past_workshop_visibility",
    "180"
  );
  return parseInt(pastWorkshopVisibility, 10);
}

/**
 * Update a workshop's registration cutoff
 * @param workshopId The workshop ID to update
 * @param cutoffMinutes The new cutoff time in minutes
 * @returns The updated workshop
 */
export async function updateWorkshopCutoff(
  workshopId: number,
  cutoffMinutes: number
) {
  return db.workshop.update({
    where: {
      id: workshopId,
    },
    data: {
      registrationCutoff: cutoffMinutes,
    },
  });
}

export async function getEquipmentVisibilityDays(): Promise<number> {
  try {
    const setting = await db.adminSettings.findUnique({
      where: { key: "equipment_visible_registrable_days" },
    });

    return setting ? parseInt(setting.value, 10) : 7; // Default to 7 days if not set
  } catch (error) {
    console.error("Error fetching equipment visibility days:", error);
    return 7; // Default to 7 days on error
  }
}

export async function updateEquipmentVisibilityDays(
  days: number
): Promise<void> {
  try {
    await db.adminSettings.upsert({
      where: { key: "equipment_visible_registrable_days" },
      update: {
        value: days.toString(),
        updatedAt: new Date(),
      },
      create: {
        key: "equipment_visible_registrable_days",
        value: days.toString(),
        description: "Number of days to show future equipment booking slots",
      },
    });
  } catch (error) {
    console.error("Error updating equipment visibility days:", error);
    throw error;
  }
}

/**
 * Get planned closures for equipment booking
 * @returns Array of planned closure periods
 */
export async function getPlannedClosures(): Promise<
  Array<{
    id: number;
    startDate: Date;
    endDate: Date;
  }>
> {
  try {
    const setting = await db.adminSettings.findUnique({
      where: { key: "planned_closures" },
    });

    if (!setting || !setting.value) {
      return [];
    }

    try {
      const closures = JSON.parse(setting.value);
      return closures.map((closure: any) => ({
        ...closure,
        startDate: new Date(closure.startDate),
        endDate: new Date(closure.endDate),
      }));
    } catch (error) {
      console.error("Error parsing planned closures:", error);
      return [];
    }
  } catch (error) {
    console.error("Error fetching planned closures:", error);
    return [];
  }
}

/**
 * Update planned closures for equipment booking
 * @param closures Array of closure periods
 */
export async function updatePlannedClosures(
  closures: Array<{
    id: number;
    startDate: Date | string;
    endDate: Date | string;
  }>
): Promise<void> {
  try {
    await db.adminSettings.upsert({
      where: { key: "planned_closures" },
      update: {
        value: JSON.stringify(closures),
        updatedAt: new Date(),
      },
      create: {
        key: "planned_closures",
        value: JSON.stringify(closures),
        description: "Planned closure periods for level 3 users",
      },
    });
  } catch (error) {
    console.error("Error updating planned closures:", error);
    throw error;
  }
}
