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
import {
  updateEquipment,
  getEquipmentById,
  getEquipmentByName,
} from "~/models/equipment.server";
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
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/adminsidebar";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import * as fs from "fs";
import * as path from "path";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const workshops = await getWorkshops();
  const roleUser = await getRoleUser(request);
  const equipment = await getEquipmentById(parseInt(params.id));

  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    logger.warn(
      `[User: ${roleUser?.userId ?? "unknown"}] Not authorized to edit equipment`,
      { url: request.url }
    );
    throw new Response("Access Denied", { status: 403 });
  }

  if (!equipment) {
    logger.warn(
      `Equipment ${parseInt(params.id)} not found and was tried to be updated.`,
      { url: request.url }
    );
    throw new Response("Equipment not found", { status: 404 });
  }

  return { workshops, roleUser, equipment };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const formData = await request.formData();
  const rawValues = Object.fromEntries(formData.entries());

  const equipmentId = parseInt(params.id);
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
    logger.warn(
      `[User: ${roleUser?.userId ?? "unknown"}] Not authorized to edit equipment`,
      { url: request.url }
    );
    throw new Response("Not Authorized", { status: 401 });
  }

  // Handle image upload
  let imageUrl: string | null = null;
  const equipmentImage = formData.get("equipmentImage");
  const removeImage = formData.get("removeImage") === "true";

  // Handle image removal
  if (removeImage) {
    // Get the current equipment to check for existing image
    const currentEquipment = await getEquipmentById(equipmentId);

    // Delete old image if it exists in images_custom folder
    if (
      currentEquipment.imageUrl &&
      currentEquipment.imageUrl.startsWith("/images_custom/")
    ) {
      try {
        const oldImagePath = path.join(
          process.cwd(),
          "public",
          currentEquipment.imageUrl
        );
        // Check if file exists before trying to delete
        if (fs.existsSync(oldImagePath)) {
          await fs.promises.unlink(oldImagePath);
          logger.info(
            `[User: ${roleUser.userId}] Deleted equipment image: ${currentEquipment.imageUrl}`,
            { url: request.url }
          );
        }
      } catch (error) {
        logger.warn(
          `[User: ${roleUser.userId}] Could not delete equipment image: ${error}`,
          { url: request.url }
        );
      }
    }

    // Set imageUrl to empty string to remove it from database
    imageUrl = "";
  }

  if (
    equipmentImage &&
    equipmentImage instanceof File &&
    equipmentImage.size > 0
  ) {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(equipmentImage.type)) {
      return {
        errors: {
          equipmentImage: [
            "Invalid file type. Please upload JPG, JPEG, PNG, GIF, or WEBP.",
          ],
        },
      };
    }

    if (equipmentImage.size > maxSize) {
      return {
        errors: {
          equipmentImage: ["File size exceeds 5MB limit."],
        },
      };
    }

    // Get the current equipment to check for existing image
    const currentEquipment = await getEquipmentById(equipmentId);

    // Delete old image if it exists in images_custom folder
    if (
      currentEquipment.imageUrl &&
      currentEquipment.imageUrl.startsWith("/images_custom/")
    ) {
      try {
        const oldImagePath = path.join(
          process.cwd(),
          "public",
          currentEquipment.imageUrl
        );
        // Check if file exists before trying to delete
        if (fs.existsSync(oldImagePath)) {
          await fs.promises.unlink(oldImagePath);
          logger.info(
            `[User: ${roleUser.userId}] Deleted old equipment image: ${currentEquipment.imageUrl}`,
            { url: request.url }
          );
        }
      } catch (error) {
        logger.warn(
          `[User: ${roleUser.userId}] Could not delete old equipment image: ${error}`,
          { url: request.url }
        );
        // Don't fail the upload if we can't delete the old image
      }
    }

    // Save new file to public/images_custom folder
    try {
      const buffer = Buffer.from(await equipmentImage.arrayBuffer());
      const filename = `equipment-${Date.now()}-${equipmentImage.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const imagesCustomDir = path.join(
        process.cwd(),
        "public",
        "images_custom"
      );
      const filepath = path.join(imagesCustomDir, filename);

      // Create the images_custom directory if it doesn't exist
      await fs.promises.mkdir(imagesCustomDir, { recursive: true });
      await fs.promises.writeFile(filepath, buffer);

      imageUrl = `/images_custom/${filename}`;

      logger.info(
        `[User: ${roleUser.userId}] Uploaded new equipment image: ${imageUrl}`,
        { url: request.url }
      );
    } catch (error) {
      logger.error(`[Edit equipment] Error saving image: ${error}`, {
        url: request.url,
      });
      return {
        errors: {
          equipmentImage: ["Failed to upload image. Please try again."],
        },
      };
    }
  }

  // Check if equipment name already exists (excluding current equipment)
  const existingEquipment = await getEquipmentByName(parsed.data.name);
  if (existingEquipment && existingEquipment.id !== equipmentId) {
    logger.warn(
      `[User: ${roleUser?.userId}] Equipment with this name already exists`,
      { url: request.url }
    );
    return {
      errors: { name: ["Equipment with this name already exists."] },
    };
  }

  try {
    await updateEquipment(equipmentId, {
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      availability: parsed.data.availability === "true" ? true : false,
      workshopPrerequisites: parsed.data.workshopPrerequisites || [],
      ...(imageUrl !== null && { imageUrl: imageUrl === "" ? null : imageUrl }),
    });

    logger.info(
      `[User: ${roleUser?.userId}] Equipment ${parsed.data.name} updated successfully`,
      { url: request.url }
    );

    return redirect("/dashboard/equipments");
  } catch (error: any) {
    logger.error(`Error updating equipment ${error}`, { url: request.url });

    if (error.code === "P2002") {
      return { errors: { name: ["Equipment name must be unique."] } };
    }

    return { errors: { database: ["Failed to update equipment"] } };
  }
}

export default function EditEquipment() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const { workshops, roleUser, equipment } = useLoaderData<typeof loader>();
  const [selectedWorkshopPrerequisites, setSelectedWorkshopPrerequisites] =
    useState<number[]>(equipment.prerequisites || []);
  const [equipmentImageFile, setEquipmentImageFile] = useState<File | null>(
    null
  );
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(
    equipment.imageUrl || null
  );
  const [removeImageFlag, setRemoveImageFlag] = useState(false);

  const navigate = useNavigate();

  const isAdmin = roleUser?.roleName.toLowerCase() === "admin";

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: equipment.name || "",
      description: equipment.description || "",
      price: equipment.price || 0,
      availability: equipment.availability ? "true" : "false",
      workshopPrerequisites: equipment.prerequisites || [],
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
      <div className="absolute inset-0 flex">
        {isAdmin ? <AdminAppSidebar /> : <AppSidebar />}
        <main className="flex-grow p-6">
          <div className="max-w-4xl mx-auto p-8 bg-white shadow-md rounded-lg">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Edit Equipment</h1>
            </div>

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
              Edit Equipment
            </h1>

            {actionData?.errors &&
              Object.keys(actionData.errors).length > 0 && (
                <div className="mb-6 text-sm text-red-500 bg-red-100 border border-red-400 rounded p-2">
                  There are some errors in your form. Please review the
                  highlighted fields below.
                </div>
              )}

            <Form {...form}>
              <form
                method="post"
                encType="multipart/form-data"
                className="space-y-6"
              >
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

                {/* Equipment Image Upload */}
                <div className="mb-6">
                  <FormItem>
                    <FormLabel>Equipment Image</FormLabel>
                    {currentImageUrl && !removeImageFlag && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">
                          Current Image:
                        </p>
                        <div className="relative inline-block">
                          <img
                            src={currentImageUrl}
                            alt="Current equipment"
                            className="w-48 h-32 object-cover rounded-md border border-gray-300"
                          />
                          <Button
                            type="button"
                            onClick={() => {
                              setRemoveImageFlag(true);
                              setCurrentImageUrl(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                    <FormControl>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEquipmentImageFile(file);
                            setRemoveImageFlag(false);
                            // Preview the new image
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCurrentImageUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        name="equipmentImage"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      Optional. Upload a new image to replace the current one or
                      add one if you have not uploaded one. Accepted formats:
                      JPG, JPEG, PNG, GIF, WEBP (Max 5MB)
                    </p>
                    {actionData?.errors?.equipmentImage && (
                      <p className="text-sm text-red-500 mt-1">
                        {actionData.errors.equipmentImage}
                      </p>
                    )}
                  </FormItem>
                  {/* Hidden input to track image removal */}
                  <input
                    type="hidden"
                    name="removeImage"
                    value={removeImageFlag ? "true" : "false"}
                  />
                </div>

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
                  filterFn={(item) =>
                    item.type.toLowerCase() === "orientation" &&
                    Array.isArray(item.occurrences) &&
                    item.occurrences.some((o) => o.status === "active")
                  }
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
                  className="mt-6 w-full bg-indigo-500 text-white px-4 py-2 rounded-md shadow hover:bg-indigo-600 transition"
                >
                  Update Equipment
                </Button>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
