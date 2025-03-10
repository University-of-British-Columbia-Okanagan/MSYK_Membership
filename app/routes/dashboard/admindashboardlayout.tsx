// admindashboardlayout.tsx
import React, { useState, useMemo } from "react";
import { Outlet, Link, redirect } from "react-router-dom";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  getWorkshops,
  deleteWorkshop,
  duplicateWorkshop,
  getAllRegistrations,
  updateRegistrationResult,
  getUserWorkshopRegistrations,
  updateMultipleRegistrations,
} from "~/models/workshop.server";
import { getRoleUser } from "~/utils/session.server";
import { useLoaderData } from "react-router";
import { FiPlus, FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Import your new ShadTable
import { ShadTable, type ColumnDefinition } from "@/components/ui/ShadTable";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  const workshops = await getWorkshops();
  const registrations = await getAllRegistrations();

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }

  let workshopsWithRegistration = workshops.map((workshop) => ({
    ...workshop,
    isRegistered: false,
  }));

  if (roleUser && roleUser.userId) {
    const adminRegistrations = await getUserWorkshopRegistrations(roleUser.userId);
    const registeredOccurrenceIds = new Set(adminRegistrations.map((reg) => reg.occurrenceId));

    workshopsWithRegistration = workshops.map((workshop) => ({
      ...workshop,
      isRegistered: workshop.occurrences.some((occurrence) =>
        registeredOccurrenceIds.has(occurrence.id)
      ),
    }));
  }

  return { roleUser, workshops: workshopsWithRegistration, registrations };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const action = formData.get("action");
  const workshopId = formData.get("workshopId");

  if (action === "edit") {
    return redirect(`/editworkshop/${workshopId}`);
  }

  if (action === "delete") {
    try {
      await deleteWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error deleting workshop:", error);
      return { error: "Failed to delete workshop" };
    }
  }

  if (action === "duplicate") {
    try {
      await duplicateWorkshop(Number(workshopId));
      return redirect("/dashboard/admin");
    } catch (error) {
      console.error("Error duplicating workshop:", error);
      return { error: "Failed to duplicate workshop" };
    }
  }

  if (action === "updateRegistrationResult") {
    const registrationId = formData.get("registrationId");
    const newResult = formData.get("newResult");
    if (registrationId && newResult) {
      try {
        await updateRegistrationResult(Number(registrationId), String(newResult));
        return redirect("/dashboard/admin");
      } catch (error) {
        console.error("Error updating registration result:", error);
        return { error: "Failed to update registration result" };
      }
    }
  }

  if (action === "passAll") {
    const registrationIdsStr = formData.get("registrationIds");
    if (registrationIdsStr) {
      const registrationIds = JSON.parse(registrationIdsStr as string) as number[];
      try {
        await updateMultipleRegistrations(registrationIds, "passed");
        return redirect("/dashboard/admin");
      } catch (error) {
        console.error("Error updating multiple registrations:", error);
        return { error: "Failed to pass all registrations" };
      }
    }
  }

  return null;
}

export default function AdminDashboard() {
  const { roleUser, workshops, registrations } = useLoaderData() as {
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    };
    workshops: {
      id: number;
      name: string;
      description: string;
      price: number;
      type: string;
      occurrences: { id: number; startDate: string; endDate: string }[];
      isRegistered: boolean;
    }[];
    registrations: {
      id: number;
      result: string;
      date: string | Date;
      user: { firstName: string; lastName: string };
      workshop: { name: string; type: string };
      occurrence: { startDate: string | Date; endDate: string | Date };
    }[];
  };

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <div className="flex justify-end mb-6 pr-4">
            <Link to="/addworkshop">
              <button className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition">
                <FiPlus size={18} /> Add Workshop
              </button>
            </Link>
          </div>

          <WorkshopList title="Workshops" workshops={workshops} isAdmin={true} />

          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
