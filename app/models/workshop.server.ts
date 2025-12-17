import { db } from "../utils/db.server";
import { getUser } from "~/utils/session.server";
import { createEquipmentSlotsForOccurrence } from "../models/equipment.server";
import {
  createEventForOccurrence,
  updateEventForOccurrence,
  deleteEventForOccurrence,
} from "~/utils/googleCalendar.server";

interface WorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  prerequisites?: number[];
  equipments?: number[];
  hasPriceVariations?: boolean;
  priceVariations?: Array<{
    name: string;
    price: number;
    description: string;
    capacity: number;
  }>;
  occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST?: Date;
    endDatePST?: Date;
  }[];
  isMultiDayWorkshop?: boolean;
  selectedSlots: Record<number, number[]>;
  imageUrl?: string | null;
}

interface OccurrenceData {
  id?: number;
  status?: string;
  userCount?: number;
  startDate: Date;
  endDate: Date;
  startDatePST?: Date;
  endDatePST?: Date;
}

interface UpdateWorkshopData {
  name: string;
  description: string;
  price: number;
  location: string;
  capacity: number;
  type: string;
  prerequisites?: number[];
  equipments?: number[];
  occurrences: OccurrenceData[];
  isMultiDayWorkshop: boolean;
  imageUrl?: string | null;
}

/**
 * Fetches all workshops with their occurrences sorted by date and includes registration counts
 * @returns Promise<Array> - Array of workshops with status, occurrences, and registration counts
 */
export async function getWorkshops() {
  const workshops = await db.workshop.findMany({
    orderBy: {
      id: "asc",
    },
    include: {
      occurrences: {
        orderBy: { startDate: "asc" },
        include: {
          userWorkshops: true, // Include user workshops to count registrations
        },
      },
      // Include price variations
      priceVariations: {
        where: {
          status: "active", // Only include active price variations
        },
        orderBy: {
          price: "asc", // Order by price to easily find the lowest
        },
      },
    },
  });

  return workshops.map((workshop) => {
    // Get the latest status from the most recent occurrence
    const latestStatus =
      workshop.occurrences.length > 0
        ? workshop.occurrences[workshop.occurrences.length - 1].status
        : "expired"; // Default to expired if no occurrences exist

    // Map occurrences to include registration count (excluding cancelled)
    const occurrencesWithCounts = workshop.occurrences.map(
      (occurrence: any) => {
        // Count only non-cancelled registrations
        const registrationCount =
          occurrence.userWorkshops?.filter(
            (uw: any) => uw.result !== "cancelled"
          ).length || 0;

        // Create a new object without the userWorkshops property
        const { userWorkshops, ...occWithoutUserWorkshops } = occurrence;

        // Return the occurrence with the registration count added
        return {
          ...occWithoutUserWorkshops,
          registrationCount,
        };
      }
    );

    // Calculate display price: use lowest price variation if available, otherwise use base price
    const displayPrice =
      workshop.hasPriceVariations && workshop.priceVariations.length > 0
        ? workshop.priceVariations[0].price // Already ordered by price asc, so first is lowest
        : workshop.price;

    // Calculate price range for display
    const priceRange =
      workshop.hasPriceVariations && workshop.priceVariations.length > 1
        ? {
            min: workshop.priceVariations[0].price, // First is lowest
            max: workshop.priceVariations[workshop.priceVariations.length - 1]
              .price, // Last is highest
          }
        : null;

    // Keep all existing fields in 'workshop',
    // then add/override status, and ensure 'type' is included.
    return {
      ...workshop,
      status: latestStatus,
      type: workshop.type, // explicitly include workshop.type
      occurrences: occurrencesWithCounts, // Replace occurrences with our version that includes counts
      displayPrice, // calculated display price
      priceRange, // calculated price range for display
    };
  });
}

/**
 * Creates a new workshop along with its occurrences and equipment slot bookings
 * @param data - Workshop data including details, occurrences, and equipment requirements
 * @param request - Optional HTTP request object to extract user information
 * @returns Promise<Workshop> - The created workshop record
 * @throws Error if workshop creation fails
 */
export async function addWorkshop(data: WorkshopData, request?: Request) {
  try {
    let userId = -1;
    if (request) {
      const user = await getUser(request);
      if (user) {
        userId = user.id;
      }
    }

    // Step 1: Create the workshop
    const newWorkshop = await db.workshop.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        location: data.location,
        capacity: data.capacity,
        type: data.type,
        hasPriceVariations: data.hasPriceVariations || false,
        imageUrl: data.imageUrl || null,
      },
    });

    if (data.prerequisites && data.prerequisites.length > 0) {
      await db.workshopPrerequisite.createMany({
        data: data.prerequisites.map((prereqId) => ({
          workshopId: newWorkshop.id,
          prerequisiteId: prereqId,
        })),
      });
    }

    // Step 1.5: Create price variations if they exist
    if (
      data.hasPriceVariations &&
      data.priceVariations &&
      data.priceVariations.length > 0
    ) {
      await db.workshopPriceVariation.createMany({
        data: data.priceVariations.map((variation) => ({
          workshopId: newWorkshop.id,
          name: variation.name,
          price: variation.price,
          description: variation.description,
          capacity: variation.capacity,
        })),
      });
    }

    // Step 2: Generate new connect id ID if it's a multi-day workshop
    let newConnectId: number | null = null;
    if (data.isMultiDayWorkshop) {
      const maxResult = await db.workshopOccurrence.aggregate({
        _max: { connectId: true },
      });
      newConnectId = ((maxResult._max.connectId as number) || 0) + 1;
    }

    // Step 3: Create workshop occurrences
    const occurrences = await Promise.all(
      data.occurrences.map(async (occ) => {
        const created = await db.workshopOccurrence.create({
          data: {
            workshopId: newWorkshop.id,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status: occ.startDate >= new Date() ? "active" : "past",
            connectId: newConnectId,
          },
        });

        try {
          const eventId = await createEventForOccurrence(
            {
              id: newWorkshop.id,
              name: data.name,
              description: data.description,
              price: data.price,
              location: data.location,
              capacity: data.capacity,
              type: data.type,
              hasPriceVariations: data.hasPriceVariations,
              priceVariations: data.priceVariations?.map((v) => ({
                name: v.name,
                description: v.description,
                price: v.price,
              })),
            },
            {
              id: created.id,
              startDate: created.startDate,
              endDate: created.endDate,
              startDatePST: created.startDatePST ?? undefined,
              endDatePST: created.endDatePST ?? undefined,
              connectId: created.connectId ?? undefined,
            }
          );
          if (eventId) {
            await db.workshopOccurrence.update({
              where: { id: created.id },
              data: { googleEventId: eventId },
            });
            return { ...created, googleEventId: eventId } as any;
          }
        } catch (err) {
          console.error("Failed to create Google Calendar event:", err);
        }
        return created;
      })
    );

    // Step 4: Book selected equipment slots
    if (data.equipments && data.equipments.length > 0) {
      for (const equipmentId of data.equipments) {
        const selectedSlotIds = data.selectedSlots?.[equipmentId] || [];

        // Filter out negative IDs (these are our placeholder IDs for workshop dates)
        const validSlotIds = selectedSlotIds.filter((id) => id > 0);

        // If there are no valid slot IDs, just continue to the next equipment
        if (validSlotIds.length === 0) {
          console.log(
            `No valid slots selected for Equipment ID ${equipmentId}. Only workshop date slots were found.`
          );
          continue; // Skip to next equipment
        }

        try {
          // Step 4a: Verify selected slots exist and are unbooked
          const slots = await db.equipmentSlot.findMany({
            where: {
              id: { in: validSlotIds },
              equipmentId,
              isBooked: false,
              workshopOccurrenceId: null,
            },
          });

          if (slots.length !== validSlotIds.length) {
            console.warn(
              `Some selected slots for Equipment ${equipmentId} are already booked or invalid. Found ${slots.length} of ${validSlotIds.length}`
            );
          }

          // Only proceed if we have valid slots to book
          if (slots.length > 0) {
            const validIds = slots.map((slot) => slot.id);
            const occ = occurrences[0];

            await db.equipmentSlot.updateMany({
              where: { id: { in: validIds } },
              data: {
                isBooked: true,
                workshopOccurrenceId: occ.id,
              },
            });

            // Create equipment booking records
            for (const slotId of validIds) {
              await db.equipmentBooking.create({
                data: {
                  userId: userId, // Use the current logged-in user's ID
                  equipmentId,
                  slotId,
                  status: "pending", // Default status as pending
                  bookedFor: "workshop", // Set the new bookedFor field
                  workshopId: newWorkshop.id, // Connect directly to the workshop
                },
              });
            }

            console.log(
              `✅ Assigned ${validIds.length} selected slot(s) to Equipment ${equipmentId} for Occurrence ${occ.id}`
            );
          }
        } catch (error) {
          console.error(
            `Error processing slots for equipment ${equipmentId}:`,
            error
          );
          // Continue with other equipment instead of failing the whole operation
        }
      }
    }

    // Step 5: Create equipment slots for workshop dates
    // This will handle creating slots for all workshop occurrences and equipment
    for (const occurrence of occurrences) {
      for (const equipmentId of data.equipments ?? []) {
        // Create equipment slots for this occurrence's time range
        await createEquipmentSlotsForOccurrence(
          occurrence.id,
          equipmentId,
          occurrence.startDate,
          occurrence.endDate,
          userId // Pass the current user ID
        );
      }
    }

    return { ...newWorkshop, occurrences };
  } catch (error: any) {
    console.error("Error adding workshop:", error);
    throw new Error(`Failed to add workshop: ${error.message}`);
  }
}

/**
 * Retrieves a specific workshop by its ID with full details
 * @param workshopId - The ID of the workshop to retrieve
 * @returns Promise<Workshop|null> - The workshop record or null if not found
 */
export async function getWorkshopById(workshopId: number) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        occurrences: {
          include: {
            userWorkshops: true,
            equipmentSlots: {
              include: {
                equipment: true,
              },
              orderBy: {
                startTime: "asc",
              },
            },
          },
        },
        prerequisites: {
          select: {
            prerequisiteId: true,
          },
        },
      },
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Flatten prerequisite workshop IDs
    const prerequisites = workshop.prerequisites.map((p) => p.prerequisiteId);

    // Extract all equipment IDs used in the workshop occurrences
    const equipments = workshop.occurrences.flatMap((occ) =>
      occ.equipmentSlots.map((slot) => slot.equipmentId)
    );

    return {
      ...workshop,
      prerequisites,
      equipments,
    };
  } catch (error) {
    console.error("Error fetching workshop by ID:", error);
    throw new Error("Failed to fetch workshop");
  }
}

/**
 * Updates an existing workshop's basic details and replaces all occurrences
 * @param workshopId - The ID of the workshop to update
 * @param data - Updated workshop data including new occurrences
 * @returns Promise<Workshop> - The updated workshop record
 * @throws Error if workshop update fails
 */
export async function updateWorkshop(workshopId: number, data: WorkshopData) {
  try {
    // Update workshop details
    const updatedWorkshop = await db.workshop.update({
      where: { id: workshopId },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        location: data.location,
        capacity: data.capacity,
        type: data.type,
      },
    });

    // Delete occurrences not included in the update
    await db.workshopOccurrence.deleteMany({ where: { workshopId } });

    // Add new occurrences
    await db.workshopOccurrence.createMany({
      data: data.occurrences.map((occ) => ({
        workshopId,
        startDate: occ.startDate,
        endDate: occ.endDate,
      })),
    });

    return updatedWorkshop;
  } catch (error) {
    console.error("Error updating workshop:", error);
    throw new Error("Failed to update workshop");
  }
}

/**
 * Updates workshop details and intelligently manages occurrences (create, update, delete)
 * @param workshopId - The ID of the workshop to update
 * @param data - Updated workshop data with occurrence management
 * @returns Promise<Workshop> - The updated workshop record
 * @throws Error if workshop or occurrence updates fail
 */
export async function updateWorkshopWithOccurrences(
  workshopId: number,
  data: UpdateWorkshopData & {
    selectedSlots?: Record<number, number[]>;
    userId?: number;
    hasPriceVariations?: boolean;
    priceVariations?: Array<{
      name: string;
      price: number;
      description: string;
      capacity: number;
    }>;
  }
) {
  // Update workshop basic info
  await db.workshop.update({
    where: { id: workshopId },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      location: data.location,
      capacity: data.capacity,
      type: data.type,
      hasPriceVariations: data.hasPriceVariations || false,
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    },
  });

  // Update price variations (preserve existing IDs to maintain UserWorkshop references)
  if (data.hasPriceVariations !== undefined) {
    if (
      data.hasPriceVariations &&
      data.priceVariations &&
      data.priceVariations.length > 0
    ) {
      // Get existing active price variations
      const existingVariations = await db.workshopPriceVariation.findMany({
        where: { workshopId, status: "active" },
        orderBy: { id: "asc" },
      });

      // Update existing variations and create new ones
      for (let i = 0; i < data.priceVariations.length; i++) {
        const variationData = data.priceVariations[i];

        if (i < existingVariations.length) {
          // Update existing variation (preserve the ID and existing registrations)
          // Allow capacity updates but preserve price for existing variations
          await db.workshopPriceVariation.update({
            where: { id: existingVariations[i].id },
            data: {
              name: variationData.name,
              // Don't update price for existing variations with registrations
              description: variationData.description,
              capacity: variationData.capacity, // Allow capacity updates
            },
          });
        } else {
          // Create new variation
          await db.workshopPriceVariation.create({
            data: {
              workshopId,
              name: variationData.name,
              price: variationData.price,
              description: variationData.description,
              capacity: variationData.capacity,
              status: "active",
            },
          });
        }
      }

      // Remove extra existing variations if the new array is smaller
      if (existingVariations.length > data.priceVariations.length) {
        const variationsToRemove = existingVariations.slice(
          data.priceVariations.length
        );
        for (const variation of variationsToRemove) {
          // Check if this variation has registrations
          const hasRegistrations = await db.userWorkshop.findFirst({
            where: { priceVariationId: variation.id },
          });

          if (hasRegistrations) {
            // Cancel the variation instead of deleting it
            await db.workshopPriceVariation.update({
              where: { id: variation.id },
              data: { status: "cancelled" },
            });
            // Update related registrations to cancelled
            await db.userWorkshop.updateMany({
              where: { priceVariationId: variation.id },
              data: { result: "cancelled" },
            });
          } else {
            // Safe to delete if no registrations
            await db.workshopPriceVariation.delete({
              where: { id: variation.id },
            });
          }
        }
      }
    } else {
      // Price variations disabled - cancel all existing active variations
      const existingVariations = await db.workshopPriceVariation.findMany({
        where: { workshopId, status: "active" },
      });

      for (const variation of existingVariations) {
        // Check if this variation has registrations
        const hasRegistrations = await db.userWorkshop.findFirst({
          where: { priceVariationId: variation.id },
        });

        if (hasRegistrations) {
          // Cancel the variation instead of deleting it
          await db.workshopPriceVariation.update({
            where: { id: variation.id },
            data: { status: "cancelled" },
          });
          // Update related registrations to cancelled
          await db.userWorkshop.updateMany({
            where: { priceVariationId: variation.id },
            data: { result: "cancelled" },
          });
        } else {
          // Safe to delete if no registrations
          await db.workshopPriceVariation.delete({
            where: { id: variation.id },
          });
        }
      }
    }
  }

  if (data.prerequisites) {
    await db.workshopPrerequisite.deleteMany({ where: { workshopId } });

    if (data.prerequisites.length > 0) {
      const sortedPrereqs = [...data.prerequisites].sort((a, b) => a - b);
      await db.workshopPrerequisite.createMany({
        data: sortedPrereqs.map((prereqId) => ({
          workshopId,
          prerequisiteId: prereqId,
        })),
      });
    }
  }

  // 3) Update occurrences
  const existingOccurrences = await db.workshopOccurrence.findMany({
    where: { workshopId },
  });
  const existingIds = existingOccurrences.map((occ) => occ.id);

  const updateOccurrences = data.occurrences.filter((o) => o.id);
  const createOccurrences = data.occurrences.filter((o) => !o.id);
  const updateIds = updateOccurrences.map((o) => o.id!);
  const deleteIds = existingIds.filter((id) => !updateIds.includes(id));

  // Store new occurrence IDs for later use with user registration
  let newOccurrenceIds: number[] = [];

  if (createOccurrences.length > 0) {
    const now = new Date();

    // Get the maximum existing offerId for this workshop
    const maxOfferIdResult = await db.workshopOccurrence.aggregate({
      where: { workshopId },
      _max: { offerId: true },
    });

    // Use the highest existing offerId (or default to 1 if none exists)
    const currentOfferId = (maxOfferIdResult._max.offerId as number) || 1;

    // Check if this is already a multi-day workshop BEFORE creating new occurrences
    let existingConnectIdForNewOccurrences: number | null = null;
    const existingMultiDayCheck = await db.workshopOccurrence.findFirst({
      where: { workshopId, connectId: { not: null } },
      select: { connectId: true },
    });
    if (existingMultiDayCheck && existingMultiDayCheck.connectId) {
      existingConnectIdForNewOccurrences = existingMultiDayCheck.connectId;
    }

    const createdOccurrences = await Promise.all(
      createOccurrences.map(async (occ) => {
        const status =
          occ.status === "cancelled"
            ? "cancelled"
            : occ.startDate >= now
              ? "active"
              : "past";

        // Create each occurrence individually to get its ID
        // If this workshop already has a connectId, assign it to new occurrences immediately
        const createdOcc = await db.workshopOccurrence.create({
          data: {
            workshopId,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status,
            offerId: currentOfferId, // Use the current highest offerId
            connectId: existingConnectIdForNewOccurrences, // Assign connectId immediately if this is a multi-day workshop
          },
        });

        try {
          const eventId = await createEventForOccurrence(
            {
              id: workshopId,
              name: data.name,
              description: data.description,
              price: data.price,
              location: data.location,
              capacity: data.capacity,
              type: data.type,
              hasPriceVariations: data.hasPriceVariations,
              priceVariations: data.priceVariations?.map((v) => ({
                name: v.name,
                description: v.description,
                price: v.price,
              })),
            },
            {
              id: createdOcc.id,
              startDate: createdOcc.startDate,
              endDate: createdOcc.endDate,
              startDatePST: createdOcc.startDatePST ?? undefined,
              endDatePST: createdOcc.endDatePST ?? undefined,
              connectId: createdOcc.connectId ?? undefined,
            }
          );
          if (eventId) {
            await db.workshopOccurrence.update({
              where: { id: createdOcc.id },
              data: { googleEventId: eventId },
            });
          }
        } catch (err) {
          console.error("Failed to create Google Calendar event:", err);
        }

        return createdOcc;
      })
    );

    // Store the IDs of newly created occurrences
    newOccurrenceIds = createdOccurrences.map((occ) => occ.id);
  }

  for (const occ of updateOccurrences) {
    const now = new Date();
    const status =
      occ.status === "cancelled"
        ? "cancelled"
        : occ.startDate >= now
          ? "active"
          : "past";

    const updated = await db.workshopOccurrence.update({
      where: { id: occ.id },
      data: {
        startDate: occ.startDate,
        endDate: occ.endDate,
        startDatePST: occ.startDatePST,
        endDatePST: occ.endDatePST,
        status,
      },
    });

    try {
      await updateEventForOccurrence(
        {
          id: workshopId,
          name: data.name,
          description: data.description,
          price: data.price,
          location: data.location,
          capacity: data.capacity,
          type: data.type,
          hasPriceVariations: data.hasPriceVariations,
          priceVariations: data.priceVariations?.map((v) => ({
            name: v.name,
            description: v.description,
            price: v.price,
          })),
        },
        {
          id: updated.id,
          startDate: updated.startDate,
          endDate: updated.endDate,
          startDatePST: updated.startDatePST ?? undefined,
          endDatePST: updated.endDatePST ?? undefined,
          googleEventId:
            (existingOccurrences.find((e) => e.id === updated.id) as any)
              ?.googleEventId ?? null,
          connectId: updated.connectId ?? undefined,
        }
      );
    } catch (err) {
      console.error("Failed to update Google Calendar event:", err);
    }
  }

  if (deleteIds.length > 0) {
    // Fetch to capture event ids, then delete
    const toDelete = await db.workshopOccurrence.findMany({
      where: { id: { in: deleteIds } },
      select: { id: true, googleEventId: true },
    });
    await db.workshopOccurrence.deleteMany({
      where: { id: { in: deleteIds } },
    });
    for (const item of toDelete) {
      if (item.googleEventId) {
        try {
          await deleteEventForOccurrence(item.googleEventId);
        } catch (err) {
          console.error("Failed to delete Google Calendar event:", err);
        }
      }
    }
  }

  let isMultiDayWorkshop = data.isMultiDayWorkshop;
  let currentConnectId = null;

  if (typeof data.isMultiDayWorkshop === "boolean") {
    if (data.isMultiDayWorkshop) {
      // If user CHECKED the box, assign a new connectId for all occurrences
      // First check if there's already a connectId assigned to existing occurrences
      const existingConnectId = await db.workshopOccurrence.findFirst({
        where: { workshopId, connectId: { not: null } },
        select: { connectId: true },
      });

      if (existingConnectId && existingConnectId.connectId) {
        // Use existing connectId to maintain continuity
        currentConnectId = existingConnectId.connectId;
        await db.workshopOccurrence.updateMany({
          where: { workshopId },
          data: { connectId: currentConnectId },
        });
      } else {
        // Create a new connectId if none exists
        const maxResult = await db.workshopOccurrence.aggregate({
          _max: { connectId: true },
        });
        const currentMax = maxResult._max.connectId ?? 0;
        currentConnectId = currentMax + 1;
        await db.workshopOccurrence.updateMany({
          where: { workshopId },
          data: { connectId: currentConnectId },
        });
      }
    } else {
      // If user UNCHECKED the box, set connectId to null for all occurrences
      await db.workshopOccurrence.updateMany({
        where: { workshopId },
        data: { connectId: null },
      });
    }
  } else {
    // Check if this is a multi-day workshop by looking at existing occurrences
    const existingConnectId = await db.workshopOccurrence.findFirst({
      where: { workshopId, connectId: { not: null } },
      select: { connectId: true },
    });

    if (existingConnectId && existingConnectId.connectId) {
      isMultiDayWorkshop = true;
      currentConnectId = existingConnectId.connectId;
    }
  }

  // Handle auto-registration of existing users to new occurrences for multi-day workshops
  if (isMultiDayWorkshop && newOccurrenceIds.length > 0) {
    // Only proceed if there are new occurrences and this is a multi-day workshop

    // 1. Find all unique users who are registered to any occurrence of this workshop
    const existingRegistrations = await db.userWorkshop.findMany({
      where: {
        workshopId,
        occurrence: {
          status: "active",
        },
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    });

    const uniqueUserIds = existingRegistrations.map((reg) => reg.userId);

    // 2. If there are existing users, register them to all new occurrences
    if (uniqueUserIds.length > 0) {
      for (const occurrenceId of newOccurrenceIds) {
        // Check if the occurrence is active before registering users
        const occurrenceStatus = await db.workshopOccurrence.findUnique({
          where: { id: occurrenceId },
          select: { status: true },
        });

        if (occurrenceStatus && occurrenceStatus.status === "active") {
          // Register each user to this new occurrence
          for (const userId of uniqueUserIds) {
            try {
              await db.userWorkshop.create({
                data: {
                  userId,
                  workshopId,
                  occurrenceId,
                  result: "passed", // Default value
                },
              });
            } catch (error) {
              // Handle potential unique constraint violations
              console.log(
                `Could not register user ${userId} to occurrence ${occurrenceId}: ${error}`
              );
            }
          }
        }
      }
    }
  }

  // Process equipment bookings if provided
  if (data.equipments && data.equipments.length > 0) {
    // First, remove existing equipment associations that are no longer needed
    const currentEquipmentIds = data.equipments;

    // Process selected equipment slots if provided
    if (data.selectedSlots && data.userId) {
      const userId = data.userId;
      const allSelectedSlotIds = Object.values(data.selectedSlots)
        .flat()
        .map(Number);
      const validSlotIds = allSelectedSlotIds.filter((id) => id > 0);

      if (validSlotIds.length > 0) {
        try {
          // Find slots that are available
          const availableSlots = await db.equipmentSlot.findMany({
            where: {
              id: { in: validSlotIds },
              OR: [
                { isBooked: false },
                {
                  workshopOccurrenceId: {
                    in: existingIds, // Allow slots already assigned to this workshop
                  },
                },
              ],
            },
          });

          if (availableSlots.length > 0) {
            // Get IDs of slots we can use
            const slotIds = availableSlots.map((slot) => slot.id);

            // Update equipment slots to be associated with this workshop
            for (const occ of [...updateOccurrences, ...createOccurrences]) {
              const occurrenceId =
                occ.id || newOccurrenceIds[createOccurrences.indexOf(occ)];

              if (occurrenceId) {
                // Associate equipment slots with this occurrence
                await db.equipmentSlot.updateMany({
                  where: {
                    id: { in: slotIds },
                    equipmentId: { in: currentEquipmentIds },
                  },
                  data: {
                    isBooked: true,
                    workshopOccurrenceId: occurrenceId,
                  },
                });

                // Create or update equipment bookings
                for (const slotId of slotIds) {
                  // Check if booking already exists
                  const existingBooking = await db.equipmentBooking.findFirst({
                    where: { slotId },
                  });

                  if (!existingBooking) {
                    // Get equipment ID for this slot
                    const slot = await db.equipmentSlot.findUnique({
                      where: { id: slotId },
                      select: { equipmentId: true },
                    });

                    if (slot) {
                      // Create new booking
                      await db.equipmentBooking.create({
                        data: {
                          userId,
                          equipmentId: slot.equipmentId,
                          slotId,
                          status: "pending",
                          bookedFor: "workshop",
                          workshopId,
                        },
                      });
                    }
                  } else {
                    // Update existing booking if needed
                    await db.equipmentBooking.update({
                      where: { id: existingBooking.id },
                      data: {
                        workshopId,
                        bookedFor: "workshop",
                      },
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error processing equipment bookings:", error);
          // Continue even if equipment booking fails
        }
      }
    }
  }

  // 4) Return updated workshop
  return db.workshop.findUnique({ where: { id: workshopId } });
}

/**
 * Deletes a workshop and all its associated occurrences
 * @param workshopId - The ID of the workshop to delete
 * @returns Promise<Object> - Success confirmation object
 * @throws Error if workshop deletion fails
 */
export async function deleteWorkshop(workshopId: number) {
  try {
    // First, get all occurrences with Google Calendar event IDs
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        occurrences: {
          where: {
            googleEventId: { not: null },
          },
        },
      },
    });

    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Delete the image file if it exists in images_custom folder
    if (workshop.imageUrl && workshop.imageUrl.startsWith("/images_custom/")) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const imagePath = path.join(process.cwd(), "public", workshop.imageUrl);

        // Check if file exists before trying to delete
        if (fs.existsSync(imagePath)) {
          await fs.promises.unlink(imagePath);
          console.log(`Deleted workshop image: ${workshop.imageUrl}`);
        }
      } catch (error) {
        console.warn(
          `Could not delete workshop image: ${error}. Continuing with workshop deletion.`
        );
        // Don't fail the deletion if we can't delete the image file
      }
    }

    // Delete Google Calendar events for all occurrences
    for (const occurrence of workshop.occurrences) {
      if (occurrence.googleEventId) {
        try {
          await deleteEventForOccurrence(occurrence.googleEventId);
        } catch (error) {
          console.error(
            `Failed to delete Google Calendar event ${occurrence.googleEventId}:`,
            error
          );
          // Continue with deletion even if Google Calendar deletion fails
        }
      }
    }

    // Now delete the workshop (this will cascade delete occurrences)
    await db.workshop.delete({
      where: { id: workshopId },
    });
    return { success: true };
  } catch (error) {
    console.error("Error deleting workshop:", error);
    throw new Error("Failed to delete workshop");
  }
}

/**
 * Registers a user for a workshop occurrence
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the specific occurrence
 * @param userId - The ID of the user to register
 * @param variationId - The ID of the selected price variation (optional)
 * @returns Promise<Object> - Registration result with success status and details
 * @throws Error if user is already registered or workshop/occurrence not found
 */
export async function registerForWorkshop(
  workshopId: number,
  occurrenceId: number,
  userId: number,
  variationId?: number | null,
  paymentIntentId?: string
) {
  try {
    // Check capacity before registering
    const capacityCheck = await checkWorkshopCapacity(
      workshopId,
      occurrenceId,
      variationId
    );

    if (!capacityCheck.hasCapacity) {
      if (capacityCheck.reason === "workshop_full") {
        throw new Error(
          `Workshop is full. Capacity: ${capacityCheck.workshopCapacity}, Current registrations: ${capacityCheck.totalRegistrations}`
        );
      } else if (capacityCheck.reason === "variation_full") {
        throw new Error(
          `${capacityCheck.variationName} variation is full. Capacity: ${capacityCheck.variationCapacity}, Current registrations: ${capacityCheck.variationRegistrations}`
        );
      }
    }

    const workshop = await getWorkshopById(workshopId);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!occurrence) {
      throw new Error("Workshop occurrence not found");
    }

    // Check if user has an existing registration (including cancelled ones)
    const existingRegistration = await db.userWorkshop.findFirst({
      where: {
        userId,
        workshopId: workshop.id,
        occurrenceId,
      },
    });

    // Determine registration result based on workshop type
    const registrationResult =
      workshop.type.toLowerCase() === "orientation" ? "pending" : "passed";

    if (existingRegistration) {
      // Update existing registration (re-registration case)
      await db.userWorkshop.update({
        where: { id: existingRegistration.id },
        data: {
          result: registrationResult,
          priceVariationId: variationId,
          date: new Date(), // Update registration date
          ...(paymentIntentId ? { paymentIntentId } : {}),
        },
      });
    } else {
      // Create new registration
      await db.userWorkshop.create({
        data: {
          userId,
          workshopId: workshop.id,
          occurrenceId,
          priceVariationId: variationId,
          result: registrationResult,
          ...(paymentIntentId ? { paymentIntentId } : {}),
        },
      });
    }

    return {
      success: true,
      workshopName: workshop.name,
      startDate: occurrence.startDate,
      endDate: occurrence.endDate,
    };
  } catch (error) {
    console.error("Error registering for workshop:", error);
    throw error;
  }
}

/**
 * Checks if a user is registered for a specific workshop occurrence
 * @param workshopId - The ID of the workshop
 * @param userId - The ID of the user to check
 * @param occurrenceId - The ID of the specific occurrence
 * @returns Promise<Object> - Object with registration status and registration date
 */
export async function checkUserRegistration(
  workshopId: number,
  userId: number,
  occurrenceId: number
): Promise<{
  registered: boolean;
  registeredAt: Date | null;
  status?: string;
}> {
  const userWorkshop = await db.userWorkshop.findFirst({
    where: {
      userId: userId,
      workshopId: workshopId,
      occurrenceId: occurrenceId,
    },
  });

  if (!userWorkshop) {
    return { registered: false, registeredAt: null };
  }

  // Check if registration is cancelled
  if (userWorkshop.result === "cancelled") {
    return {
      registered: true,
      registeredAt: userWorkshop.date,
      status: "cancelled",
    };
  }

  return {
    registered: true,
    registeredAt: userWorkshop.date,
    status: userWorkshop.result,
  };
}

/**
 * Creates a complete copy of a workshop with all its occurrences and prerequisites
 * @param workshopId - The ID of the workshop to duplicate
 * @returns Promise<Workshop> - The newly created workshop copy with occurrences
 * @throws Error if workshop not found or duplication fails
 */
export async function duplicateWorkshop(workshopId: number) {
  try {
    return await db.$transaction(async (prisma) => {
      // 1. Get original workshop with occurrences
      const originalWorkshop = await prisma.workshop.findUnique({
        where: { id: workshopId },
        include: { occurrences: true },
      });

      if (!originalWorkshop) {
        throw new Error("Workshop not found");
      }

      // 2. Create copied workshop with "(Copy)" suffix
      const newWorkshop = await prisma.workshop.create({
        data: {
          name: `${originalWorkshop.name} (Copy)`,
          description: originalWorkshop.description,
          price: originalWorkshop.price,
          location: originalWorkshop.location,
          capacity: originalWorkshop.capacity,
          type: originalWorkshop.type,
        },
      });

      // 3. Check if this is a multi-day workshop (any occurrence has a non-null connectId)
      const isMultiDayWorkshop = originalWorkshop.occurrences.some(
        (occ) => occ.connectId !== null
      );

      if (isMultiDayWorkshop) {
        // For multi-day workshops, we need to create a new connectId
        // Find the highest connectId in the database to ensure uniqueness
        const highestConnectIdResult =
          await prisma.workshopOccurrence.findFirst({
            orderBy: {
              connectId: "desc",
            },
            where: {
              connectId: {
                not: null,
              },
            },
            select: {
              connectId: true,
            },
          });

        const nextConnectId = highestConnectIdResult?.connectId
          ? highestConnectIdResult.connectId + 1
          : 1;

        // For multi-day workshops, create occurrences with the new connectId
        if (originalWorkshop.occurrences.length > 0) {
          await Promise.all(
            originalWorkshop.occurrences.map(async (occ) => {
              return prisma.workshopOccurrence.create({
                data: {
                  workshopId: newWorkshop.id,
                  startDate: occ.startDate,
                  endDate: occ.endDate,
                  startDatePST: occ.startDatePST,
                  endDatePST: occ.endDatePST,
                  connectId: nextConnectId, // Use the same new connectId for all occurrences
                  offerId: occ.offerId || 1,
                  status: "active", // Reset status to active for the copy
                },
              });
            })
          );
        }
      } else {
        // For regular workshops, duplicate occurrences without connectId
        if (originalWorkshop.occurrences.length > 0) {
          await prisma.workshopOccurrence.createMany({
            data: originalWorkshop.occurrences.map((occ) => ({
              workshopId: newWorkshop.id,
              startDate: occ.startDate,
              endDate: occ.endDate,
              startDatePST: occ.startDatePST,
              endDatePST: occ.endDatePST,
              offerId: occ.offerId || 1,
              status: "active", // Reset status to active for the copy
            })),
          });
        }
      }

      // 4. Copy any prerequisites
      const prerequisites = await prisma.workshopPrerequisite.findMany({
        where: { workshopId },
      });

      if (prerequisites.length > 0) {
        await prisma.workshopPrerequisite.createMany({
          data: prerequisites.map((prereq) => ({
            workshopId: newWorkshop.id,
            prerequisiteId: prereq.prerequisiteId,
          })),
        });
      }

      // Return the duplicated workshop with occurrences
      return prisma.workshop.findUnique({
        where: { id: newWorkshop.id },
        include: { occurrences: true },
      });
    });
  } catch (error) {
    console.error("Error duplicating workshop:", error);
    throw new Error("Failed to duplicate workshop");
  }
}

/**
 * Retrieves a specific workshop occurrence by workshop and occurrence IDs
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the specific occurrence
 * @returns Promise<WorkshopOccurrence|null> - The occurrence record or null if not found
 */
export async function getWorkshopOccurrence(
  workshopId: number,
  occurrenceId: number
) {
  try {
    const occurrence = await db.workshopOccurrence.findFirst({
      where: {
        id: occurrenceId,
        workshopId: workshopId,
      },
    });

    if (!occurrence) {
      throw new Error("Occurrence not found");
    }
    return occurrence;
  } catch (error) {
    console.error("Error fetching workshop occurrence:", error);
    throw new Error("Failed to fetch workshop occurrence");
  }
}

/**
 * Creates a duplicate of an existing occurrence with new start/end dates
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the occurrence to duplicate
 * @param newDates - Object containing new start and end dates (regular and PST)
 * @returns Promise<WorkshopOccurrence> - The newly created occurrence
 * @throws Error if original occurrence not found
 */
export async function duplicateOccurrence(
  workshopId: number,
  occurrenceId: number,
  newDates: {
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }
) {
  // Fetch the original occurrence for reference
  const original = await db.workshopOccurrence.findUnique({
    where: { id: occurrenceId },
  });
  if (!original) {
    throw new Error("Occurrence not found");
  }

  // Calculate new status based on the new startDate
  const now = new Date();
  let newStatus: "active" | "past" | "cancelled" = "active";
  if (newDates.startDate < now) {
    newStatus = "past";
  }

  // Create a new occurrence with the new dates and computed status.
  const newOccurrence = await db.workshopOccurrence.create({
    data: {
      workshopId,
      startDate: newDates.startDate,
      endDate: newDates.endDate,
      startDatePST: newDates.startDatePST,
      endDatePST: newDates.endDatePST,
      status: newStatus,
    },
  });

  return newOccurrence;
}

/**
 * Cancels a workshop occurrence by updating its status and deleting Google Calendar event
 * Also creates cancellation records for all registered users
 * @param occurrenceId - The ID of the occurrence to cancel
 * @returns Promise<WorkshopOccurrence> - The updated occurrence record
 */
export async function cancelWorkshopOccurrence(occurrenceId: number) {
  // First, get the occurrence with workshop details and registered users
  const occurrence = await db.workshopOccurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      workshop: {
        select: {
          id: true,
          name: true,
          type: true,
          location: true,
          price: true,
        },
      },
      userWorkshops: {
        where: {
          result: { not: "cancelled" }, // Only get active registrations
        },
        include: {
          user: true,
        },
      },
    },
  });

  if (!occurrence) {
    throw new Error("Workshop occurrence not found");
  }

  // Delete Google Calendar event if it exists
  if (occurrence.googleEventId) {
    try {
      await deleteEventForOccurrence(occurrence.googleEventId);
    } catch (error) {
      console.error(
        `Failed to delete Google Calendar event ${occurrence.googleEventId}:`,
        error
      );
      // Continue with cancellation even if Google Calendar deletion fails
    }
  }

  // Update all registrations to cancelled
  await db.userWorkshop.updateMany({
    where: {
      occurrenceId: occurrenceId,
      result: { not: "cancelled" },
    },
    data: {
      result: "cancelled",
    },
  });

  // Create cancellation records for all registered users
  const now = new Date();

  // Check if this is a multi-day workshop
  const isMultiDay =
    occurrence.workshop.type === "multi_day" || occurrence.connectId !== null;

  if (isMultiDay && occurrence.connectId !== null) {
    // For multi-day workshops: Create ONE cancellation record per user (not per occurrence)
    // Group by userId to avoid duplicate cancellation records
    const uniqueUsers = new Map<number, (typeof occurrence.userWorkshops)[0]>();

    for (const registration of occurrence.userWorkshops) {
      if (!uniqueUsers.has(registration.userId)) {
        uniqueUsers.set(registration.userId, registration);
      }
    }

    // Create one cancellation record per user, but only if one doesn't already exist
    for (const registration of uniqueUsers.values()) {
      // Check if a cancellation record already exists for this user and workshop
      const existingCancellation =
        await db.workshopCancelledRegistration.findFirst({
          where: {
            userId: registration.userId,
            workshopId: occurrence.workshopId,
            cancelledByAdmin: true,
            // Match by connectId through the occurrence
            workshopOccurrence: {
              connectId: occurrence.connectId,
            },
          },
        });

      // Only create if no cancellation record exists
      if (!existingCancellation) {
        await db.workshopCancelledRegistration.create({
          data: {
            userId: registration.userId,
            workshopId: occurrence.workshopId,
            workshopOccurrenceId: occurrenceId,
            priceVariationId: registration.priceVariationId,
            registrationDate: registration.date,
            cancellationDate: now,
            paymentIntentId: registration.paymentIntentId,
            cancelledByAdmin: true, // Mark as admin cancellation
          },
        });
      }
    }
  } else {
    // For regular workshops (workshop or orientation): Create ONE cancellation record per user-occurrence combination
    for (const registration of occurrence.userWorkshops) {
      await db.workshopCancelledRegistration.create({
        data: {
          userId: registration.userId,
          workshopId: occurrence.workshopId,
          workshopOccurrenceId: occurrenceId,
          priceVariationId: registration.priceVariationId,
          registrationDate: registration.date,
          cancellationDate: now,
          paymentIntentId: registration.paymentIntentId,
          cancelledByAdmin: true, // Mark as admin cancellation
        },
      });
    }
  }

  // Send email notifications to affected users
  if (isMultiDay && occurrence.connectId !== null) {
    // For multi-day workshops: Group by user and send one email per user with all sessions
    type UserRegistration = (typeof occurrence.userWorkshops)[number];
    const userRegistrationsMap = new Map<number, UserRegistration[]>();

    // Get all occurrences for this multi-day workshop to include in email
    const allOccurrences = await db.workshopOccurrence.findMany({
      where: {
        workshopId: occurrence.workshopId,
        connectId: occurrence.connectId,
      },
      orderBy: {
        startDate: "asc",
      },
    });

    for (const registration of occurrence.userWorkshops) {
      if (!userRegistrationsMap.has(registration.userId)) {
        userRegistrationsMap.set(registration.userId, []);
      }
      userRegistrationsMap.get(registration.userId)!.push(registration);
    }

    // Import email function dynamically to avoid circular dependencies
    const { sendWorkshopOccurrenceCancellationEmailMultiDay } =
      await import("../utils/email.server");

    for (const [userId, registrations] of userRegistrationsMap.entries()) {
      const user = registrations[0].user;

      const sessions = allOccurrences.map((occ) => ({
        startDate: new Date(occ.startDate),
        endDate: new Date(occ.endDate),
      }));

      // Get price variation if exists
      const priceVariation = registrations[0].priceVariationId
        ? await db.workshopPriceVariation.findUnique({
            where: { id: registrations[0].priceVariationId },
            select: {
              name: true,
              description: true,
              price: true,
            },
          })
        : null;

      try {
        await sendWorkshopOccurrenceCancellationEmailMultiDay({
          userEmail: user.email,
          workshopName: occurrence.workshop.name,
          sessions,
          location: occurrence.workshop.location,
          basePrice: occurrence.workshop.price,
          priceVariation,
        });
      } catch (emailError) {
        console.error(
          `Failed to send multi-day workshop cancellation email to user ${user.id}:`,
          emailError
        );
      }
    }
  } else {
    // For regular workshops: Send separate email for each user
    const { sendWorkshopOccurrenceCancellationEmail } =
      await import("../utils/email.server");

    for (const registration of occurrence.userWorkshops) {
      // Get price variation if exists
      const priceVariation = registration.priceVariationId
        ? await db.workshopPriceVariation.findUnique({
            where: { id: registration.priceVariationId },
            select: {
              name: true,
              description: true,
              price: true,
            },
          })
        : null;

      try {
        await sendWorkshopOccurrenceCancellationEmail({
          userEmail: registration.user.email,
          workshopName: occurrence.workshop.name,
          workshopType: occurrence.workshop.type,
          startDate: new Date(occurrence.startDate),
          endDate: new Date(occurrence.endDate),
          location: occurrence.workshop.location,
          basePrice: occurrence.workshop.price,
          priceVariation,
        });
      } catch (emailError) {
        console.error(
          `Failed to send workshop cancellation email to user ${registration.user.id}:`,
          emailError
        );
      }
    }
  }

  // Update the occurrence status to cancelled
  return db.workshopOccurrence.update({
    where: { id: occurrenceId },
    data: {
      status: "cancelled",
      googleEventId: null, // Clear the Google event ID since the event is deleted
    },
  });
}

/**
 * Gets the list of prerequisite workshop IDs that a user has successfully completed
 * @param userId - The ID of the user to check prerequisites for
 * @param workshopId - The ID of the workshop to check prerequisites for
 * @returns Promise<number[]> - Array of completed prerequisite workshop IDs
 */
export async function getUserCompletedPrerequisites(
  userId: number,
  workshopId: number
) {
  if (!userId) return [];

  // First, get all prerequisite IDs for the workshop
  const workshop = await db.workshop.findUnique({
    where: { id: workshopId },
    include: {
      prerequisites: {
        select: { prerequisiteId: true },
      },
    },
  });

  if (!workshop || !workshop.prerequisites.length) return [];

  // Get the list of prerequisite IDs
  const prerequisiteIds = workshop.prerequisites.map((p) => p.prerequisiteId);

  // Find all workshop occurrences the user has completed successfully
  const completedWorkshops = await db.userWorkshop.findMany({
    where: {
      userId: userId,
      workshopId: { in: prerequisiteIds },
      result: "passed",
    },
    select: {
      workshopId: true,
    },
  });

  // Return array of completed prerequisite workshop IDs
  return [...new Set(completedWorkshops.map((cw) => cw.workshopId))];
}

/**
 * Retrieves all workshops that a user is registered for
 * @param request - The HTTP request object to extract user from session
 * @returns Promise<Workshop[]> - Array of workshops the user is registered for
 * @throws Response with 401 status if user not authenticated
 */
export async function getUserWorkshops(request: Request) {
  // Get the logged-in user
  const user = await getUser(request);

  if (!user) {
    throw new Response("Not authenticated", { status: 401 });
  }

  // Fetch workshops the user is registered for
  const userWorkshops = await db.userWorkshop.findMany({
    where: { userId: user.id },
    include: { workshop: true },
  });

  return userWorkshops.map((entry) => entry.workshop);
}

/**
 * Retrieves all workshop registrations across all users and workshops
 * @returns Promise<Array> - Array of all registration records with user, workshop, and occurrence details
 */
export async function getAllRegistrations() {
  return db.userWorkshop.findMany({
    orderBy: {
      date: "asc",
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      workshop: {
        select: {
          name: true,
          type: true, // Include the workshop type
        },
      },
      occurrence: {
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });
}

/**
 * Updates the result status of a workshop registration (for roleLevel 2 and 3)
 * This function handles roleLevel 2 and 3
 * @param registrationId - The ID of the registration to update
 * @param newResult - The new result status (e.g., "passed", "failed", "pending")
 * @returns Promise<UserWorkshop> - The updated registration record with related data
 */
export async function updateRegistrationResult(
  registrationId: number,
  newResult: string
) {
  // Update the registration record and include related workshop and user data.
  const updatedReg = await db.userWorkshop.update({
    where: { id: registrationId },
    data: { result: newResult },
    include: {
      workshop: true, // so we can check the workshop type
      user: true, // so we can check and update user's roleLevel
    },
  });

  // Only process if this registration is for an orientation.
  if (updatedReg.workshop?.type?.toLowerCase() === "orientation") {
    // Case: Orientation is now passed.
    if (newResult.toLowerCase() === "passed") {
      // Check if the user has a membership.
      const membership = await db.userMembership.findFirst({
        where: { userId: updatedReg.user.id },
      });
      if (membership) {
        // If they have a membership, upgrade to level 3 if not already there.
        if (updatedReg.user.roleLevel < 3) {
          await db.user.update({
            where: { id: updatedReg.user.id },
            data: { roleLevel: 3 },
          });
        }
      } else {
        // If no membership exists, upgrade to level 2 if below level 2.
        if (updatedReg.user.roleLevel < 2) {
          await db.user.update({
            where: { id: updatedReg.user.id },
            data: { roleLevel: 2 },
          });
        }
      }
    } else {
      // Case: Orientation result is not passed (e.g., "failed" or "pending")
      // Check how many of the user's orientation registrations are passed.
      const passedCount = await db.userWorkshop.count({
        where: {
          userId: updatedReg.user.id,
          result: { equals: "passed", mode: "insensitive" },
          workshop: {
            type: { equals: "orientation", mode: "insensitive" },
          },
        },
      });
      // If none are passed, revert user to level 1.
      if (passedCount === 0) {
        await db.user.update({
          where: { id: updatedReg.user.id },
          data: { roleLevel: 1 },
        });
      } else {
        // Otherwise, if the user has a membership and at least one passed orientation,
        // ensure they remain level 3; if no membership, level should be 2.
        const membership = await db.userMembership.findFirst({
          where: { userId: updatedReg.user.id },
        });
        if (membership) {
          if (updatedReg.user.roleLevel !== 3) {
            await db.user.update({
              where: { id: updatedReg.user.id },
              data: { roleLevel: 3 },
            });
          }
        } else {
          if (updatedReg.user.roleLevel !== 2) {
            await db.user.update({
              where: { id: updatedReg.user.id },
              data: { roleLevel: 2 },
            });
          }
        }
      }
    }
  }

  return updatedReg;
}

/**
 * Updates multiple workshop registrations with a new result status and adjusts user role levels
 * This function handles roleLevel 2 and 3
 * @param registrationIds - Array of registration IDs to update
 * @param newResult - The new result status to apply to all registrations
 * @returns Promise<Object> - Bulk update result from database
 */
export async function updateMultipleRegistrations(
  registrationIds: number[],
  newResult: string
) {
  // Bulk update the registrations with the new result.
  const updateResult = await db.userWorkshop.updateMany({
    where: { id: { in: registrationIds } },
    data: { result: newResult },
  });

  // Fetch the updated registrations including related user and workshop data.
  const updatedRegistrations = await db.userWorkshop.findMany({
    where: { id: { in: registrationIds } },
    include: { user: true, workshop: true },
  });

  // Get unique user IDs for registrations related to orientations.
  const orientationUserIds = Array.from(
    new Set(
      updatedRegistrations
        .filter((reg) => reg.workshop?.type.toLowerCase() === "orientation")
        .map((reg) => reg.user.id)
    )
  );

  for (const uid of orientationUserIds) {
    // Count the number of passed orientation registrations for this user.
    const passedCount = await db.userWorkshop.count({
      where: {
        userId: uid,
        result: { equals: "passed", mode: "insensitive" },
        workshop: {
          type: { equals: "orientation", mode: "insensitive" },
        },
      },
    });

    // Check if the user has an active membership.
    const membership = await db.userMembership.findFirst({
      where: { userId: uid },
    });

    // Determine desired role level:
    // - Default is level 1.
    // - If at least one orientation is passed, then:
    //     * Level becomes 3 if the user has a membership.
    //     * Otherwise, level becomes 2.
    let desiredRoleLevel = 1;
    if (passedCount > 0) {
      desiredRoleLevel = membership ? 3 : 2;
    }

    // Update the user’s role level if it differs.
    const user = updatedRegistrations.find((reg) => reg.user.id === uid)?.user;
    if (user && user.roleLevel !== desiredRoleLevel) {
      await db.user.update({
        where: { id: uid },
        data: { roleLevel: desiredRoleLevel },
      });
    }
  }

  return updateResult;
}

/**
 * Retrieves all workshop registration occurrence IDs for a specific user
 * @param userId - The ID of the user to get registrations for
 * @returns Promise<Array> - Array of objects containing occurrence IDs
 */
export async function getUserWorkshopRegistrations(userId: number) {
  return db.userWorkshop.findMany({
    where: {
      userId,
    },
    select: {
      occurrenceId: true,
    },
  });
}

/**
 * Fetches all workshops a user is registered for along with complete occurrence details
 * @param userId - The ID of the user to get workshops for
 * @returns Promise<Array> - Array of workshops with full occurrence arrays (deduplicated)
 */
export async function getUserWorkshopsWithOccurrences(userId: number) {
  // 1. Find all userWorkshop records for the given user, excluding cancelled registrations
  const userWorkshops = await db.userWorkshop.findMany({
    where: {
      userId,
      result: { not: "cancelled" }, // Exclude cancelled registrations
    },
    // 2. Include the occurrence -> workshop -> occurrences
    include: {
      occurrence: {
        include: {
          workshop: {
            include: {
              occurrences: true,
            },
          },
        },
      },
    },
  });

  // 3. userWorkshops is an array of { occurrence: { workshop: { ... } } }.
  //    Transform it into a simple array of workshop objects with an occurrences array.
  const workshopMap = new Map<number, any>();

  for (const uw of userWorkshops) {
    const w = uw.occurrence.workshop;
    // If we haven't seen this workshop yet, store it
    if (!workshopMap.has(w.id)) {
      workshopMap.set(w.id, {
        id: w.id,
        name: w.name,
        description: w.description,
        price: w.price,
        type: w.type,
        // "occurrences" is already included because we used { include: { occurrences: true } }
        occurrences: w.occurrences ?? [],
      });
    }
  }

  // Return a deduplicated array of workshop objects (each has an occurrences array)
  return Array.from(workshopMap.values());
}

/**
 * Retrieves all user registrations for a specific workshop across all its occurrences
 * @param workshopId - The ID of the workshop to get registrations for
 * @returns Promise<Array> - Array of registration records with user, occurrence, and workshop details
 */
export async function getUserWorkshopRegistrationsByWorkshopId(
  workshopId: number
) {
  return db.userWorkshop.findMany({
    where: {
      occurrence: {
        workshopId, // Only registrations for occurrences belonging to this workshop
      },
    },
    include: {
      user: true,
      occurrence: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          connectId: true,
        },
      },
      workshop: true,
      priceVariation: true,
    },
    orderBy: [{ userId: "asc" }, { occurrence: { startDate: "asc" } }],
  });
}

/**
 * Cancels a user's registration for a specific workshop occurrence by marking as cancelled
 * and creates a cancellation record for admin tracking
 * @param params - Object containing workshopId, occurrenceId, and userId
 * @param params.workshopId - The ID of the workshop
 * @param params.occurrenceId - The ID of the occurrence
 * @param params.userId - The ID of the user to cancel registration for
 * @returns Promise<Object> - Database update result with cancellation tracking
 */
export async function cancelUserWorkshopRegistration({
  workshopId,
  occurrenceId,
  userId,
}: {
  workshopId: number;
  occurrenceId: number;
  userId: number;
}) {
  // First, get the original registration to capture the registration date and price variation
  const existingRegistration = await db.userWorkshop.findFirst({
    where: {
      workshopId,
      occurrenceId,
      userId,
      result: { not: "cancelled" }, // Only get active registrations
    },
    include: {
      priceVariation: true,
    },
  });

  if (!existingRegistration) {
    throw new Error("No active registration found to cancel");
  }

  // Update the registration to cancelled
  const updateResult = await db.userWorkshop.updateMany({
    where: {
      workshopId,
      occurrenceId,
      userId,
    },
    data: {
      result: "cancelled",
    },
  });

  // Create a cancellation record for admin tracking
  await createWorkshopCancellation({
    userId,
    workshopId,
    workshopOccurrenceId: occurrenceId,
    priceVariationId: existingRegistration.priceVariationId,
    registrationDate: existingRegistration.date,
    cancellationDate: new Date(),
    paymentIntentId: existingRegistration.paymentIntentId,
    cancelledByAdmin: false, // User-initiated cancellation
  });

  return updateResult;
}

/**
 * Cancels all registrations for a multi-day workshop using connectId
 * and creates cancellation records for admin tracking
 * @param params - Object containing workshopId, connectId, and userId
 * @param params.workshopId - The ID of the workshop
 * @param params.connectId - The connect ID linking all workshop occurrences
 * @param params.userId - The ID of the user to cancel registration for
 * @returns Promise<Object> - Database update result with cancellation tracking
 */
export async function cancelMultiDayWorkshopRegistration({
  workshopId,
  connectId,
  userId,
}: {
  workshopId: number;
  connectId: number;
  userId: number;
}) {
  // Get all occurrences for this multi-day workshop
  const occurrences = await getWorkshopOccurrencesByConnectId(
    workshopId,
    connectId
  );

  if (occurrences.length === 0) {
    throw new Error("No occurrences found for this multi-day workshop");
  }

  // Get all existing registrations for this user across all occurrences
  const existingRegistrations = await db.userWorkshop.findMany({
    where: {
      workshopId,
      userId,
      occurrenceId: { in: occurrences.map((occ) => occ.id) },
      result: { not: "cancelled" }, // Only get active registrations
    },
    include: {
      priceVariation: true,
    },
  });

  if (existingRegistrations.length === 0) {
    throw new Error("No active registrations found to cancel");
  }

  // Update all registrations to cancelled
  const updateResult = await db.userWorkshop.updateMany({
    where: {
      workshopId,
      userId,
      occurrenceId: { in: occurrences.map((occ) => occ.id) },
    },
    data: {
      result: "cancelled",
    },
  });

  // For multi-day workshops, create only one cancellation record using the first occurrence
  // but store all occurrence IDs in a way that can be retrieved later
  const firstRegistration = existingRegistrations[0];
  await createWorkshopCancellation({
    userId,
    workshopId,
    workshopOccurrenceId: firstRegistration.occurrenceId, // Use first occurrence as primary
    priceVariationId: firstRegistration.priceVariationId,
    registrationDate: firstRegistration.date,
    cancellationDate: new Date(),
    paymentIntentId: firstRegistration.paymentIntentId,
    cancelledByAdmin: false, // User-initiated cancellation
  });

  return updateResult;
}

/**
 * Retrieves all workshop occurrences that are part of a multi-session workshop
 * @param workshopId - The ID of the workshop
 * @param connectId - The connection ID linking multiple sessions together
 * @returns Promise<WorkshopOccurrence[]> - Array of connected workshop occurrences
 */
export async function getWorkshopOccurrencesByConnectId(
  workshopId: number,
  connectId: number
) {
  return await db.workshopOccurrence.findMany({
    where: {
      workshopId,
      connectId,
    },
    orderBy: {
      startDate: "asc",
    },
  });
}

/**
 * Registers a user for all occurrences of a multi-day workshop using connectId
 * @param workshopId - The ID of the workshop
 * @param connectId - The connect ID linking all workshop occurrences
 * @param userId - The ID of the user to register
 * @param variationId - The ID of the selected price variation (optional)
 * @returns Promise<Object> - Registration result with success status
 * @throws Error if registration fails for any occurrence
 */
export async function registerUserForAllOccurrences(
  workshopId: number,
  connectId: number,
  userId: number,
  variationId?: number | null,
  paymentIntentId?: string
) {
  try {
    // Check capacity before registering for multi-day workshop
    const capacityCheck = await checkMultiDayWorkshopCapacity(
      workshopId,
      connectId,
      variationId
    );

    if (!capacityCheck.hasCapacity) {
      if (capacityCheck.reason === "workshop_full") {
        throw new Error(
          `Workshop is full. Capacity: ${capacityCheck.workshopCapacity}, Current registrations: ${capacityCheck.totalRegistrations}`
        );
      } else if (capacityCheck.reason === "variation_full") {
        throw new Error(
          `${capacityCheck.variationName} variation is full. Capacity: ${capacityCheck.variationCapacity}, Current registrations: ${capacityCheck.variationRegistrations}`
        );
      }
    }

    // Get all occurrences for this workshop with the given connectId
    const occurrences = await getWorkshopOccurrencesByConnectId(
      workshopId,
      connectId
    );

    if (!occurrences || occurrences.length === 0) {
      throw new Error("No occurrences found for this workshop");
    }

    const workshop = await getWorkshopById(workshopId);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Determine registration result based on workshop type
    const registrationResult =
      workshop.type.toLowerCase() === "orientation" ? "pending" : undefined;

    // Register user for each occurrence
    const registrations = await Promise.all(
      occurrences.map(async (occurrence) => {
        // Check if already registered (including cancelled registrations)
        const existingRegistration = await checkUserRegistration(
          workshopId,
          userId,
          occurrence.id
        );

        // If user is currently registered and not cancelled, skip
        if (
          existingRegistration.registered &&
          existingRegistration.status !== "cancelled"
        ) {
          return { occurrenceId: occurrence.id, alreadyRegistered: true };
        }

        // Check if there's any existing record (including cancelled ones) in the database
        const existingRecord = await db.userWorkshop.findFirst({
          where: {
            userId,
            workshopId,
            occurrenceId: occurrence.id,
          },
        });

        const finalResult = registrationResult || "passed";

        if (existingRecord) {
          // Update existing record (handles re-registration for cancelled registrations)
          await db.userWorkshop.update({
            where: { id: existingRecord.id },
            data: {
              result: finalResult,
              priceVariationId: variationId,
              date: new Date(), // Update registration date
              ...(paymentIntentId ? { paymentIntentId } : {}),
            },
          });

          return { occurrenceId: occurrence.id, reRegistered: true };
        } else {
          // Create new registration
          await db.userWorkshop.create({
            data: {
              userId,
              workshopId,
              occurrenceId: occurrence.id,
              priceVariationId: variationId,
              ...(registrationResult ? { result: registrationResult } : {}),
              ...(paymentIntentId ? { paymentIntentId } : {}),
            },
          });

          return { occurrenceId: occurrence.id, registered: true };
        }
      })
    );

    return {
      success: true,
      registrations,
      workshopName: workshop.name,
    };
  } catch (error) {
    console.error("Error registering for all occurrences:", error);
    throw error;
  }
}

/**
 * Calculates user count statistics for multi-day workshops vs regular workshops
 * @param workshopId - The ID of the workshop to analyze
 * @returns Promise<Object> - Object with totalUsers and uniqueUsers counts
 */
export async function getMultiDayWorkshopUserCount(workshopId: number) {
  // Get the workshop with all occurrences and userWorkshops
  const workshop = await db.workshop.findUnique({
    where: { id: workshopId },
    include: {
      occurrences: {
        include: {
          userWorkshops: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!workshop) {
    return { totalUsers: 0, uniqueUsers: 0 };
  }

  // Check if this is a multi day workshop by looking at connectId in occurrences
  const isMultiDayWorkshop = workshop.occurrences.some(
    (occ) => occ.connectId === workshopId
  );

  if (!isMultiDayWorkshop) {
    // For regular workshops, just count total registrations and unique users
    const totalUsers = workshop.occurrences.reduce(
      (sum, occ) => sum + occ.userWorkshops.length,
      0
    );

    // Get unique user IDs across all occurrences
    const allUserIds = workshop.occurrences.flatMap((occ) =>
      occ.userWorkshops.map((uw) => uw.userId)
    );
    const uniqueUsers = new Set(allUserIds).size;

    return { totalUsers, uniqueUsers };
  } else {
    // For multi-day workshops, calculate differently
    // Get unique users
    const allUserIds = workshop.occurrences.flatMap((occ) =>
      occ.userWorkshops.map((uw) => uw.userId)
    );
    const uniqueUserIds = [...new Set(allUserIds)];
    const uniqueUsers = uniqueUserIds.length;

    // For multi-day workshops, total users is unique users × number of occurrences
    // This represents what would be shown after auto-registration
    const activeOccurrences = workshop.occurrences.filter(
      (occ) => occ.status === "active"
    ).length;
    const totalUsers = uniqueUsers * activeOccurrences;

    return { totalUsers, uniqueUsers };
  }
}

/**
 * Creates new occurrences for an existing workshop with a unique offer ID to group them
 * @param workshopId - The ID of the workshop to offer again
 * @param occurrences - Array of new occurrence data with dates and times
 * @returns Promise<WorkshopOccurrence[]> - Array of created workshop occurrences
 * @throws Error if workshop not found or occurrence creation fails
 */
export async function offerWorkshopAgain(
  workshopId: number,
  occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST: Date;
    endDatePST: Date;
  }[]
) {
  try {
    // Fetch workshop with all required data once before the loop
    const ws = await db.workshop.findUnique({
      where: { id: workshopId },
      include: { priceVariations: { where: { status: "active" } } },
    });

    if (!ws) {
      throw new Error("Workshop not found");
    }

    // Get the maximum existing offerId for this workshop
    const maxOfferIdResult = await db.workshopOccurrence.aggregate({
      where: { workshopId },
      _max: { offerId: true },
    });

    // Generate a new offerId (increment from the highest existing one, or start at 1)
    const newOfferId = ((maxOfferIdResult._max.offerId as number) || 0) + 1;

    // Create all the new occurrences with the same offerId
    const now = new Date();
    const createdOccurrences = await Promise.all(
      occurrences.map(async (occ) => {
        // Determine the status based on the start date
        const status = occ.startDate >= now ? "active" : "past";

        const created = await db.workshopOccurrence.create({
          data: {
            workshopId,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status,
            offerId: newOfferId,
          },
        });
        try {
          const eventId = await createEventForOccurrence(
            {
              id: workshopId,
              name: ws.name,
              description: ws.description,
              price: ws.price,
              location: ws.location,
              capacity: ws.capacity,
              type: ws.type,
              hasPriceVariations: ws.hasPriceVariations,
              priceVariations: ws.priceVariations.map((pv) => ({
                name: pv.name,
                description: pv.description,
                price: pv.price,
              })),
            },
            {
              id: created.id,
              startDate: created.startDate,
              endDate: created.endDate,
              startDatePST: created.startDatePST ?? undefined,
              endDatePST: created.endDatePST ?? undefined,
              connectId: created.connectId ?? undefined,
            }
          );
          if (eventId) {
            await db.workshopOccurrence.update({
              where: { id: created.id },
              data: { googleEventId: eventId },
            });
          }
        } catch (err) {
          console.error("Failed to create Google Calendar event:", err);
        }
        return created;
      })
    );

    return createdOccurrences;
  } catch (error) {
    console.error("Error offering workshop again:", error);
    throw new Error("Failed to create new workshop offer");
  }
}

/**
 * Retrieves workshop with price variations by workshop ID
 * @param workshopId - The ID of the workshop to retrieve
 * @returns Promise<Workshop|null> - The workshop record with price variations or null if not found
 */
export async function getWorkshopWithPriceVariations(workshopId: number) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: {
          orderBy: [
            { status: "asc" }, // Active first, then cancelled
            { id: "asc" },
          ],
        },
        occurrences: {
          include: {
            userWorkshops: true,
            equipmentSlots: {
              include: {
                equipment: true,
              },
              orderBy: {
                startTime: "asc",
              },
            },
          },
        },
        prerequisites: {
          select: {
            prerequisiteId: true,
          },
        },
      },
    });

    if (!workshop) {
      return null;
    }

    // Flatten prerequisite workshop IDs
    const prerequisites = workshop.prerequisites.map((p) => p.prerequisiteId);

    // Extract all equipment IDs used in the workshop occurrences
    const equipments = workshop.occurrences.flatMap((occ) =>
      occ.equipmentSlots.map((slot) => slot.equipmentId)
    );

    return {
      ...workshop,
      prerequisites,
      equipments,
    };
  } catch (error) {
    console.error("Error fetching workshop with price variations:", error);
    throw new Error("Failed to fetch workshop with price variations");
  }
}

/**
 * Retrieves a specific workshop price variation by its ID
 * @param variationId - The ID of the price variation to retrieve
 * @returns Promise<WorkshopPriceVariation|null> - The variation record or null if not found
 */
export async function getWorkshopPriceVariation(variationId: number) {
  try {
    const variation = await db.workshopPriceVariation.findUnique({
      where: { id: variationId },
    });
    return variation;
  } catch (error) {
    console.error("Error fetching workshop price variation:", error);
    throw new Error("Failed to fetch workshop price variation");
  }
}

/**
 * Checks if workshop or price variation has capacity for registration
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the specific occurrence
 * @param variationId - Optional price variation ID
 * @returns Promise<Object> - Object with capacity status and counts
 */
export async function checkWorkshopCapacity(
  workshopId: number,
  occurrenceId: number,
  variationId?: number | null
) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: true,
        occurrences: {
          where: { id: occurrenceId },
          include: {
            userWorkshops: true,
          },
        },
      },
    });

    if (!workshop || workshop.occurrences.length === 0) {
      throw new Error("Workshop or occurrence not found");
    }

    const occurrence = workshop.occurrences[0];
    const totalRegistrations = occurrence.userWorkshops.length;

    // Check base workshop capacity
    if (totalRegistrations >= workshop.capacity) {
      return {
        hasCapacity: false,
        reason: "workshop_full",
        workshopCapacity: workshop.capacity,
        totalRegistrations,
      };
    }

    // If no variation specified, just check base capacity
    if (!variationId) {
      return {
        hasCapacity: true,
        workshopCapacity: workshop.capacity,
        totalRegistrations,
      };
    }

    // Check specific variation capacity
    const variation = workshop.priceVariations.find(
      (v) => v.id === variationId
    );
    if (!variation) {
      throw new Error("Price variation not found");
    }

    const variationRegistrations = occurrence.userWorkshops.filter(
      (uw) => uw.priceVariationId === variationId
    ).length;

    if (variationRegistrations >= variation.capacity) {
      return {
        hasCapacity: false,
        reason: "variation_full",
        variationCapacity: variation.capacity,
        variationRegistrations,
        variationName: variation.name,
      };
    }

    return {
      hasCapacity: true,
      workshopCapacity: workshop.capacity,
      totalRegistrations,
      variationCapacity: variation.capacity,
      variationRegistrations,
    };
  } catch (error) {
    console.error("Error checking workshop capacity:", error);
    throw error;
  }
}

/**
 * Gets registration counts for workshop and all its price variations
 * @param workshopId - The ID of the workshop
 * @param occurrenceId - The ID of the specific occurrence
 * @returns Promise<Object> - Object with detailed capacity information
 */
export async function getWorkshopRegistrationCounts(
  workshopId: number,
  occurrenceId: number
) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: true,
        occurrences: {
          where: { id: occurrenceId },
          include: {
            userWorkshops: {
              include: {
                priceVariation: true,
              },
            },
          },
        },
      },
    });

    if (!workshop || workshop.occurrences.length === 0) {
      throw new Error("Workshop or occurrence not found");
    }

    const occurrence = workshop.occurrences[0];
    const registrations = occurrence.userWorkshops;

    // Filter out cancelled registrations
    const activeRegistrations = registrations.filter(
      (uw) => uw.result !== "cancelled"
    );

    // Count base registrations (no price variation)
    const baseRegistrations = activeRegistrations.filter(
      (uw) => !uw.priceVariationId
    ).length;

    // Count registrations by variation (only for active variations)
    const variationCounts = workshop.priceVariations
      .filter((variation) => variation.status !== "cancelled")
      .map((variation) => {
        const count = activeRegistrations.filter(
          (uw) => uw.priceVariationId === variation.id
        ).length;

        return {
          variationId: variation.id,
          name: variation.name,
          capacity: variation.capacity,
          registrations: count,
          hasCapacity: count < variation.capacity,
        };
      });

    return {
      workshopCapacity: workshop.capacity,
      totalRegistrations: activeRegistrations.length,
      baseRegistrations,
      hasBaseCapacity: activeRegistrations.length < workshop.capacity,
      variations: variationCounts,
    };
  } catch (error) {
    console.error("Error getting workshop registration counts:", error);
    throw error;
  }
}

/**
 * Checks if multi-day workshop has capacity for new registrations
 * @param workshopId - The ID of the workshop
 * @param connectId - The connectId for multi-day workshop occurrences
 * @param variationId - Optional price variation ID
 * @returns Promise<Object> - Object with capacity status and counts
 */
export async function checkMultiDayWorkshopCapacity(
  workshopId: number,
  connectId: number,
  variationId?: number | null
) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: true,
        occurrences: {
          where: { connectId },
          include: {
            userWorkshops: true,
          },
        },
      },
    });

    if (!workshop || workshop.occurrences.length === 0) {
      throw new Error("Workshop or occurrences not found");
    }

    // For multi-day workshops, count unique users across all occurrences
    const allUserIds = workshop.occurrences.flatMap((occ) =>
      occ.userWorkshops.map((uw) => uw.userId)
    );
    const uniqueUserIds = [...new Set(allUserIds)];
    const totalRegistrations = uniqueUserIds.length;

    // Check base workshop capacity
    if (totalRegistrations >= workshop.capacity) {
      return {
        hasCapacity: false,
        reason: "workshop_full",
        workshopCapacity: workshop.capacity,
        totalRegistrations,
      };
    }

    // If no variation specified, just check base capacity
    if (!variationId) {
      return {
        hasCapacity: true,
        workshopCapacity: workshop.capacity,
        totalRegistrations,
      };
    }

    // Check specific variation capacity
    const variation = workshop.priceVariations.find(
      (v) => v.id === variationId
    );
    if (!variation) {
      throw new Error("Price variation not found");
    }

    // Count unique users for this variation across all occurrences
    const variationUserIds = workshop.occurrences.flatMap((occ) =>
      occ.userWorkshops
        .filter((uw) => uw.priceVariationId === variationId)
        .map((uw) => uw.userId)
    );
    const uniqueVariationUserIds = [...new Set(variationUserIds)];
    const variationRegistrations = uniqueVariationUserIds.length;

    if (variationRegistrations >= variation.capacity) {
      return {
        hasCapacity: false,
        reason: "variation_full",
        variationCapacity: variation.capacity,
        variationRegistrations,
        variationName: variation.name,
      };
    }

    return {
      hasCapacity: true,
      workshopCapacity: workshop.capacity,
      totalRegistrations,
      variationCapacity: variation.capacity,
      variationRegistrations,
    };
  } catch (error) {
    console.error("Error checking multi-day workshop capacity:", error);
    throw error;
  }
}

/**
 * Gets registration counts for multi-day workshop and all its price variations
 * @param workshopId - The ID of the workshop
 * @param connectId - The connectId for multi-day workshop occurrences
 * @returns Promise<Object> - Object with detailed capacity information
 */
export async function getMultiDayWorkshopRegistrationCounts(
  workshopId: number,
  connectId: number
) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: true,
        occurrences: {
          where: { connectId },
          include: {
            userWorkshops: {
              include: {
                priceVariation: true,
              },
            },
          },
        },
      },
    });

    if (!workshop || workshop.occurrences.length === 0) {
      throw new Error("Workshop or occurrences not found");
    }

    // Get all registrations across all occurrences, filtering out cancelled ones
    const allRegistrations = workshop.occurrences.flatMap((occ) =>
      occ.userWorkshops.filter((uw) => uw.result !== "cancelled")
    );

    // Count unique users (multi-day workshop = one registration per user)
    const allUserIds = allRegistrations.map((uw) => uw.userId);
    const uniqueUserIds = [...new Set(allUserIds)];
    const totalRegistrations = uniqueUserIds.length;

    // Count base registrations (no price variation) - unique users
    const baseUserIds = allRegistrations
      .filter((uw) => !uw.priceVariationId)
      .map((uw) => uw.userId);
    const uniqueBaseUserIds = [...new Set(baseUserIds)];
    const baseRegistrations = uniqueBaseUserIds.length;

    // Count registrations by variation - unique users per variation (only for active variations)
    const variationCounts = workshop.priceVariations
      .filter((variation) => variation.status !== "cancelled")
      .map((variation) => {
        const variationUserIds = allRegistrations
          .filter((uw) => uw.priceVariationId === variation.id)
          .map((uw) => uw.userId);
        const uniqueVariationUserIds = [...new Set(variationUserIds)];
        const count = uniqueVariationUserIds.length;

        return {
          variationId: variation.id,
          name: variation.name,
          capacity: variation.capacity,
          registrations: count,
          hasCapacity: count < variation.capacity,
        };
      });

    return {
      workshopCapacity: workshop.capacity,
      totalRegistrations,
      baseRegistrations,
      hasBaseCapacity: totalRegistrations < workshop.capacity,
      variations: variationCounts,
    };
  } catch (error) {
    console.error(
      "Error getting multi-day workshop registration counts:",
      error
    );
    throw error;
  }
}

/**
 * Cancels a workshop price variation and all related registrations
 * Notifies all affected users via email about the cancellation
 * Handles both regular workshops (separate emails per occurrence) and multi-day workshops (one email with all sessions)
 * @param variationId - The ID of the price variation to cancel
 * @returns Promise<Object> - The result of the cancellation with affected user emails
 */
export async function cancelWorkshopPriceVariation(variationId: number) {
  try {
    // Get the price variation details and all affected registrations before cancelling
    const priceVariation = await db.workshopPriceVariation.findUnique({
      where: { id: variationId },
      include: {
        workshop: true,
        userWorkshops: {
          where: { result: { not: "cancelled" } }, // Only get non-cancelled registrations
          include: {
            user: true,
            occurrence: true,
          },
        },
      },
    });

    if (!priceVariation) {
      throw new Error("Price variation not found");
    }

    // Determine if this is a multi-day workshop by checking if any occurrence has a connectId
    const isMultiDay = priceVariation.userWorkshops.some(
      (uw) => uw.occurrence.connectId !== null
    );

    // Update the price variation status to cancelled
    await db.workshopPriceVariation.update({
      where: { id: variationId },
      data: { status: "cancelled" },
    });

    // Update all user registrations for this price variation to cancelled status
    await db.userWorkshop.updateMany({
      where: {
        priceVariationId: variationId,
        result: { not: "cancelled" }, // Only update non-cancelled registrations
      },
      data: { result: "cancelled" },
    });

    // Create cancellation records for the cancelled events tab
    const now = new Date();

    if (isMultiDay) {
      // For multi-day workshops: Create ONE cancellation record per user (not per occurrence)
      // Group by user and connectId combination
      const userConnectIdMap = new Map<
        string,
        (typeof priceVariation.userWorkshops)[0]
      >();

      for (const registration of priceVariation.userWorkshops) {
        const key = `${registration.user.id}-${registration.occurrence.connectId || "null"}`;
        if (!userConnectIdMap.has(key)) {
          userConnectIdMap.set(key, registration);
        }
      }

      // Create one cancellation record per user-connectId combination
      for (const registration of userConnectIdMap.values()) {
        await db.workshopCancelledRegistration.create({
          data: {
            userId: registration.user.id,
            workshopId: priceVariation.workshopId,
            workshopOccurrenceId: registration.occurrenceId, // Use first occurrence
            priceVariationId: variationId,
            registrationDate: registration.date,
            cancellationDate: now,
            paymentIntentId: registration.paymentIntentId,
            cancelledByAdmin: true, // Mark as admin cancellation
          },
        });
      }
    } else {
      // For regular workshops: Create ONE cancellation record per user-occurrence combination
      // Each separate registration gets its own cancellation record
      for (const registration of priceVariation.userWorkshops) {
        await db.workshopCancelledRegistration.create({
          data: {
            userId: registration.user.id,
            workshopId: priceVariation.workshopId,
            workshopOccurrenceId: registration.occurrenceId,
            priceVariationId: variationId,
            registrationDate: registration.date,
            cancellationDate: now,
            paymentIntentId: registration.paymentIntentId,
            cancelledByAdmin: true, // Mark as admin cancellation
          },
        });
      }
    }

    // Collect affected user emails for return
    const affectedUsers: Array<{ email: string; userId: number }> = [];
    let emailsSent = 0;

    if (isMultiDay) {
      // Multi-day workshop: Group by user, send one email per user with all sessions
      const userRegistrationsMap = new Map<
        number,
        Array<(typeof priceVariation.userWorkshops)[0]>
      >();

      priceVariation.userWorkshops.forEach((reg) => {
        const userId = reg.userId;
        if (!userRegistrationsMap.has(userId)) {
          userRegistrationsMap.set(userId, []);
        }
        userRegistrationsMap.get(userId)!.push(reg);
      });

      // Import email function dynamically to avoid circular dependencies
      const { sendWorkshopPriceVariationCancellationEmailMultiDay } =
        await import("../utils/email.server");

      for (const [, registrations] of userRegistrationsMap.entries()) {
        const user = registrations[0].user;
        affectedUsers.push({ email: user.email, userId: user.id });

        const sessions = registrations
          .map((reg) => ({
            startDate: new Date(reg.occurrence.startDate),
            endDate: new Date(reg.occurrence.endDate),
          }))
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        try {
          await sendWorkshopPriceVariationCancellationEmailMultiDay({
            userEmail: user.email,
            workshopName: priceVariation.workshop.name,
            sessions,
            location: priceVariation.workshop.location,
            basePrice: priceVariation.workshop.price,
            priceVariation: {
              name: priceVariation.name,
              description: priceVariation.description,
              price: priceVariation.price,
            },
          });
          emailsSent++;
        } catch (emailError) {
          console.error(
            `Failed to send cancellation email to user ${user.id}:`,
            emailError
          );
        }
      }
    } else {
      // Regular workshop: Send separate email for each occurrence registration
      const { sendWorkshopPriceVariationCancellationEmail } =
        await import("../utils/email.server");

      for (const registration of priceVariation.userWorkshops) {
        const user = registration.user;
        const occurrence = registration.occurrence;

        // Track unique users
        if (
          !affectedUsers.some(
            (u) => u.userId === user.id && u.email === user.email
          )
        ) {
          affectedUsers.push({ email: user.email, userId: user.id });
        }

        try {
          await sendWorkshopPriceVariationCancellationEmail({
            userEmail: user.email,
            workshopName: priceVariation.workshop.name,
            startDate: new Date(occurrence.startDate),
            endDate: new Date(occurrence.endDate),
            location: priceVariation.workshop.location,
            basePrice: priceVariation.workshop.price,
            priceVariation: {
              name: priceVariation.name,
              description: priceVariation.description,
              price: priceVariation.price,
            },
          });
          emailsSent++;
        } catch (emailError) {
          console.error(
            `Failed to send cancellation email to user ${user.id} for occurrence ${occurrence.id}:`,
            emailError
          );
        }
      }
    }

    return {
      success: true,
      affectedUsers,
      notificationsSent: emailsSent,
      isMultiDay,
    };
  } catch (error) {
    console.error("Error cancelling workshop price variation:", error);
    throw new Error("Failed to cancel workshop price variation");
  }
}

/**
 * Gets user registration information including price variation for a specific workshop
 * @param userId - The ID of the user
 * @param workshopId - The ID of the workshop
 * @returns Promise<Object> - Object with registration info including price variation
 */
export async function getUserWorkshopRegistrationInfo(
  userId: number,
  workshopId: number
) {
  if (!userId) return null;

  const userRegistration = await db.userWorkshop.findFirst({
    where: {
      userId,
      workshopId,
    },
    include: {
      priceVariation: true,
      occurrence: true,
    },
  });

  if (!userRegistration) return null;

  return {
    registered: true,
    priceVariation: userRegistration.priceVariation
      ? {
          id: userRegistration.priceVariation.id,
          name: userRegistration.priceVariation.name,
          price: userRegistration.priceVariation.price,
          description: userRegistration.priceVariation.description,
          status: userRegistration.priceVariation.status,
        }
      : null,
    occurrence: userRegistration.occurrence,
    registrationDate: userRegistration.date,
  };
}

/**
 * Gets maximum registration counts per price variation across all workshop occurrences
 * For regular workshops, capacity should be based on the highest number of registrations
 * for each price variation in any single occurrence, not the total across all occurrences
 * @param workshopId - The ID of the workshop
 * @returns Promise<Object> - Object with capacity information based on max registrations per occurrence
 */
export async function getMaxRegistrationCountsPerWorkshopPriceVariation(
  workshopId: number
) {
  try {
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
      include: {
        priceVariations: true,
        occurrences: {
          include: {
            userWorkshops: {
              include: {
                priceVariation: true,
              },
            },
          },
        },
      },
    });

    if (!workshop || workshop.occurrences.length === 0) {
      throw new Error("Workshop or occurrences not found");
    }

    // For each occurrence, count registrations by variation
    const occurrenceCounts = workshop.occurrences.map((occurrence) => {
      // Filter out cancelled registrations
      const activeRegistrations = occurrence.userWorkshops.filter(
        (uw) => uw.result !== "cancelled"
      );

      // Count base registrations (no price variation) for this occurrence
      const baseRegistrations = activeRegistrations.filter(
        (uw) => !uw.priceVariationId
      ).length;

      // Count registrations by variation for this occurrence (only for active variations)
      const variationCounts = workshop.priceVariations
        .filter((variation) => variation.status !== "cancelled")
        .map((variation) => {
          const count = activeRegistrations.filter(
            (uw) => uw.priceVariationId === variation.id
          ).length;

          return {
            variationId: variation.id,
            registrations: count,
          };
        });

      return {
        occurrenceId: occurrence.id,
        totalRegistrations: activeRegistrations.length,
        baseRegistrations,
        variationCounts,
      };
    });

    // Find the maximum registrations for each variation across all occurrences
    const maxTotalRegistrations = Math.max(
      ...occurrenceCounts.map((oc) => oc.totalRegistrations),
      0
    );

    const maxBaseRegistrations = Math.max(
      ...occurrenceCounts.map((oc) => oc.baseRegistrations),
      0
    );

    // Calculate max registrations per variation (only for active variations)
    const variationCounts = workshop.priceVariations
      .filter((variation) => variation.status !== "cancelled")
      .map((variation) => {
        const maxRegistrationsForThisVariation = Math.max(
          ...occurrenceCounts.map((oc) => {
            const variationCount = oc.variationCounts.find(
              (vc) => vc.variationId === variation.id
            );
            return variationCount ? variationCount.registrations : 0;
          }),
          0
        );

        return {
          variationId: variation.id,
          name: variation.name,
          capacity: variation.capacity,
          registrations: maxRegistrationsForThisVariation,
          hasCapacity: maxRegistrationsForThisVariation < variation.capacity,
        };
      });

    return {
      workshopCapacity: workshop.capacity,
      totalRegistrations: maxTotalRegistrations,
      baseRegistrations: maxBaseRegistrations,
      hasBaseCapacity: maxTotalRegistrations < workshop.capacity,
      variations: variationCounts,
    };
  } catch (error) {
    console.error("Error getting regular workshop registration counts:", error);
    throw error;
  }
}

/**
 * Retrieves all workshop cancellation records with associated user, workshop, occurrence, and price variation data.
 * Used by admin interface to view and manage workshop cancellations.
 *
 * @returns {Promise<Array>} Array of workshop cancellation records including:
 *   - User information (firstName, lastName, email)
 *   - Workshop details (id, name, type)
 *   - Occurrence information (id, startDate, endDate)
 *   - Price variation details (if applicable)
 *   - Cancellation metadata (registrationDate, cancellationDate, resolved status)
 *
 * @example
 * const cancellations = await getAllWorkshopCancellations();
 * console.log(`Found ${cancellations.length} workshop cancellations`);
 */
export async function getAllWorkshopCancellations() {
  const cancellations = await db.workshopCancelledRegistration.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      workshop: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      workshopOccurrence: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          connectId: true,
        },
      },
      priceVariation: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
    orderBy: {
      cancellationDate: "desc",
    },
  });

  // Map cancellations to use the stored payment intent ID from cancellation record
  const cancellationsWithPaymentIntent = cancellations.map((cancellation) => {
    return {
      ...cancellation,
      stripePaymentIntentId: cancellation.paymentIntentId || null, // Use the payment intent ID from cancellation record
    };
  });

  return cancellationsWithPaymentIntent;
}

/**
 * Updates the resolved status of a workshop cancellation record.
 * Used by administrators to mark cancellation issues as resolved or unresolved.
 *
 * @param {number} cancellationId - The unique identifier of the cancellation record
 * @param {boolean} resolved - The new resolved status (true = resolved, false = unresolved)
 *
 * @returns {Promise<Object>} The updated workshop cancellation record
 *
 * @throws {Error} If the cancellation record is not found or database operation fails
 *
 * @example
 * // Mark a cancellation as resolved
 * await updateWorkshopCancellationResolved(123, true);
 *
 * // Mark a cancellation as unresolved (needs attention)
 * await updateWorkshopCancellationResolved(123, false);
 */
export async function updateWorkshopCancellationResolved(
  cancellationId: number,
  resolved: boolean
) {
  return await db.workshopCancelledRegistration.update({
    where: { id: cancellationId },
    data: { resolved },
  });
}

/**
 * Creates a new workshop cancellation record when a user cancels their workshop registration.
 * This function should be called from the workshop cancellation logic to track the cancellation
 * for admin review and potential refund processing.
 *
 * @param {Object} cancellationData - The cancellation data object
 * @param {number} cancellationData.userId - The ID of the user cancelling the workshop
 * @param {number} cancellationData.workshopId - The ID of the workshop being cancelled
 * @param {number} cancellationData.workshopOccurrenceId - The ID of the specific workshop occurrence
 * @param {number|null} cancellationData.priceVariationId - The ID of the price variation (if applicable)
 * @param {Date} cancellationData.registrationDate - When the user originally registered
 * @param {Date} cancellationData.cancellationDate - When the user cancelled (defaults to now)
 *
 * @returns {Promise<Object>} The created workshop cancellation record
 *
 * @throws {Error} If required data is missing or database operation fails
 *
 * @example
 * const cancellationRecord = await createWorkshopCancellation({
 *   userId: 123,
 *   workshopId: 456,
 *   workshopOccurrenceId: 789,
 *   priceVariationId: 101, // or null for standard pricing
 *   registrationDate: userWorkshop.date,
 *   cancellationDate: new Date()
 * });
 */
export async function createWorkshopCancellation({
  userId,
  workshopId,
  workshopOccurrenceId,
  priceVariationId,
  registrationDate,
  cancellationDate,
  paymentIntentId,
  cancelledByAdmin = false,
}: {
  userId: number;
  workshopId: number;
  workshopOccurrenceId: number;
  priceVariationId: number | null;
  registrationDate: Date;
  cancellationDate: Date;
  paymentIntentId: string | null;
  cancelledByAdmin?: boolean;
}) {
  return await db.workshopCancelledRegistration.create({
    data: {
      userId,
      workshopId,
      workshopOccurrenceId,
      priceVariationId,
      registrationDate,
      cancellationDate,
      paymentIntentId,
      cancelledByAdmin,
    },
  });
}

/**
 * Retrieves workshop cancellations filtered by resolved status.
 * Useful for admin dashboards to show only unresolved cancellations that need attention.
 *
 * @param {boolean} resolved - Filter by resolved status (true = resolved, false = unresolved)
 *
 * @returns {Promise<Array>} Array of filtered workshop cancellation records with full details
 *
 * @example
 * // Get all unresolved cancellations for admin attention
 * const unresolvedCancellations = await getWorkshopCancellationsByStatus(false);
 *
 * // Get all resolved cancellations for reporting
 * const resolvedCancellations = await getWorkshopCancellationsByStatus(true);
 */
export async function getWorkshopCancellationsByStatus(resolved: boolean) {
  return await db.workshopCancelledRegistration.findMany({
    where: { resolved },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      workshop: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      workshopOccurrence: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
        },
      },
      priceVariation: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
    orderBy: {
      cancellationDate: "desc",
    },
  });
}

/**
 * Gets user's completed orientation history with price variation and occurrence details
 * @param userId - The ID of the user to get orientation history for
 * @returns Promise<Array> - Array of completed orientations with details
 */
export async function getUserCompletedOrientations(userId: number) {
  return await db.userWorkshop.findMany({
    where: {
      userId,
      result: "passed", // Only get completed/passed orientations
      workshop: {
        type: { equals: "orientation", mode: "insensitive" },
      },
    },
    include: {
      workshop: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          type: true,
        },
      },
      occurrence: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          connectId: true,
        },
      },
      priceVariation: {
        select: {
          id: true,
          name: true,
          price: true,
          description: true,
        },
      },
    },
    orderBy: {
      date: "desc", // Most recent first
    },
  });
}

/**
 * Updates workshop occurrence statuses based on current time
 *
 * This function automatically transitions workshop occurrences from "active" to "past" status
 * when their start date has passed. It's designed to be called periodically to maintain
 * accurate status information across all workshop occurrences in the system.
 *
 * The function only updates occurrences that are currently marked as "active" and have
 * a start date that is before the current time. Cancelled occurrences are not affected.
 *
 * @returns {Promise<Object>} Object containing the count of updated occurrences
 * @returns {number} return.updated - Number of workshop occurrences updated from active to past
 *
 * @throws {Error} If database update operation fails
 *
 * @example
 * // Manually trigger status update
 * const result = await updateWorkshopOccurrenceStatuses();
 * console.log(`Updated ${result.updated} occurrences`);
 *
 * @see startWorkshopOccurrenceStatusUpdate - For automated periodic updates
 */
export async function updateWorkshopOccurrenceStatuses() {
  try {
    // Get all active occurrences with their start dates
    const activeOccurrences = await db.workshopOccurrence.findMany({
      where: {
        status: "active",
      },
      select: {
        id: true,
        startDate: true,
      },
    });

    const now = new Date();

    // Filter occurrences where start date has passed (workshop has started)
    const idsToUpdate = activeOccurrences
      .filter((occ) => {
        // Compare using startDate (local time stored in DB)
        return occ.startDate < now;
      })
      .map((occ) => occ.id);

    // If no occurrences need updating, return early
    if (idsToUpdate.length === 0) {
      return { updated: 0 };
    }

    // Update all occurrences that have passed their start date to "past" status
    const result = await db.workshopOccurrence.updateMany({
      where: {
        id: {
          in: idsToUpdate,
        },
      },
      data: {
        status: "past",
      },
    });

    // Log the number of updated occurrences
    if (result.count > 0) {
      console.log(
        `Updated ${result.count} workshop occurrences from active to past`
      );
    }

    return { updated: result.count };
  } catch (error: any) {
    console.error(
      `Error updating workshop occurrence statuses: ${error.message}`
    );
    throw error;
  }
}

/**
 * Starts the automated workshop occurrence status update background job
 *
 * This function initializes a recurring task that runs every second to check and update
 * workshop occurrence statuses. When a workshop's start date passes, the status automatically
 * transitions from "active" to "past". This ensures the system always displays accurate
 * workshop status information in real-time.
 *
 * The update job:
 * - Runs immediately upon server startup to fix any stale statuses
 * - Continues running every second for the lifetime of the server process
 * - Updates only occurrences with "active" status where the start date has passed
 * - Does not affect cancelled or already-past occurrences
 *
 * This function should be called once during server initialization (e.g., in entry.server.ts)
 * and will continue running until the server is shut down.
 *
 * @returns {void} This function does not return a value
 *
 * @example
 * // In entry.server.ts
 * import { startWorkshopOccurrenceStatusUpdate } from "./app/models/workshop.server";
 *
 * console.log("Starting server...");
 * startWorkshopOccurrenceStatusUpdate(); // Start background job
 *
 * @performance
 * - Runs every 1 second (1000 milliseconds)
 * - Database query is efficient, only updates matching records
 * - Minimal performance impact due to optimized WHERE clause
 *
 * @see updateWorkshopOccurrenceStatuses - The function that performs the actual status updates
 */
export function startWorkshopOccurrenceStatusUpdate() {
  // Run immediately on startup to update any stale statuses
  updateWorkshopOccurrenceStatuses();

  // Then run every second (1000 milliseconds) to keep statuses up-to-date
  setInterval(() => {
    updateWorkshopOccurrenceStatuses();
  }, 1000); // 1 second

  console.log("Started workshop occurrence status update job");
}

/**
 * Fetches all workshops a user is registered for with detailed registration information
 * including all registered occurrences, price variations, and multi-day workshop detection
 * @param userId - The ID of the user to get workshops for
 * @returns Promise<Array> - Array of workshops with registration details
 */
export async function getUserWorkshopsWithRegistrationDetails(userId: number) {
  // 1. Get all non-cancelled registrations for this user with full details
  const registrations = await db.userWorkshop.findMany({
    where: {
      userId,
      result: { not: "cancelled" }, // Exclude cancelled registrations
    },
    include: {
      occurrence: {
        include: {
          workshop: {
            include: {
              occurrences: true,
              priceVariations: {
                where: {
                  status: "active",
                },
              },
            },
          },
        },
      },
      priceVariation: {
        select: {
          id: true,
          name: true,
          price: true,
          description: true,
        },
      },
    },
  });

  // 2. Group registrations by workshop
  const workshopMap = new Map<number, any>();

  for (const reg of registrations) {
    const workshop = reg.occurrence.workshop;
    const workshopId = workshop.id;

    if (!workshopMap.has(workshopId)) {
      // Initialize workshop entry
      workshopMap.set(workshopId, {
        id: workshop.id,
        name: workshop.name,
        description: workshop.description,
        price: workshop.price,
        type: workshop.type,
        imageUrl: workshop.imageUrl,
        hasPriceVariations: workshop.hasPriceVariations,
        displayPrice:
          workshop.hasPriceVariations && workshop.priceVariations.length > 0
            ? workshop.priceVariations[0].price
            : workshop.price,
        priceRange:
          workshop.hasPriceVariations && workshop.priceVariations.length > 1
            ? {
                min: workshop.priceVariations[0].price,
                max: workshop.priceVariations[
                  workshop.priceVariations.length - 1
                ].price,
              }
            : null,
        occurrences: workshop.occurrences ?? [],
        registeredOccurrences: [],
        priceVariation: null,
        isMultiDay: false,
      });
    }

    // Add this occurrence to the registered occurrences list
    const workshopData = workshopMap.get(workshopId);
    workshopData.registeredOccurrences.push({
      id: reg.occurrence.id,
      startDate: reg.occurrence.startDate,
      endDate: reg.occurrence.endDate,
      connectId: reg.occurrence.connectId,
    });

    // Set price variation (same for all occurrences in a registration)
    if (reg.priceVariation && !workshopData.priceVariation) {
      workshopData.priceVariation = reg.priceVariation;
    }

    // Detect if this is a multi-day workshop
    if (
      reg.occurrence.connectId !== null &&
      reg.occurrence.connectId !== undefined
    ) {
      workshopData.isMultiDay = true;
    }
  }

  // 3. Sort registered occurrences by start date for each workshop
  const workshops = Array.from(workshopMap.values()).map((workshop) => {
    const sortedOccurrences = workshop.registeredOccurrences.sort(
      (a: any, b: any) => {
        return (
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      }
    );

    return {
      ...workshop,
      registeredOccurrences: sortedOccurrences,
      isRegistered: sortedOccurrences.length > 0,
    };
  });

  return workshops;
}
