// allusersregistered.tsx
import React, { useState, useMemo } from "react";
import { Outlet, redirect, useLoaderData } from "react-router";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getRoleUser } from "~/utils/session.server";
import { getAllUsers, updateUserRole } from "~/models/user.server";
import { ShadTable, type ColumnDefinition } from "@/components/ui/ShadTable";
import { FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  // Only admins can access this page.
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    return redirect("/dashboard/user");
  }
  const users = await getAllUsers();
  return { roleUser, users };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("action");
  if (actionType === "updateUserRole") {
    const userId = formData.get("userId");
    const newRoleId = formData.get("newRoleId");
    try {
      await updateUserRole(Number(userId), String(newRoleId));
      return redirect("/dashboard/admin/users");
    } catch (error) {
      console.error("Error updating user role:", error);
      return { error: "Failed to update user role" };
    }
  }
  return null;
}

interface LoaderData {
  roleUser: {
    roleId: number;
    roleName: string;
    userId: number;
  };
  users: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    trainingCardUserNumber: string;
    roleLevel: number;
  }>;
}

/**
 * RoleControl component:
 * - If the user's roleLevel is 1 or 2, show a dropdown (values: 1,2,3).
 * - If roleLevel is 3, show the dropdown and a button "Enable Level 4".
 * - If roleLevel is 4, display the number 4 (read-only) with a "Revoke Level 4" button.
 */
function RoleControl({ user }: { user: { id: number; roleLevel: number } }) {
  const [currentRole, setCurrentRole] = useState<number>(user.roleLevel);

  const updateRole = async (newRole: number) => {
    const formData = new FormData();
    formData.append("action", "updateUserRole");
    formData.append("userId", user.id.toString());
    formData.append("newRoleId", newRole.toString());
    await fetch("/dashboard/admin/users", {
      method: "POST",
      body: formData,
    });
    setCurrentRole(newRole);
    // Optionally, you can reload the page:
    // window.location.reload();
  };

  if (currentRole === 4) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-semibold">4</span>
        <ConfirmButton
          confirmTitle="Confirm Revoke Level 4"
          confirmDescription="Are you sure you want to revoke Level 4? The user will revert to Level 3."
          onConfirm={() => updateRole(3)}
          buttonLabel="Revoke Level 4"
          buttonClassName="bg-red-500 hover:bg-red-600 text-white"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        defaultValue={String(currentRole)}
        onValueChange={(value) => {
          const newVal = Number(value);
          setCurrentRole(newVal);
          updateRole(newVal);
        }}
      >
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1</SelectItem>
          <SelectItem value="2">2</SelectItem>
          <SelectItem value="3">3</SelectItem>
        </SelectContent>
      </Select>
      {currentRole === 3 && (
        <ConfirmButton
          confirmTitle="Confirm Enable Level 4"
          confirmDescription="Are you sure you want to upgrade this user to Level 4?"
          onConfirm={() => updateRole(4)}
          buttonLabel="Enable Level 4"
          buttonClassName="bg-green-500 hover:bg-green-600 text-white"
        />
      )}
    </div>
  );
}

export default function AllUsersRegistered() {
  const { roleUser, users } = useLoaderData<LoaderData>();

  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";

  // Search state to filter by first or last name.
  const [searchName, setSearchName] = useState("");

  // Filter users by first and last name.
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return searchName === "" || fullName.includes(searchName.toLowerCase());
    });
  }, [users, searchName]);

  // Sort filtered users by user.id in ascending order.
  const sortedFilteredUsers = useMemo(() => {
    return filteredUsers.slice().sort((a, b) => a.id - b.id);
  }, [filteredUsers]);

  // Define columns for the ShadTable.
  type UserRow = LoaderData["users"][number];
  const columns: ColumnDefinition<UserRow>[] = [
    { header: "First Name", render: (user) => user.firstName },
    { header: "Last Name", render: (user) => user.lastName },
    { header: "Email", render: (user) => user.email },
    { header: "Phone Number", render: (user) => user.phone },
    {
      header: "Training Card User Number",
      render: (user) => user.trainingCardUserNumber,
    },
    { header: "Role Level Id", render: (user) => <RoleControl user={user} /> },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <h1 className="text-2xl font-bold mb-4">All Users Registered</h1>
          <div className="flex items-center gap-2 mb-6">
            <FiSearch className="text-gray-500" />
            <Input
              placeholder="Search by first or last name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full md:w-64"
            />
          </div>
          <ShadTable
            columns={columns}
            data={sortedFilteredUsers}
            emptyMessage="No users found"
          />
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
