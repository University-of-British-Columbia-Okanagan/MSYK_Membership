import { deleteEquipment } from "~/models/equipment.server";
import { getRoleUser } from "~/utils/session.server";

export async function action({ request, params }: { request: Request; params: { id: string } }) {
    const currentUserRole = await getRoleUser(request);
    if (currentUserRole?.roleName !== "Admin") {
        throw new Response("Access Denied", { status: 403 });
    }
    
    const equipmentId = parseInt(params.id);
    
    try {
        await deleteEquipment(equipmentId);
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete equipment" };
    }
}