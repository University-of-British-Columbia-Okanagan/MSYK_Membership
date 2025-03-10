import { db } from "../utils/db.server";

export async function getAllUsers() {
  return db.user.findMany();
}

export async function updateUserRole(userId: number, newRoleId: string) {
  return db.user.update({
    where: { id: userId },
    data: { roleLevel: Number(newRoleId) },
  });
}
