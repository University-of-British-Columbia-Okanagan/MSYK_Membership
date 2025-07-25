import { useState, useMemo } from "react";
import { Outlet, redirect, useLoaderData } from "react-router";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getRoleUser } from "~/utils/session.server";
import {
  getAllUsers,
  updateUserRole,
  updateUserAllowLevel,
} from "~/models/user.server";
import {
  ShadTable,
  type ColumnDefinition,
} from "~/components/ui/Dashboard/ShadTable";
import { FiSearch } from "react-icons/fi";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "~/components/ui/Dashboard/ConfirmButton";
import { logger } from "~/logging/logger";

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
    allowLevel4: boolean;
  }>;
}

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);

  // Only admins can access this page
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to admin users page`, {
      url: request.url,
    });
    return redirect("/dashboard/user");
  }

  const users = await getAllUsers();

  logger.info(
    `Admin [User: ${roleUser.userId}] accessed the users management page`,
    {
      url: request.url,
    }
  );

  return { roleUser, users };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const actionType = formData.get("action");
  const roleUser = await getRoleUser(request);

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn("Unauthorized attempt to modify users", {
      url: request.url,
    });
    throw new Response("Not Authorized", { status: 419 });
  }

  if (actionType === "updateUserRole") {
    const userId = formData.get("userId");
    const newRoleId = formData.get("newRoleId");
    try {
      await updateUserRole(Number(userId), String(newRoleId));
      logger.info(
        `Admin [User: ${roleUser.userId}] updated role for User [${userId}] to Role [${newRoleId}]`,
        {
          url: request.url,
        }
      );
      return redirect("/dashboard/admin/users");
    } catch (error) {
      logger.error("Failed to update user role", {
        url: request.url,
      });
      return { error: "Failed to update user role" };
    }
  }

  if (actionType === "updateAllowLevel4") {
    const userId = formData.get("userId");
    const allowLevel4 = formData.get("allowLevel4");
    try {
      await updateUserAllowLevel(Number(userId), allowLevel4 === "true");
      logger.info(
        `Admin [User: ${roleUser.userId}] set allowLevel4=${allowLevel4} for User [${userId}]`,
        {
          url: request.url,
        }
      );
      return redirect("/dashboard/admin/users");
    } catch (error) {
      logger.error("Failed to update allowLevel4", {
        url: request.url,
      });
      return { error: "Failed to update allowLevel4" };
    }
  }

  return null;
}

/**
 * RoleControl component:
 * - Displays the user's current role level (read-only).
 * - If the user's roleLevel is 3, it shows a button:
 *    - "Allow Level 4" if allowLevel4 is false.
 *    - "Revoke Level 4" if allowLevel4 is true.
 * The ConfirmButton calls the updateAllowLevel4 action which now updates both allowLevel4 and roleLevel.
 */
function RoleControl({
  user,
}: {
  user: { id: number; roleLevel: number; allowLevel4: boolean };
}) {
  const [allowLevel4, setAllowLevel4] = useState<boolean>(user.allowLevel4);

  const updateAllow = async (newAllow: boolean) => {
    const formData = new FormData();
    formData.append("action", "updateAllowLevel4");
    formData.append("userId", user.id.toString());
    formData.append("allowLevel4", newAllow.toString());
    await fetch("/dashboard/admin/users", { method: "POST", body: formData });
    setAllowLevel4(newAllow);
    window.location.reload(); // Refresh the page to reflect changes
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{user.roleLevel}</span>
      {allowLevel4 ? (
        <ConfirmButton
          confirmTitle="Confirm Revoke Level 4"
          confirmDescription="Are you sure you want to revoke Level 4 for this user? This will remove the extra privileges."
          onConfirm={() => updateAllow(false)}
          buttonLabel="Revoke Level 4"
          buttonClassName="bg-red-500 hover:bg-red-600 text-white"
        />
      ) : (
        user.roleLevel === 3 && (
          <ConfirmButton
            confirmTitle="Confirm Enable Level 4"
            confirmDescription="Are you sure you want to enable Level 4 for this user? This will grant extra privileges."
            onConfirm={() => updateAllow(true)}
            buttonLabel="Allow Level 4"
            buttonClassName="bg-green-500 hover:bg-green-600 text-white"
          />
        )
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
    { header: "Role Level", render: (user) => <RoleControl user={user} /> },
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
