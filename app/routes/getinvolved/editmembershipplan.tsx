import { PrismaClient, Prisma } from "@prisma/client";
import React, { useState, useRef } from "react";
import {
  type ActionFunctionArgs,
  redirect,
  useNavigation,
  useActionData,
} from "react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "./+types/addmembershipplan";
import { membershipPlanFormSchema } from "../../schemas/membershipPlanFormSchema";
import type { MembershipPlanFormValues } from "../../schemas/membershipPlanFormSchema";
import {
  updateMembershipPlan,
  getMembershipPlan,
} from "~/models/membership.server";
import { useLoaderData } from "react-router";
import { getRoleUser } from "~/utils/session.server";
import { logger } from "~/logging/logger";

export async function loader({ params }: { params: { planId: string } }) {
  const membershipPlan = await getMembershipPlan(Number(params.planId));
  //   logger.log(membershipPlan);

  if (!membershipPlan) {
    throw new Response("Not Found", { status: 404 });
  }

  // Convert feature object to an array of values
  const featuresArray = membershipPlan.feature
    ? Object.values(membershipPlan.feature)
    : [];

  return {
    ...membershipPlan,
    feature: featuresArray, // Replace the feature object with an array
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { planId: string };
}) {
  const roleUser = await getRoleUser(request);
  if (!roleUser || roleUser.roleName.toLowerCase() !== "admin") {
    throw new Response("Not Authorized", { status: 419 });
  }

  const formData = await request.formData();
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  if (rawValues.price) {
    rawValues.price = parseInt(rawValues.price); // Convert to a number
  }

  // Convert features into an array of strings
  const featuresArray = formData.getAll("features") as string[];
  rawValues.features = featuresArray;

  const parsed = membershipPlanFormSchema.safeParse(rawValues);

  if (!parsed.success) {
    // If validation fails, return errors
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
    logger.info(`Membership plan ${rawValues.title} updated successfully`, {url: request.url,});

  } catch (error) {
    logger.error(`Failed to edit membership plan: ${error}`, {url: request.url,});
    return { errors: { database: ["Failed to update membership plan"] } };
  }

  return redirect("/membership");
}

export default function AddMembershipPlan() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>();
  const membershipPlan = useLoaderData<typeof loader>();

  const form = useForm<MembershipPlanFormValues>({
    resolver: zodResolver(membershipPlanFormSchema),
    defaultValues: {
      title: membershipPlan.title,
      description: membershipPlan.description,
      price: membershipPlan.price,
      features: membershipPlan.feature || [],
    },
  });

  const [features, setFeatures] = useState<string[]>([""]); // Initialize with one empty feature input

  //   const [featureCount, setFeatureCount] = useState(1);

  //   const addFeatureField = () => {conso
  //     setFeatures([...features, ""]);
  //     setFeatureCount(featureCount + 1);
  //   };

  React.useEffect(() => {
    setFeatures(form.getValues("features") || []);
  }, [membershipPlan]);

  const addFeatureField = () => setFeatures([...features, ""]);

  const removeLastFeatureField = () => {
    if (features.length > 1) {
      setFeatures(features.slice(0, -1)); // Remove the last feature input
    }
  };

  const handleFeatureChange = (index: number, value: string) => {
    const updatedFeatures = [...features];
    updatedFeatures[index] = value; // Update the feature at the given index
    setFeatures(updatedFeatures);
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">
        Edit Membership Plan
      </h1>

      {/* Only show the error message if there are errors */}
      {hasErrors && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form method="post">
          {/* Title */}
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
          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description <span className="text-red-500">*</span>
                  {/* Description <span className="text-red-500">*</span> */}
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Membership Description"
                    {...field}
                    className="w-full"
                    rows={5}
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.description}</FormMessage>
              </FormItem>
            )}
          />
          {/* Price */}
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Price <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Price"
                    {...field}
                    step="0.01"
                    className="w-full"
                  />
                </FormControl>
                <FormMessage> {actionData?.errors?.price} </FormMessage>
              </FormItem>
            )}
          />
          {/* Features */}
          {features.map((feature, index) => (
            <FormField
              control={form.control}
              name="features"
              key={index}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Feature {index + 1}{" "} <span className="text-red-500">*</span>
                    {/* <span className="text-red-500">*</span> */}
                  </FormLabel>
                  <FormControl>
                    <div key={index} className="mb-4">
                      <Textarea
                        name="features"
                        value={feature}
                        onChange={(e) =>
                          handleFeatureChange(index, e.target.value)
                        }
                        placeholder="Enter feature"
                        // {...field}
                        className="w-full"
                        rows={5}
                      />
                    </div>
                  </FormControl>
                  <FormMessage> {actionData?.errors?.features} </FormMessage>
                </FormItem>
              )}
            />
          ))}

          <Button
            type="button"
            onClick={addFeatureField}
            className="mt-4 items-center bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition rounded-full"
          >
            +
          </Button>

          <Button
            type="button"
            onClick={removeLastFeatureField}
            className="mt-4 ml-2 items-center bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition rounded-full"
            disabled={features.length <= 1} // Disable when only one feature remains
          >
            -
          </Button>

          {/* Submit Button */}
          <Button
            type="submit"
            className="mt-4 w-full bg-yellow-500 text-white px-4 py-2 rounded-md shadow hover:bg-yellow-600 transition"
          >
            Confirm
          </Button>
        </form>
      </Form>
    </div>
  );
}
