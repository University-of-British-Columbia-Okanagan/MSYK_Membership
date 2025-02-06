import { PrismaClient, Prisma } from "@prisma/client";
import React, { useState, useRef } from "react";
import { type ActionFunctionArgs, redirect, useNavigation } from "react-router";
import { registerSchema } from "../../schemas/registrationSchema";
import type { RegisterFormValues } from "../../schemas/registrationSchema";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "./+types/register";
import { register } from "~/utils/session.server";

const prisma = new PrismaClient();

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  // Convert FormData to a plain object
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  // Convert boolean-like strings and checkbox values
  rawValues.over18 = rawValues.over18 === "true";
  rawValues.photoRelease = rawValues.photoRelease === "true";
  rawValues.dataPrivacy = rawValues.dataPrivacy === "on";

  // Parse trainingCardUserNumber as a number
  rawValues.trainingCardUserNumber = rawValues.trainingCardUserNumber
    ? parseInt(rawValues.trainingCardUserNumber, 10)
    : null;

  // Handle file field for guardianSignedConsent
  const guardianSignedConsent = formData.get("guardianSignedConsent");
  if (guardianSignedConsent instanceof File && guardianSignedConsent.size > 0) {
    rawValues.guardianSignedConsent = guardianSignedConsent; // Pass the file directly
  } else {
    rawValues.guardianSignedConsent = null;
  }

  // Add parent guardian fields only if they are missing
  if (rawValues.over18) {
    rawValues.parentGuardianName = rawValues.parentGuardianName || null;
    rawValues.parentGuardianPhone = rawValues.parentGuardianPhone || null;
    rawValues.parentGuardianEmail = rawValues.parentGuardianEmail || null;
    rawValues.guardianSignedConsent = rawValues.guardianSignedConsent || null;
  }

  const result = await register(rawValues);

  if (!result) {
    return { errors: { database: "Failed to register. Please try again." } };
  }

  if ("errors" in result) {
    return { errors: result.errors };
  }

  return { success: true, user: result };

}

interface FormErrors {
  firstName?: string[];
  lastName?: string[];
  email?: string[];
  password?: string[];
  phone?: string[];
  address?: string[];
  over18?: boolean[];
  parentGuardianName?: string[];
  parentGuardianPhone?: string[];
  parentGuardianEmail?: string[];
  guardianSignedConsent?: any[];
  photoRelease?: boolean[];
  dataPrivacy?: boolean[];
  emergencyContactName?: string[];
  emergencyContactPhone?: string[];
  emergencyContactEmail?: string[];
  trainingCardUserNumber?: number[];
}

interface ActionData {
  errors?: FormErrors;
  success?: boolean;
}

export default function Register({ actionData }: { actionData?: ActionData }) {
  // { actionData }: Route.ComponentProps
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      over18: false,
      parentGuardianName: null,
      parentGuardianPhone: null,
      parentGuardianEmail: null,
      guardianSignedConsent: null,
      photoRelease: false,
      dataPrivacy: false,
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactEmail: "",
      trainingCardUserNumber: undefined,
    },
  });

  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmission = () => {
    setLoading(true); // Set loading when submission begins
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  React.useEffect(() => {
    if (formRef.current) {
      // Attach an event listener to the form's submit event
      const formElement = formRef.current;

      const listener = () => {
        handleSubmission(); // Set loading state
      };

      formElement.addEventListener("submit", listener);

      return () => {
        formElement.removeEventListener("submit", listener); // Clean up listener on unmount
      };
    }
  }, []);

  React.useEffect(() => {
    if (actionData?.success || actionData?.errors) {
      setLoading(false); // Reset loading after the action completes
    }
  }, [actionData]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Register</h1>

      {/* Show success message if form submission is successful */}
      {actionData?.success && (
        <div className="text-sm text-green-500 bg-green-100 border-green-400 rounded p-2 mb-4">
          Your registration was successful!
        </div>
      )}

      {/* Only show the error message if there are errors */}
      {hasErrors && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted
          fields below.
        </div>
      )}

      <Form {...form}>
        <form
          method="post"
          encType="multipart/form-data"
          ref={formRef} // Attach ref to the form
          // onSubmit={form.handleSubmit(() => {})}
          // onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* <form method="post" encType="multipart/form-data" onSubmit={form.handleSubmit(() => {})}></form> */}

          {/* First Name */}
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  First Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="First Name" {...field} />
                </FormControl>
                <FormMessage>{actionData?.errors?.firstName}</FormMessage>
              </FormItem>
            )}
          />

          {/* Last Name */}
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Last Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Last Name" {...field} />
                </FormControl>
                <FormMessage>{actionData?.errors?.lastName}</FormMessage>
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="your@email.com" {...field} />
                </FormControl>
                <FormMessage>{actionData?.errors?.email}</FormMessage>
              </FormItem>
            )}
          />

          {/* password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Password <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage>{actionData?.errors?.password}</FormMessage>
              </FormItem>
            )}
          />

          {/* Phone */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Phone <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="123-456-7890" {...field} />
                </FormControl>
                <FormMessage>{actionData?.errors?.phone}</FormMessage>
              </FormItem>
            )}
          />

          {/* Address */}
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Address <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage>{actionData?.errors?.address}</FormMessage>
              </FormItem>
            )}
          />

          {/* Over 18 */}
          <FormField
            control={form.control}
            name="over18"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Over 18? <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    name="over18"
                    value={field.value ? "true" : "false"}
                    onValueChange={(value) => field.onChange(value === "true")}
                    className="flex space-x-4 mt-2"
                  >
                    <label className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="over18-yes" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="over18-no" />
                      <span>No</span>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage>{actionData?.errors?.over18}</FormMessage>
              </FormItem>
            )}
          />

          {form.watch("over18") === false && (
            <>
              {/* Parent/Guardian Fields */}
              <FormField
                control={form.control}
                name="parentGuardianName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Parent/Guardian Name{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Parent/Guardian Name"
                        {...field}
                        value={field.value ?? ""} // Ensure the value is a string, not null
                      />
                    </FormControl>
                    <FormMessage>
                      {actionData?.errors?.parentGuardianName}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentGuardianPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Parent/Guardian Phone{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Parent/Guardian Phone"
                        {...field}
                        value={field.value ?? ""} // Ensure the value is a string, not null
                      />
                    </FormControl>
                    <FormMessage>
                      {actionData?.errors?.parentGuardianPhone}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                name="parentGuardianEmail"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Parent/Guardian Email{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <Input
                      placeholder="Parent/Guardian Email"
                      {...field}
                      value={field.value ?? ""} // Ensure the value is a string, not null
                    />
                    <FormMessage>
                      {actionData?.errors?.parentGuardianEmail}
                    </FormMessage>
                  </FormItem>
                )}
              />
              {/* Guardian Signed Consent */}
              <FormField
                control={form.control}
                name="guardianSignedConsent"
                render={() => (
                  <FormItem>
                    <FormLabel>
                      Guardian Signed Consent{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        name="guardianSignedConsent"
                        type="file"
                        onChange={(e) =>
                          form.setValue(
                            "guardianSignedConsent",
                            e.target.files?.[0] || null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage>
                      {/* {typeof form.formState.errors.guardianSignedConsent
                        ?.message === "string" &&
                        form.formState.errors.guardianSignedConsent?.message} */}
                      {actionData?.errors?.guardianSignedConsent}
                    </FormMessage>
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Photo Release */}
          <FormField
            control={form.control}
            name="photoRelease"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Photo Release <span className="text-red-500">*</span>
                </FormLabel>
                <FormDescription>
                  I grant permission to Makerspace YK, its representatives and
                  employees, to take photographs of me and/or my dependent, as
                  well as my property, in connection with their programs.
                </FormDescription>
                <FormControl>
                  <RadioGroup
                    name="photoRelease"
                    value={field.value ? "true" : "false"}
                    onValueChange={(value) => field.onChange(value === "true")}
                    className="flex space-x-4 mt-4"
                  >
                    <label className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="photo-consent" />
                      <span>I consent</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="photo-no-consent" />
                      <span>I do not consent</span>
                    </label>
                  </RadioGroup>
                </FormControl>
                <FormMessage>{actionData?.errors?.photoRelease}</FormMessage>
              </FormItem>
            )}
          />

          {/* Data Privacy */}
          <FormField
            control={form.control}
            name="dataPrivacy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Data Privacy <span className="text-red-500">*</span>
                </FormLabel>
                <FormDescription>
                  I understand that Makerspace YK shall treat all Confidential
                  Information belonging to me and/or my dependant as
                  confidential and safeguard it accordingly. Makerspace YK may
                  use my and/or my dependant's information internally to provide
                  their services to me and/or my dependant, where necessary, to
                  help them improve their product or service delivery. I
                  understand that Makerspace YK shall not disclose any
                  Confidential Information belonging to me and/or my dependant
                  to any third-parties without my and my dependant's prior
                  written consent, except where disclosure is required by law.
                </FormDescription>
                <FormControl>
                  <label className="flex items-center space-x-3 mt-4">
                    <Checkbox
                      name="dataPrivacy"
                      checked={field.value}
                      onCheckedChange={(value) => field.onChange(value)}
                      id="data-privacy"
                    />
                    <span>I agree to the Data Privacy policy</span>
                  </label>
                </FormControl>
                <FormMessage>{actionData?.errors?.dataPrivacy}</FormMessage>
              </FormItem>
            )}
          />

          {/* Emergency Contact Name */}
          <FormField
            control={form.control}
            name="emergencyContactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Emergency Contact Name <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Emergency Contact Name" {...field} />
                </FormControl>
                <FormMessage>
                  {actionData?.errors?.emergencyContactName}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Emergency Contact Phone */}
          <FormField
            control={form.control}
            name="emergencyContactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Emergency Contact Phone{" "}
                  <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Emergency Contact Phone" {...field} />
                </FormControl>
                <FormMessage>
                  {actionData?.errors?.emergencyContactPhone}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Emergency Contact Email */}
          <FormField
            control={form.control}
            name="emergencyContactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Emergency Contact Email{" "}
                  <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="emergency@example.com" {...field} />
                </FormControl>
                <FormMessage>
                  {actionData?.errors?.emergencyContactEmail}
                </FormMessage>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="trainingCardUserNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Training Card/User Number
                  <span className="text-red-500">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    name="trainingCardUserNumber"
                    type="number"
                    placeholder="123"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ""
                          ? undefined
                          : parseInt(e.target.value, 10)
                      )
                    }
                  />
                </FormControl>
                <FormMessage>
                  {actionData?.errors?.trainingCardUserNumber}
                </FormMessage>
              </FormItem>
            )}
          />

          {/* Submit Button */}
          <Button type="submit" className="mt-4" disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
