import { PrismaClient } from "@prisma/client";
import React, { useState, useRef, useEffect } from "react";
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

  // Debug: Log guardian signature data
  const guardianSignedConsent = formData.get("guardianSignedConsent");

  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  rawValues.over18 = rawValues.over18 === "true";
  rawValues.photoRelease = rawValues.photoRelease === "true";
  rawValues.dataPrivacy = rawValues.dataPrivacy === "on";

  // Ensure signature data is properly handled
  if (
    typeof guardianSignedConsent === "string" &&
    guardianSignedConsent.trim() !== ""
  ) {
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
}

interface ActionData {
  errors?: FormErrors;
  success?: boolean;
}

const SignatureCanvas: React.FC<{
  onSave: (signature: string) => void;
  value?: string | null;
}> = ({ onSave, value }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 200;

    // Set drawing styles
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear and set background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If there's an existing signature, load it
    if (value && value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, [value]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing && hasSignature) {
      // Auto-save when user stops drawing
      saveSignature();
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSave("");
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL("image/png");
    onSave(dataURL);
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="border border-gray-200 cursor-crosshair bg-white"
        style={{ width: "100%", maxWidth: "400px", height: "200px" }}
      />
      <div className="flex gap-2 mt-2">
        <Button
          type="button"
          onClick={clearSignature}
          variant="outline"
          size="sm"
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={saveSignature}
          variant="outline"
          size="sm"
        >
          Save Signature
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Click and drag to sign. Signature is auto-saved when you finish drawing.
      </p>
      {hasSignature && (
        <p className="text-xs text-green-600 mt-1">✓ Signature captured</p>
      )}
    </div>
  );
};

const SignatureDisplay: React.FC<{ signature: string; className?: string }> = ({
  signature,
  className = "max-w-md mx-auto border border-gray-300 rounded-lg p-2",
}) => {
  if (!signature || !signature.startsWith("data:image/")) {
    return <div className="text-gray-500 text-sm">No signature available</div>;
  }

  return (
    <div className={className}>
      <img
        src={signature}
        alt="Digital Signature"
        className="w-full h-auto"
        style={{ maxHeight: "200px" }}
      />
    </div>
  );
};

export default function Register({ actionData }: { actionData?: ActionData }) {
  const loaderData = useLoaderData<{
    user: { id: number; email: string } | null;
  }>();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
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
    },
  });

  const { user } = loaderData;
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmission = () => {
    setLoading(true);
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-yellow-400 rounded-xl shadow-md p-8">
        {/* Header with logo */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="public/images/Makerspace Horizontal Text Logo Colour-01.avif"
            alt="Makerspace Logo"
            className="h-16 mb-2"
          />
        </div>

        {/* Content area */}
        <div className="px-8 pb-8">
          {actionData?.success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ✓ Registration successful!
              </p>
            </div>
          )}
          {hasErrors && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">
                Please review the highlighted fields below.
              </p>
            </div>
          )}
          {user ? (
            <div className="text-center">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-1">Already logged in</p>
                <p className="text-xs text-blue-600">{user.email}</p>
              </div>
              <RouterForm action="/logout" method="post">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Logging out..." : "Logout"}
                </button>
              </RouterForm>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form
                  method="post"
                  encType="multipart/form-data"
                  ref={formRef}
                  className="space-y-2"
                >
                  {/* Reusable Fields */}
                  <GenericFormField
                    control={form.control}
                    name="firstName"
                    label="First Name"
                    placeholder="First Name"
                    required
                    error={actionData?.errors?.firstName}
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="lastName"
                    label="Last Name"
                    placeholder="Last Name"
                    required
                    error={actionData?.errors?.lastName}
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="email"
                    label="Email"
                    placeholder="your@email.com"
                    required
                    error={actionData?.errors?.email}
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    type="password"
                    required
                    error={actionData?.errors?.password}
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="phone"
                    label="Phone"
                    placeholder="123-456-7890"
                    required
                    error={actionData?.errors?.phone}
                    className="w-full"
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
                            onValueChange={(value) =>
                              field.onChange(value === "true")
                            }
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
                        className="w-full"
                      />
                      <GenericFormField
                        control={form.control}
                        name="parentGuardianPhone"
                        label="Parent/Guardian Phone"
                        placeholder="Parent/Guardian Phone"
                        required
                        error={actionData?.errors?.parentGuardianPhone}
                        className="w-full"
                      />
                      <GenericFormField
                        control={form.control}
                        name="parentGuardianEmail"
                        label="Parent/Guardian Email"
                        placeholder="Parent/Guardian Email"
                        required
                        error={actionData?.errors?.parentGuardianEmail}
                        className="w-full"
                      />

                      {/* <div
                    style={{
                      border: "1px solid #ccc",
                      padding: "10px",
                      margin: "10px 0",
                    }}
                  >
                    <h3>Test Signature Display:</h3>
                    <img
                      src=""
                      alt="Signature"
                      style={{ maxWidth: "300px", height: "auto" }}
                    />
                  </div> */}
                      <FormField
                        control={form.control}
                        name="guardianSignedConsent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Guardian Digital Signature{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div>
                                <SignatureCanvas
                                  onSave={(signature) =>
                                    field.onChange(signature)
                                  }
                                  value={field.value}
                                />
                                <input
                                  type="hidden"
                                  name="guardianSignedConsent"
                                  value={field.value || ""}
                                />
                              </div>
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
                          I grant permission to Makerspace YK, its
                          representatives and employees, to take photographs of
                          me and/or my dependent, as well as my property, in
                          connection with their programs.
                        </FormDescription>
                        <FormControl>
                          <RadioGroup
                            name="photoRelease"
                            value={field.value ? "true" : "false"}
                            onValueChange={(value) =>
                              field.onChange(value === "true")
                            }
                            className="flex space-x-4 mt-4"
                          >
                            <label className="flex items-center space-x-2">
                              <RadioGroupItem value="true" id="photo-consent" />
                              <span>I consent</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="false"
                                id="photo-no-consent"
                              />
                              <span>I do not consent</span>
                            </label>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage>
                          {actionData?.errors?.photoRelease}
                        </FormMessage>
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
                          I understand that Makerspace YK shall treat all
                          Confidential Information belonging to me and/or my
                          dependant as confidential and safeguard it
                          accordingly. Makerspace YK may use my and/or my
                          dependant's information internally to provide their
                          services to me and/or my dependant, where necessary,
                          to help them improve their product or service
                          delivery. I understand that Makerspace YK shall not
                          disclose any Confidential Information belonging to me
                          and/or my dependant to any third-parties without my
                          and my dependant's prior written consent, except where
                          disclosure is required by law.
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
                        <FormMessage>
                          {actionData?.errors?.dataPrivacy}
                        </FormMessage>
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
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="emergencyContactPhone"
                    label="Emergency Contact Phone"
                    placeholder="Emergency Contact Phone"
                    required
                    error={actionData?.errors?.emergencyContactPhone}
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="emergencyContactEmail"
                    label="Emergency Contact Email"
                    placeholder="emergency@example.com"
                    required
                    error={actionData?.errors?.emergencyContactEmail}
                    className="w-full"
                  />

                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">
                      Already have an account?{" "}
                      <a
                        href="/login"
                        className="text-yellow-600 hover:text-yellow-700 font-medium"
                      >
                        Sign in here
                      </a>
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </button>
                </form>
              </Form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
