import React, { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import type { MembershipPlanFormValues } from "~/schemas/membershipPlanFormSchema";

type Props = {
  mode: "create" | "edit";
  form: UseFormReturn<MembershipPlanFormValues>;
  defaultValues: MembershipPlanFormValues & { needAdminPermission?: boolean };
  submitLabel?: string;
  initialShowMultipleBilling?: boolean;
};

export default function MembershipPlanForm({
  mode,
  form,
  defaultValues,
  submitLabel = mode === "create" ? "Submit" : "Confirm",
  initialShowMultipleBilling = false,
}: Props) {
  const [features, setFeatures] = useState<string[]>(
    defaultValues.features || [""]
  );
  const [showMultipleBilling, setShowMultipleBilling] = useState<boolean>(
    initialShowMultipleBilling
  );
  const [needAdminPermission, setNeedAdminPermission] = useState<boolean>(
    Boolean((defaultValues as any).needAdminPermission)
  );

  useEffect(() => {
    setFeatures(
      defaultValues.features && defaultValues.features.length > 0
        ? defaultValues.features
        : [""]
    );
    setNeedAdminPermission(Boolean((defaultValues as any).needAdminPermission));
  }, [defaultValues]);

  useEffect(() => {
    setShowMultipleBilling(Boolean(initialShowMultipleBilling));
  }, [initialShowMultipleBilling]);

  const addFeatureField = () => setFeatures([...features, ""]);
  const removeLastFeatureField = () => {
    if (features.length > 1) setFeatures(features.slice(0, -1));
  };
  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...features];
    updated[index] = value;
    setFeatures(updated);
  };

  return (
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
              <FormMessage />
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
              <FormMessage />
            </FormItem>
          )}
        />

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
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 mt-4 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                Add Multiple Billing Options
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowMultipleBilling(!showMultipleBilling)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${showMultipleBilling ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showMultipleBilling ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          {showMultipleBilling && (
            <div className="space-y-4 pt-4 border-t border-gray-300">
              <FormField
                control={form.control}
                name="price3Months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
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
                      Leave empty if you don't want to offer quarterly billing
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price6Months"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
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
                      Leave empty if you don't want to offer semi-annual billing
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priceYearly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
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
                      Leave empty if you don't want to offer yearly billing
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        <div className="p-4 mt-4 mb-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <h3 className="text-sm font-medium text-gray-900">
                Require Admin Permission
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Enable this for memberships that require special approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNeedAdminPermission(!needAdminPermission)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${needAdminPermission ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${needAdminPermission ? "translate-x-6" : "translate-x-1"}`}
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
                  Feature {index + 1} <span className="text-red-500">*</span>
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
                <FormMessage />
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
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
