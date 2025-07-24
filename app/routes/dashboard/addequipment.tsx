import { redirect, useActionData, useLoaderData } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { equipmentFormSchema } from "../../schemas/equipmentFormSchema";
import type { EquipmentFormValues } from "../../schemas/equipmentFormSchema";
import { addEquipment, getEquipmentByName } from "~/models/equipment.server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";
import { getWorkshops } from "~/models/workshop.server";
import MultiSelectField from "~/components/ui/Dashboard/MultiSelectField";
import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/AdminSidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export async function loader({ request }: { request: Request }) {
  const workshops = await getWorkshops();
  const roleUser = await getRoleUser(request);

  return { workshops, roleUser };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const price = parseFloat(rawValues.price as string);

  const workshopPrerequisitesString = rawValues.workshopPrerequisites as string;
  const workshopPrerequisites = workshopPrerequisitesString
    ? workshopPrerequisitesString.split(",").map(Number)
    : [];

  // Validate data
  const parsed = equipmentFormSchema.safeParse({
    ...rawValues,
    price,
    workshopPrerequisites,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(`[User: ${roleUser?.userId}] Not authorized to add equipment`, {
      url: request.url,
    });
    throw new Response("Not Authorized", { status: 401 });
  }

  // Check if equipment name already exists
  const existingEquipment = await getEquipmentByName(parsed.data.name);
  if (existingEquipment) {
    logger.warn(
      `[User: ${roleUser?.userId}] Equipment with this name already exists`,
      { url: request.url }
    );
    throw new Response("Equipment with this name already exists", {
      status: 409,
    });
  }

  try {
    // Send only required fields to addEquipment
    await addEquipment({
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      availability: parsed.data.availability === "true" ? true : false,
      workshopPrerequisites: parsed.data.workshopPrerequisites || [],
    });

    logger.info(
      `[User: ${roleUser?.userId}] New Equipment ${parsed.data.name} added successfully`,
      { url: request.url }
    );

    return redirect("/dashboard/equipments");
  } catch (error: any) {
    logger.error(`Error adding new equipment ${error}`, { url: request.url });

    if (error.code === "P2002") {
      return { errors: { name: ["Equipment name must be unique."] } };
    }

    return { errors: { database: ["Failed to add equipment"] } };
  }
}

export default function AddEquipment() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { workshops, roleUser } = useLoaderData<typeof loader>();
  const [selectedWorkshopPrerequisites, setSelectedWorkshopPrerequisites] =
    useState<number[]>([]);

  const navigate = useNavigate();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      availability: "true",
      workshopPrerequisites: [],
    },
  });

  const handleWorkshopPrerequisiteSelect = (workshopId: number) => {
    let updated: number[];
    if (selectedWorkshopPrerequisites.includes(workshopId)) {
      updated = selectedWorkshopPrerequisites.filter((id) => id !== workshopId);
    } else {
      updated = [...selectedWorkshopPrerequisites, workshopId];
    }
    updated.sort((a, b) => a - b);
    setSelectedWorkshopPrerequisites(updated);
    form.setValue("workshopPrerequisites", updated);
  };

  const removeWorkshopPrerequisite = (workshopId: number) => {
    const updated = selectedWorkshopPrerequisites.filter(
      (id) => id !== workshopId
    );
    setSelectedWorkshopPrerequisites(updated);
    form.setValue("workshopPrerequisites", updated);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <div className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-lg">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard/equipments")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Equipments
              </Button>
            </div>

            <h1 className="text-2xl font-bold mb-6 text-gray-900 text-center">
              Add Equipment
            </h1>

            {actionData?.errors &&
              Object.keys(actionData.errors).length > 0 && (
                <div className="mb-6 text-sm text-red-500 bg-red-100 border border-red-400 rounded p-2">
                  There are some errors in your form. Please review the
                  highlighted fields below.
                </div>
              )}

            <Form {...form}>
              <form method="post" className="space-y-6">
                {/* Name & Price */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="name">
                          Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="name"
                            placeholder="Enter equipment name"
                            {...field}
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="price">
                          Price <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="price"
                            type="number"
                            placeholder="Enter price"
                            {...field}
                            step="0.01"
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="description">
                        Description <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="description"
                          placeholder="Enter equipment description"
                          {...field}
                          rows={4}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Availability */}
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-1/2">
                      <FormLabel
                        htmlFor="availability"
                        className="flex items-center gap-1"
                      >
                        Availability <span className="text-red-500">*</span>
                      </FormLabel>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-sm text-muted-foreground cursor-help underline underline-offset-2">
                              What does this mean?
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            This equipment is available 24/7 for users unless
                            the admin sets it to unavailable.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          name={field.name}
                        >
                          <SelectTrigger id="availability" className="w-full">
                            <SelectValue placeholder="Select availability" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Available</SelectItem>
                            <SelectItem value="false">Unavailable</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <MultiSelectField
                  control={form.control}
                  name="workshopPrerequisites"
                  label="Workshop Prerequisites"
                  options={workshops}
                  selectedItems={selectedWorkshopPrerequisites}
                  onSelect={handleWorkshopPrerequisiteSelect}
                  onRemove={removeWorkshopPrerequisite}
                  error={actionData?.errors?.workshopPrerequisites}
                  placeholder="Select workshop prerequisites..."
                  helperText="Select workshops of type Orientation that must be completed before using this equipment."
                  filterFn={(item) => item.type.toLowerCase() === "orientation"}
                />

                {/* Hidden input for form submission */}
                <input
                  type="hidden"
                  name="workshopPrerequisites"
                  value={selectedWorkshopPrerequisites.join(",")}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="mt-6 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-green-600 transition"
                >
                  Add Equipment
                </Button>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
