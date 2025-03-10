import { useLoaderData, redirect } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import AppSidebar from "@/components/ui/Dashboard/sidebar";
import WorkshopList from "@/components/ui/Dashboard/workshoplist";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminAppSidebar from "@/components/ui/Dashboard/adminsidebar";

export async function loader({ request }: { request: Request }) {
    const roleUser = await getRoleUser(request);
    if (!roleUser || !roleUser.userId) {
        return redirect("/login");
    }
    return { roleUser };
}

export default function UserWorkshop() {
    const { roleUser } = useLoaderData<typeof loader>();

    const isAdmin =
        roleUser &&
        roleUser.roleId === 2 &&
        roleUser.roleName.toLowerCase() === "admin";

    return (
        <SidebarProvider>
          <div className="flex h-screen">
            {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
            <p>hello</p>
            
          </div>
        </SidebarProvider>
    );
    

    
}