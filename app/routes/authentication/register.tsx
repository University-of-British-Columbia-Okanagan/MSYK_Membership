import { PrismaClient } from "@prisma/client";
import React, { useState, useRef } from "react";
import {
  redirect,
  useNavigation,
  useLoaderData,
  Form as RouterForm,
} from "react-router";
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
import { register, getUser } from "~/utils/session.server";
import GenericFormField from "@/components/ui/GenericFormField";

const prisma = new PrismaClient();

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  rawValues.over18 = rawValues.over18 === "true";
  rawValues.photoRelease = rawValues.photoRelease === "true";
  rawValues.dataPrivacy = rawValues.dataPrivacy === "on";

  rawValues.trainingCardUserNumber = rawValues.trainingCardUserNumber
    ? parseInt(rawValues.trainingCardUserNumber, 10)
    : null;

  const guardianSignedConsent = formData.get("guardianSignedConsent");
  if (guardianSignedConsent instanceof File && guardianSignedConsent.size > 0) {
    rawValues.guardianSignedConsent = guardianSignedConsent;
  } else {
    rawValues.guardianSignedConsent = null;
  }

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
  const loaderData = useLoaderData<{ user: { id: number; email: string } | null }>();
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

  const { user } = loaderData;
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmission = () => {
    setLoading(true);
  };

  const hasErrors = actionData?.errors && Object.keys(actionData.errors).length > 0;

  React.useEffect(() => {
    if (formRef.current) {
      const formElement = formRef.current;
      const listener = () => {
        handleSubmission();
      };
      formElement.addEventListener("submit", listener);
      return () => {
        formElement.removeEventListener("submit", listener);
      };
    }
  }, []);

  React.useEffect(() => {
    if (actionData?.success || actionData?.errors) {
      setLoading(false);
    }
  }, [actionData]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Register</h1>
      {actionData?.success && (
        <div className="text-sm text-green-500 bg-green-100 border-green-400 rounded p-2 mb-4">
          Your registration was successful!
        </div>
      )}
      {hasErrors && (
        <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
          There are some errors in your form. Please review the highlighted fields below.
        </div>
      )}
      {user ? (
        <div className="text-center">
          <p className="text-lg font-medium mb-4">
            You are currently logged in as email: {user.email}, id: {user.id}!
          </p>
          <RouterForm action="/logout" method="post">
            <Button type="submit" className="mt-4" disabled={loading}>
              {loading ? "Logging out..." : "Logout"}
            </Button>
          </RouterForm>
        </div>
      ) : (
        <>
          <Form {...form}>
            <form
              method="post"
              encType="multipart/form-data"
              ref={formRef}
            >
              {/* Reusable Fields */}
              <GenericFormField
                control={form.control}
                name="firstName"
                label="First Name"
                placeholder="First Name"
                required
                error={actionData?.errors?.firstName}
              />
              <GenericFormField
                control={form.control}
                name="lastName"
                label="Last Name"
                placeholder="Last Name"
                required
                error={actionData?.errors?.lastName}
              />
              <GenericFormField
                control={form.control}
                name="email"
                label="Email"
                placeholder="your@email.com"
                required
                error={actionData?.errors?.email}
              />
              <GenericFormField
                control={form.control}
                name="password"
                label="Password"
                placeholder="Enter your password"
                type="password"
                required
                error={actionData?.errors?.password}
              />
              <GenericFormField
                control={form.control}
                name="phone"
                label="Phone"
                placeholder="123-456-7890"
                required
                error={actionData?.errors?.phone}
              />
              <GenericFormField
                control={form.control}
                name="address"
                label="Address"
                placeholder="123 Main St"
                required
                error={actionData?.errors?.address}
              />

              {/* Over 18 Radio Group */}
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

              {/* Parent/Guardian Fields when not over 18 */}
              {form.watch("over18") === false && (
                <>
                  <GenericFormField
                    control={form.control}
                    name="parentGuardianName"
                    label="Parent/Guardian Name"
                    placeholder="Parent/Guardian Name"
                    required
                    error={actionData?.errors?.parentGuardianName}
                  />
                  <GenericFormField
                    control={form.control}
                    name="parentGuardianPhone"
                    label="Parent/Guardian Phone"
                    placeholder="Parent/Guardian Phone"
                    required
                    error={actionData?.errors?.parentGuardianPhone}
                  />
                  <GenericFormField
                    control={form.control}
                    name="parentGuardianEmail"
                    label="Parent/Guardian Email"
                    placeholder="Parent/Guardian Email"
                    required
                    error={actionData?.errors?.parentGuardianEmail}
                  />
                  <FormField
                    control={form.control}
                    name="guardianSignedConsent"
                    render={() => (
                      <FormItem>
                        <FormLabel>
                          Guardian Signed Consent <span className="text-red-500">*</span>
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
                          {actionData?.errors?.guardianSignedConsent}
                        </FormMessage>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Photo Release Radio Group */}
              <FormField
                control={form.control}
                name="photoRelease"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Photo Release <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormDescription>
                      I grant permission to Makerspace YK, its representatives and employees, to take photographs of me and/or my dependent, as well as my property, in connection with their programs.
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

              {/* Data Privacy Checkbox */}
              <FormField
                control={form.control}
                name="dataPrivacy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data Privacy <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormDescription>
                      I understand that Makerspace YK shall treat all Confidential Information belonging to me and/or my dependant as confidential and safeguard it accordingly. Makerspace YK may use my and/or my dependant's information internally to provide their services to me and/or my dependant, where necessary, to help them improve their product or service delivery. I understand that Makerspace YK shall not disclose any Confidential Information belonging to me and/or my dependant to any third-parties without my and my dependant's prior written consent, except where disclosure is required by law.
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

              {/* Emergency Contact Fields */}
              <GenericFormField
                control={form.control}
                name="emergencyContactName"
                label="Emergency Contact Name"
                placeholder="Emergency Contact Name"
                required
                error={actionData?.errors?.emergencyContactName}
              />
              <GenericFormField
                control={form.control}
                name="emergencyContactPhone"
                label="Emergency Contact Phone"
                placeholder="Emergency Contact Phone"
                required
                error={actionData?.errors?.emergencyContactPhone}
              />
              <GenericFormField
                control={form.control}
                name="emergencyContactEmail"
                label="Emergency Contact Email"
                placeholder="emergency@example.com"
                required
                error={actionData?.errors?.emergencyContactEmail}
              />

              {/* Training Card/User Number */}
              <GenericFormField
                control={form.control}
                name="trainingCardUserNumber"
                label="Training Card/User Number"
                placeholder="123"
                required
                type="number"
                error={actionData?.errors?.trainingCardUserNumber}
              />

              {/* Submit Button */}
              <Button type="submit" className="mt-4" disabled={loading}>
                {loading ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}
