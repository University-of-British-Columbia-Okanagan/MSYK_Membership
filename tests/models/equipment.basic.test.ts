import "tests/fixtures/equipment/setup";

import { getEquipmentMocks } from "tests/fixtures/equipment/setup";
import {
  createMockEquipment,
  createMockSlot,
} from "tests/fixtures/equipment/equipments";
import { clearAllMocks } from "tests/helpers/test-utils";
import {
  getEquipmentById,
  getAvailableEquipment,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  duplicateEquipment,
  getAllEquipment,
  getEquipmentByName,
  toggleEquipmentAvailability,
  getAvailableEquipmentForAdmin,
} from "~/models/equipment.server";

describe("equipment.server - Basic Operations", () => {
  let db: any;

  beforeEach(() => {
    clearAllMocks();
    const mocks = getEquipmentMocks();
    db = mocks.db;
  });

  describe("getEquipmentById", () => {
    it("returns equipment with flattened prerequisites", async () => {
      const equipment = createMockEquipment({
        prerequisites: [
          { workshopPrerequisiteId: 1 },
          { workshopPrerequisiteId: 2 },
        ],
      });

      db.equipment.findUnique.mockResolvedValue(equipment);

      const result = await getEquipmentById(1);

      expect(result.prerequisites).toEqual([1, 2]);
      expect(db.equipment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          prerequisites: {
            select: { workshopPrerequisiteId: true },
          },
        },
      });
    });

    it("throws when equipment not found", async () => {
      db.equipment.findUnique.mockResolvedValue(null);

      await expect(getEquipmentById(999)).rejects.toThrow("Failed to fetch equipment");
    });
  });

  describe("getAvailableEquipment", () => {
    it("returns available equipment with slot counts", async () => {
      const equipment = createMockEquipment({
        slots: [
          { id: 1, isBooked: false },
          { id: 2, isBooked: true },
        ],
      });

      db.equipment.findMany.mockResolvedValue([equipment]);

      const result = await getAvailableEquipment();

      expect(result).toEqual([
        expect.objectContaining({
          id: equipment.id,
          totalSlots: 2,
          bookedSlots: 1,
          status: "available",
        }),
      ]);
    });

    it("marks equipment unavailable when all slots booked", async () => {
      const equipment = createMockEquipment({
        slots: [
          { id: 1, isBooked: true },
          { id: 2, isBooked: true },
        ],
      });

      db.equipment.findMany.mockResolvedValue([equipment]);

      const result = await getAvailableEquipment();

      expect(result[0].status).toBe("unavailable");
    });
  });

  describe("addEquipment", () => {
    it("creates equipment with prerequisites", async () => {
      const data = {
        name: "Drill Press",
        description: "Bench drill",
        price: 15,
        availability: true,
        workshopPrerequisites: [1, 2],
      };

      db.equipment.create.mockResolvedValue({ id: 10, ...data });
      db.equipmentPrerequisite.createMany.mockResolvedValue({});

      const result = await addEquipment(data);

      expect(result.id).toBe(10);
      expect(db.equipment.create).toHaveBeenCalledWith({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          availability: data.availability,
        },
      });
      expect(db.equipmentPrerequisite.createMany).toHaveBeenCalledWith({
        data: [
          { equipmentId: 10, workshopPrerequisiteId: 1 },
          { equipmentId: 10, workshopPrerequisiteId: 2 },
        ],
      });
    });
  });

  describe("updateEquipment", () => {
    it("updates equipment fields", async () => {
      db.equipment.update.mockResolvedValue({ id: 1, name: "Updated" });

      const result = await updateEquipment(1, { name: "Updated" });

      expect(result).toEqual({ id: 1, name: "Updated" });
      expect(db.equipment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: "Updated" },
      });
    });
  });

  describe("deleteEquipment", () => {
    it("deletes equipment after removing slots", async () => {
      db.equipment.findUnique.mockResolvedValue({ id: 5 });
      db.equipmentSlot.deleteMany.mockResolvedValue({ count: 2 });
      db.equipment.delete.mockResolvedValue({ id: 5 });

      const result = await deleteEquipment(5);

      expect(result.id).toBe(5);
      expect(db.equipmentSlot.deleteMany).toHaveBeenCalledWith({
        where: { equipmentId: 5 },
      });
      expect(db.equipment.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it("throws when equipment missing", async () => {
      db.equipment.findUnique.mockResolvedValue(null);

      await expect(deleteEquipment(99)).rejects.toThrow("Failed to delete equipment.");
    });
  });

  describe("duplicateEquipment", () => {
    it("creates a copy with (Copy) suffix", async () => {
      const equipment = createMockEquipment();

      db.equipment.findUnique.mockResolvedValue(equipment);
      db.equipment.create.mockResolvedValue({ id: 20, name: `${equipment.name} (Copy)` });

      const result = await duplicateEquipment(1);

      expect(result.name).toBe(`${equipment.name} (Copy)`);
      expect(db.equipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: `${equipment.name} (Copy)`,
          description: equipment.description,
        }),
      });
    });

    it("throws when original not found", async () => {
      db.equipment.findUnique.mockResolvedValue(null);

      await expect(duplicateEquipment(1)).rejects.toThrow("Failed to duplicate equipment.");
    });
  });

  describe("getAllEquipment", () => {
    it("returns equipment with availability status", async () => {
      const equipment = createMockEquipment({
        slots: [
          { id: 1, isBooked: false },
          { id: 2, isBooked: true },
        ],
      });

      db.equipment.findMany.mockResolvedValue([equipment]);

      const result = await getAllEquipment();

      expect(result[0]).toEqual(
        expect.objectContaining({
          id: equipment.id,
          availability: true,
          totalSlots: 2,
          bookedSlots: 1,
          status: "available",
        })
      );
    });
  });

  describe("getEquipmentByName", () => {
    it("finds equipment by name", async () => {
      const equipment = createMockEquipment({ name: "Router" });
      db.equipment.findFirst.mockResolvedValue(equipment);

      const result = await getEquipmentByName("Router");

      expect(result).toBe(equipment);
      expect(db.equipment.findFirst).toHaveBeenCalledWith({ where: { name: "Router" } });
    });
  });

  describe("toggleEquipmentAvailability", () => {
    it("updates availability flag", async () => {
      db.equipment.update.mockResolvedValue({ id: 7, availability: false });

      const result = await toggleEquipmentAvailability(7, false);

      expect(result.availability).toBe(false);
      expect(db.equipment.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { availability: false },
      });
    });
  });

  describe("getAvailableEquipmentForAdmin", () => {
    it("returns equipment with unbooked slots", async () => {
      const equipment = createMockEquipment({
        slots: [createMockSlot({ id: 1, isBooked: false })],
      });

      db.equipment.findMany.mockResolvedValue([equipment]);

      const result = await getAvailableEquipmentForAdmin();

      expect(result[0].slots).toHaveLength(1);
      expect(result[0].slots[0].isBooked).toBe(false);
    });
  });
});

