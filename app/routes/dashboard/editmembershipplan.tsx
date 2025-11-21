import React, { useState } from "react";
import { redirect, useActionData, useLoaderData, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { membershipPlanFormSchema } from "../../schemas/membershipPlanFormSchema";
import type { MembershipPlanFormValues } from "../../schemas/membershipPlanFormSchema";
import { updateMembershipPlan, getMembershipPlan } from "~/models/membership.server";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";
import MembershipPlanForm from "~/components/ui/Dashboard/MembershipPlanForm";

export async function loader({ params, request }: { params: { planId: string }; request: Request }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`Unauthorized access attempt to edit membership plan page`, {
      userId: roleUser?.userId ?? "unknown",
      role: roleUser?.roleName ?? "none",
      url: request.url,
    });
    return redirect("/dashboard/user");
  }
  const membershipPlan = await getMembershipPlan(Number(params.planId));
  if (!membershipPlan) {
    throw new Response("Not Found", { status: 404 });
  }
  const featuresArray = membershipPlan.feature ? Object.values(membershipPlan.feature) : [];
  return { roleUser, membershipPlan: { ...membershipPlan, feature: featuresArray } };
}

export async function action({ request, params }: { request: Request; params: { planId: string } }) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }

  const formData = await request.formData();
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());
  if (rawValues.price) rawValues.price = parseInt(rawValues.price);

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

  const featuresArray = formData.getAll("features") as string[];
  rawValues.features = featuresArray;
  rawValues.needAdminPermission = rawValues.needAdminPermission === "true";

  const parsed = membershipPlanFormSchema.safeParse(rawValues);
  if (!parsed.success) {
    const errors = parsed.error.flatten();
    return { errors: errors.fieldErrors };
  }

  const featuresJson = featuresArray.reduce((acc, feature, index) => {
    acc[`Feature${index + 1}`] = feature;
    return acc;
  }, {} as Record<string, string>);

  try {
    await updateMembershipPlan(Number(params.planId), {
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      price3Months: parsed.data.price3Months ?? null,
      price6Months: parsed.data.price6Months ?? null,
      priceYearly: parsed.data.priceYearly ?? null,
      features: featuresJson,
      needAdminPermission: (rawValues.needAdminPermission as boolean) ?? false,
    });
    logger.info(`Membership plan ${rawValues.title} updated successfully`, { url: request.url });
  } catch (error) {
    logger.error(`Failed to edit membership plan: ${error}`, { url: request.url });
    return { errors: { database: ["Failed to update membership plan"] } };
  }

  return redirect("/dashboard/memberships");
}

export default function EditMembershipPlan() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { roleUser, membershipPlan } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  const form = useForm<MembershipPlanFormValues>({
    resolver: zodResolver(membershipPlanFormSchema),
    defaultValues: {
      title: membershipPlan.title,
      description: membershipPlan.description,
      price: membershipPlan.price,
      price3Months: membershipPlan.price3Months ?? null,
      price6Months: membershipPlan.price6Months ?? null,
      priceYearly: membershipPlan.priceYearly ?? null,
      features: (membershipPlan.feature as any) || [],
    },
  });

  const hasErrors = actionData?.errors && Object.keys(actionData.errors).length > 0;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow overflow-auto">
          <div className="max-w-4xl mx-auto p-8 w-full">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Edit Membership</h1>
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
            <h1 className="text-2xl font-bold mb-8 text-center">Edit Membership Plan</h1>

            {hasErrors && (
              <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
                There are some errors in your form. Please review the highlighted fields below.
              </div>
            )}

            <MembershipPlanForm
              mode="edit"
              form={form}
              defaultValues={{
                title: membershipPlan.title,
                description: membershipPlan.description,
                price: membershipPlan.price,
                price3Months: membershipPlan.price3Months ?? null,
                price6Months: membershipPlan.price6Months ?? null,
                priceYearly: membershipPlan.priceYearly ?? null,
                features: (membershipPlan.feature as any) || [],
                needAdminPermission: Boolean(membershipPlan.needAdminPermission),
              }}
              submitLabel="Confirm"
              initialShowMultipleBilling={Boolean(
                membershipPlan.price3Months || membershipPlan.price6Months || membershipPlan.priceYearly
              )}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}


