import React, { useState } from "react";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";
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
import { addMembershipPlan } from "~/models/membership.server";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";

export async function loader({ request }: { request: Request }) {
  const roleUser = await getRoleUser(request);
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
      rawValues.price3Months === ""
        ? null
        : parseInt(rawValues.price3Months);
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
      features: [],
    },
  });

  const [features, setFeatures] = useState<string[]>([""]);
  const [showMultipleBilling, setShowMultipleBilling] = useState(false);

  const [needAdminPermission, setNeedAdminPermission] = useState(false);

  const addFeatureField = () => setFeatures([...features, ""]);
  const removeLastFeatureField = () => {
    if (features.length > 1) setFeatures(features.slice(0, -1));
  };
  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...features];
    updated[index] = value;
    setFeatures(updated);
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
                        <Input
                          placeholder="Membership Title"
                          {...field}
                          className="w-full lg:w-[500px]"
                        />
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
                        <Textarea
                          placeholder="Membership Description"
                          {...field}
                          className="w-full"
                          rows={5}
                        />
                      </FormControl>
                      <FormMessage>
                        {actionData?.errors?.description}
                      </FormMessage>
                    </FormItem>
                  )}
                />

                {/* Monthly Price */}
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Monthly Price <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Multiple Billing Options Toggle */}
                <div className="space-y-4 mt-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        Add Multiple Billing Options
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setShowMultipleBilling(!showMultipleBilling)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        showMultipleBilling ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showMultipleBilling
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expanded Pricing Options */}
                  {showMultipleBilling && (
                    <div className="space-y-4 pt-4 border-t border-gray-300">
                      <FormField
                        control={form.control}
                        name="price3Months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="text-indigo-600">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M2.5 5A1.5 1.5 0 014 3.5h12A1.5 1.5 0 0117.5 5v2A1.5 1.5 0 0116 8.5H4A1.5 1.5 0 012.5 7V5z" />
                                  <path d="M4 10a1 1 0 00-1 1v4A2 2 0 005 17h10a2 2 0 002-2v-4a1 1 0 00-1-1H4z" />
                                </svg>
                              </span>
                              Quarterly Plan Price
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  CA$
                                </span>
                                <Input
                                  type="number"
                                  placeholder="Enter your quarterly price"
                                  className="pl-12"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === ""
                                        ? null
                                        : parseFloat(e.target.value)
                                    )
                                  }
                                />
                              </div>
                            </FormControl>
                            <p className="text-xs text-gray-500">
                              Leave empty if you don't want to offer quarterly
                              billing
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Semi-annual Price */}
                      <FormField
                        control={form.control}
                        name="price6Months"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="text-indigo-600">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                              Semi-annual Plan Price
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  CA$
                                </span>
                                <Input
                                  type="number"
                                  placeholder="Enter your semi-annual price"
                                  className="pl-12"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === ""
                                        ? null
                                        : parseFloat(e.target.value)
                                    )
                                  }
                                />
                              </div>
                            </FormControl>
                            <p className="text-xs text-gray-500">
                              Leave empty if you don't want to offer semi-annual
                              billing
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Yearly Price */}
                      <FormField
                        control={form.control}
                        name="priceYearly"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <span className="text-indigo-600">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                  <path
                                    fillRule="evenodd"
                                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                              Yearly Plan Price
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                  CA$
                                </span>
                                <Input
                                  type="number"
                                  placeholder="Enter your yearly price"
                                  className="pl-12"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === ""
                                        ? null
                                        : parseFloat(e.target.value)
                                    )
                                  }
                                />
                              </div>
                            </FormControl>
                            <p className="text-xs text-gray-500">
                              Leave empty if you don't want to offer yearly
                              billing
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Admin Permission Required Toggle */}
                <div className="p-4 mt-4 mb-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <h3 className="text-sm font-medium text-gray-900">
                        Require Admin Permission
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Enable this for memberships that require special
                        approval. Users must have an active membership,
                        completed orientation, and admin-granted permission to
                        subscribe.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNeedAdminPermission(!needAdminPermission)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        needAdminPermission ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          needAdminPermission
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {features.map((feature, index) => (
                  <FormField
                    control={form.control}
                    name="features"
                    key={index}
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Feature {index + 1}{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="mb-4">
                            <Textarea
                              name="features"
                              value={feature}
                              onChange={(e) =>
                                handleFeatureChange(index, e.target.value)
                              }
                              placeholder="Enter feature"
                              className="w-full"
                              rows={5}
                            />
                          </div>
                        </FormControl>
                        <FormMessage>
                          {actionData?.errors?.features}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                ))}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={addFeatureField}
                    className="mt-4 items-center bg-indigo-600 text-white px-4 py-2 rounded-full shadow hover:bg-indigo-700 transition"
                  >
                    +
                  </Button>
                  <Button
                    type="button"
                    onClick={removeLastFeatureField}
                    className="mt-4 items-center bg-indigo-600 text-white px-4 py-2 rounded-full shadow hover:bg-indigo-700 transition"
                    disabled={features.length <= 1}
                  >
                    -
                  </Button>
                </div>

                <input
                  type="hidden"
                  name="needAdminPermission"
                  value={needAdminPermission ? "true" : "false"}
                />

                <Button
                  type="submit"
                  className="mt-4 w-full bg-indigo-600 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-700 transition"
                >
                  Submit
                </Button>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
