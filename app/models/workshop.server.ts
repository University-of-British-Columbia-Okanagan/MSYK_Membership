import { db } from "../utils/db.server";
import { getUser } from "~/utils/session.server";
import { createEquipmentSlotsForOccurrence } from "../models/equipment.server";

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
  }>;
  occurrences: {
    startDate: Date;
    endDate: Date;
    startDatePST?: Date;
    endDatePST?: Date;
  }[];
  isMultiDayWorkshop?: boolean;
  selectedSlots: Record<number, number[]>;
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
    },
  });

  return workshops.map((workshop) => {
    // Get the latest status from the most recent occurrence
    const latestStatus =
      workshop.occurrences.length > 0
        ? workshop.occurrences[workshop.occurrences.length - 1].status
        : "expired"; // Default to expired if no occurrences exist

    // Map occurrences to include registration count
    const occurrencesWithCounts = workshop.occurrences.map(
      (occurrence: any) => {
        // Use type assertion (any) to bypass TypeScript checking
        const registrationCount = occurrence.userWorkshops?.length || 0;

        // Create a new object without the userWorkshops property
        const { userWorkshops, ...occWithoutUserWorkshops } = occurrence;

        // Return the occurrence with the registration count added
        return {
          ...occWithoutUserWorkshops,
          registrationCount,
        };
      }
    );

    // Keep all existing fields in 'workshop',
    // then add/override status, and ensure 'type' is included.
    return {
      ...workshop,
      status: latestStatus,
      type: workshop.type, // explicitly include workshop.type
      occurrences: occurrencesWithCounts, // Replace occurrences with our version that includes counts
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
      data.occurrences.map((occ) =>
        db.workshopOccurrence.create({
          data: {
            workshopId: newWorkshop.id,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status: occ.startDate >= new Date() ? "active" : "past",
            connectId: newConnectId,
          },
        })
      )
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
    },
  });

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

    const createdOccurrences = await Promise.all(
      createOccurrences.map(async (occ) => {
        const status =
          occ.status === "cancelled"
            ? "cancelled"
            : occ.startDate >= now
              ? "active"
              : "past";

        // Create each occurrence individually to get its ID
        const createdOcc = await db.workshopOccurrence.create({
          data: {
            workshopId,
            startDate: occ.startDate,
            endDate: occ.endDate,
            startDatePST: occ.startDatePST,
            endDatePST: occ.endDatePST,
            status,
            offerId: currentOfferId, // Use the current highest offerId
          },
        });

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

    await db.workshopOccurrence.update({
      where: { id: occ.id },
      data: {
        startDate: occ.startDate,
        endDate: occ.endDate,
        startDatePST: occ.startDatePST,
        endDatePST: occ.endDatePST,
        status,
      },
    });
  }

  if (deleteIds.length > 0) {
    await db.workshopOccurrence.deleteMany({
      where: { id: { in: deleteIds } },
    });
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
  variationId?: number | null
) {
  try {
    // Check if the user is already registered for this occurrence
    const existingRegistration = await checkUserRegistration(
      workshopId,
      userId,
      occurrenceId
    );

    if (existingRegistration.registered) {
      throw new Error(
        "User is already registered for this workshop occurrence"
      );
    }

    // Get the workshop and occurrence to ensure they exist
    const occurrence = await getWorkshopOccurrence(workshopId, occurrenceId);
    if (!occurrence) {
      throw new Error("Workshop occurrence not found");
    }

    const workshop = await getWorkshopById(workshopId);
    if (!workshop) {
      throw new Error("Workshop not found");
    }

    // Determine registration result based on workshop type
    const registrationResult =
      workshop.type.toLowerCase() === "orientation" ? "pending" : undefined;

    // Register user for this occurrence, including the result field if applicable
    await db.userWorkshop.create({
      data: {
        userId,
        workshopId: workshop.id,
        occurrenceId,
        priceVariationId: variationId,
        ...(registrationResult ? { result: registrationResult } : {}),
      },
    });

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
): Promise<{ registered: boolean; registeredAt: Date | null }> {
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

  return { registered: true, registeredAt: userWorkshop.date };
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
 * Gets the number of users registered for a specific workshop occurrence
 * @param occurrenceId - The ID of the occurrence to count registrations for
 * @returns Promise<number> - The count of registered users
 */
export async function getRegistrationCountForOccurrence(occurrenceId: number) {
  return db.userWorkshop.count({
    where: { occurrenceId },
  });
}

/**
 * Cancels a workshop occurrence by updating its status
 * @param occurrenceId - The ID of the occurrence to cancel
 * @returns Promise<WorkshopOccurrence> - The updated occurrence record
 */
export async function cancelWorkshopOccurrence(occurrenceId: number) {
  return db.workshopOccurrence.update({
    where: { id: occurrenceId },
    data: { status: "cancelled" },
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
  // 1. Find all userWorkshop records for the given user
  const userWorkshops = await db.userWorkshop.findMany({
    where: { userId },
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
      occurrence: true,
      workshop: true,
    },
  });
}

/**
 * Cancels a user's registration for a specific workshop occurrence
 * @param params - Object containing workshopId, occurrenceId, and userId
 * @param params.workshopId - The ID of the workshop
 * @param params.occurrenceId - The ID of the occurrence
 * @param params.userId - The ID of the user to cancel registration for
 * @returns Promise<Object> - Database deletion result
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
  return await db.userWorkshop.deleteMany({
    where: {
      workshopId,
      occurrenceId,
      userId,
    },
  });
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
 * Registers a user for all occurrences in a multi-session workshop
 * @param workshopId - The ID of the workshop
 * @param connectId - The connection ID linking multiple sessions
 * @param userId - The ID of the user to register
 * @returns Promise<UserWorkshop[]> - Array of created registration records
 * @throws Error if registration fails for any occurrence
 */
export async function registerUserForAllOccurrences(
  workshopId: number,
  connectId: number,
  userId: number
) {
  // 1. Find all occurrences that match workshopId + connectId
  const occurrences = await db.workshopOccurrence.findMany({
    where: { workshopId, connectId },
  });
  if (!occurrences || occurrences.length === 0) {
    throw new Error("No occurrences found for this workshop connectId group.");
  }

  // 2. For each occurrence, insert a record in your pivot table (e.g. userWorkshop)
  for (const occ of occurrences) {
    // Check if user is already registered for this occurrence
    const existing = await db.userWorkshop.findFirst({
      where: {
        userId,
        workshopId,
        occurrenceId: occ.id,
      },
    });
    if (!existing) {
      // If not registered, create a new record
      await db.userWorkshop.create({
        data: {
          userId,
          workshopId,
          occurrenceId: occ.id,
          result: "passed",
        },
      });
    }
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
    // Verify the workshop exists
    const workshop = await db.workshop.findUnique({
      where: { id: workshopId },
    });

    if (!workshop) {
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

        return await db.workshopOccurrence.create({
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
          orderBy: { price: "asc" },
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
