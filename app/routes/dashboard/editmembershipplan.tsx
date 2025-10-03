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

export async function loader({ params, request }: { params: { planId: string }; request: Request }) {
  const roleUser = await getRoleUser(request);
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

  const featuresArray = formData.getAll("features") as string[];
  rawValues.features = featuresArray;

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
      title: rawValues.title,
      description: rawValues.description,
      price: rawValues.price,
      features: featuresJson,
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
      features: membershipPlan.feature || [],
    },
  });

  const [features, setFeatures] = useState<string[]>([""]);
  React.useEffect(() => {
    setFeatures(form.getValues("features") || []);
  }, [membershipPlan]);

  const addFeatureField = () => setFeatures([...features, ""]);
  const removeLastFeatureField = () => {
    if (features.length > 1) setFeatures(features.slice(0, -1));
  };
  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...features];
    updated[index] = value;
    setFeatures(updated);
  };

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

            <Form {...form}>
              <form method="post">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Title <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Membership Title" {...field} className="w-full lg:w-[500px]" />
                      </FormControl>
                      <FormMessage>{actionData?.errors?.title}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Description <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea placeholder="Membership Description" {...field} className="w-full" rows={5} />
                      </FormControl>
                      <FormMessage>{actionData?.errors?.description}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Price <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Price" {...field} step="0.01" className="w-full" />
                      </FormControl>
                      <FormMessage>{actionData?.errors?.price}</FormMessage>
                    </FormItem>
                  )}
                />

                {features.map((feature, index) => (
                  <FormField
                    control={form.control}
                    name="features"
                    key={index}
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Feature {index + 1} <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="mb-4">
                            <Textarea
                              name="features"
                              value={feature}
                              onChange={(e) => handleFeatureChange(index, e.target.value)}
                              placeholder="Enter feature"
                              className="w-full"
                              rows={5}
                            />
                          </div>
                        </FormControl>
                        <FormMessage>{actionData?.errors?.features}</FormMessage>
                      </FormItem>
                    )}
                  />
                ))}

                <div className="flex items-center gap-2">
                  <Button type="button" onClick={addFeatureField} className="mt-4 items-center bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 transition">
                    +
                  </Button>
                  <Button type="button" onClick={removeLastFeatureField} className="mt-4 items-center bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 transition" disabled={features.length <= 1}>
                    -
                  </Button>
                </div>

                <Button type="submit" className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 transition">
                  Confirm
                </Button>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}


