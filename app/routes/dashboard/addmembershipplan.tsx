import React, { useState } from "react";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { membershipPlanFormSchema } from "../../schemas/membershipPlanFormSchema";
import type { MembershipPlanFormValues } from "../../schemas/membershipPlanFormSchema";
import { addMembershipPlan } from "~/models/membership.server";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";
import MembershipPlanForm from "~/components/ui/Dashboard/MembershipPlanForm";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to add membership plan page`, {
      userId: roleUser?.userId ?? "unknown",
      role: roleUser?.roleName ?? "none",
      url: request.url,
    });
    return redirect("/dashboard/user");
  }
  return { roleUser };
}

export async function action({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }

  const formData = await request.formData();
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  if (rawValues.price) {
    rawValues.price = parseInt(rawValues.price);
  }

  if (rawValues.price3Months) {
    rawValues.price3Months =
      rawValues.price3Months === "" ? null : parseInt(rawValues.price3Months);
  } else {
    rawValues.price3Months = null;
  }

  if (rawValues.price6Months) {
    rawValues.price6Months =
      rawValues.price6Months === "" ? null : parseInt(rawValues.price6Months);
  } else {
    rawValues.price6Months = null;
  }

  if (rawValues.priceYearly) {
    rawValues.priceYearly =
      rawValues.priceYearly === "" ? null : parseInt(rawValues.priceYearly);
  } else {
    rawValues.priceYearly = null;
  }

  rawValues.needAdminPermission = rawValues.needAdminPermission === "true";

  rawValues.features = formData.getAll("features") as string[];

  const parsed = membershipPlanFormSchema.safeParse(rawValues);

  if (!parsed.success) {
    const errors = parsed.error.flatten();
    return { errors: errors.fieldErrors };
  }

  try {
    await addMembershipPlan({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      price3Months: parsed.data.price3Months ?? null,
      price6Months: parsed.data.price6Months ?? null,
      priceYearly: parsed.data.priceYearly ?? null,
      features: parsed.data.features,
      needAdminPermission: rawValues.needAdminPermission,
    });
    logger.info(`Membership plan ${parsed.data.title} added successfully`, {
      url: request.url,
    });
  } catch (error) {
    logger.error(`Failed to add membership plan: ${error}`, {
      url: request.url,
    });
    return { errors: { database: ["Failed to add membership plan"] } };
  }

  return redirect("/dashboard/memberships");
}

export default function AddMembershipPlan() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { roleUser } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  const form = useForm<MembershipPlanFormValues>({
    resolver: zodResolver(membershipPlanFormSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      price3Months: null,
      price6Months: null,
      priceYearly: null,
      features: [],
      needAdminPermission: false,
    },
  });

  // Restore values on server errors and surface to RHF
  React.useEffect(() => {
    if (actionData?.errors) {
      const saved = sessionStorage.getItem("addMembershipPlanFormValues");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          form.reset(parsed);
        } catch {}
      }
      Object.entries(actionData.errors).forEach(([key, value]) => {
        const message = Array.isArray(value) ? value[0] : value;
        if (message) {
          form.setError(
            key as any,
            { type: "server", message: String(message) } as any
          );
        }
      });
    }
  }, [actionData, form]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Save current form values to sessionStorage before submission
    sessionStorage.setItem(
      "addMembershipPlanFormValues",
      JSON.stringify(form.getValues())
    );
    // Submit the form
    event.currentTarget.submit();
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-8 w-full">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Add Membership</h1>
            </div>

            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/memberships")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Memberships
              </Button>
            </div>
            <h1 className="text-2xl font-bold mb-8 text-center">
              Add Membership Plan
            </h1>

            {hasErrors && (
              <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
                There are some errors in your form. Please review the
                highlighted fields below.
              </div>
            )}

            <MembershipPlanForm
              mode="create"
              form={form}
              defaultValues={{
                title: "",
                description: "",
                price: 0,
                price3Months: null,
                price6Months: null,
                priceYearly: null,
                features: [],
                needAdminPermission: false,
              }}
              submitLabel="Submit"
              initialShowMultipleBilling={false}
              onSubmit={handleFormSubmit}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
