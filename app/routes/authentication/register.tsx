import React, { useState, useRef, useEffect } from "react";
import { redirect, useLoaderData, Form as RouterForm } from "react-router";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "./+types/register";
import { register, getUser } from "~/utils/session.server";
import GenericFormField from "~/components/ui/Dashboard/GenericFormField";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const waiverSignature = formData.get("waiverSignature");
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  rawValues.mediaConsent = rawValues.mediaConsent === "on";
  rawValues.dataPrivacy = rawValues.dataPrivacy === "on";
  rawValues.communityGuidelines = rawValues.communityGuidelines === "on";
  rawValues.operationsPolicy = rawValues.operationsPolicy === "on";

  // Handle date of birth and calculate if over 18
  if (rawValues.dateOfBirth) {
    const birthDate = new Date(rawValues.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    rawValues.calculatedAge = age;
    rawValues.over18 = age >= 18;
  }

  // Ensure signature data is properly handled
  if (
    typeof waiverSignature === "string" &&
    waiverSignature.trim() !== "" &&
    waiverSignature !== "undefined"
  ) {
    rawValues.waiverSignature = waiverSignature;
  } else {
    rawValues.waiverSignature = undefined;
  }

  const result = await register(rawValues);

  if (!result) {
    return { errors: { database: "Failed to register. Please try again." } };
  }

  if ("errors" in result) {
    return { errors: result.errors };
  }

  // Get redirect parameter from URL
  const url = new URL(request.url);
  const redirectParam = url.searchParams.get("redirect");

  if (redirectParam) {
    // If there's a redirect parameter, redirect to login page with the same redirect parameter
    // so after login, user goes back to where they came from
    return redirect(`/login?redirect=${encodeURIComponent(redirectParam)}`);
  }

  return { success: true, user: result };
}

interface FormErrors {
  firstName?: string[];
  lastName?: string[];
  email?: string[];
  password?: string[];
  confirmPassword?: string[];
  phone?: string[];
  dateOfBirth?: string[];
  emergencyContactName?: string[];
  emergencyContactPhone?: string[];
  emergencyContactEmail?: string[];
  mediaConsent?: string[];
  dataPrivacy?: string[];
  communityGuidelines?: string[];
  operationsPolicy?: string[];
  waiverSignature?: string[];
}

interface ActionData {
  success?: boolean;
  errors?: FormErrors;
}

const DigitalSignaturePad: React.FC<{
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  disabled?: boolean;
}> = ({ value, onChange, error, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      setHasSignature(true);
      const canvas = canvasRef.current;
      if (canvas) {
        const dataURL = canvas.toDataURL();
        onChange(dataURL);
      }
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        onChange(null);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  }, []);

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={150}
        className={`border border-gray-200 rounded w-full ${disabled ? "cursor-not-allowed bg-gray-100" : "cursor-crosshair"}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        title={
          disabled ? "Please download and view the waiver document first" : ""
        }
      />
      <div className="flex justify-between items-center mt-2">
        <Button
          type="button"
          onClick={clearSignature}
          variant="outline"
          size="sm"
          disabled={disabled}
        >
          Clear
        </Button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Signature is auto-saved when you finish drawing.
      </p>
      {hasSignature && (
        <p className="text-xs text-green-600 mt-1">✓ Signature captured</p>
      )}
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
      confirmPassword: "",
      phone: "",
      dateOfBirth: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactEmail: "",
      mediaConsent: false,
      dataPrivacy: false,
      communityGuidelines: false,
      operationsPolicy: false,
      waiverSignature: undefined,
    },
  });

  const { user } = loaderData;
  const [loading, setLoading] = useState(false);
  const [showMinorError, setShowMinorError] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [communityGuidelinesViewed, setCommunityGuidelinesViewed] =
    useState(false);
  const [operationsPolicyViewed, setOperationsPolicyViewed] = useState(false);
  const [waiverDocumentViewed, setWaiverDocumentViewed] = useState(false);

  const [showCommunityNotice, setShowCommunityNotice] = useState(false);
  const [showOperationsNotice, setShowOperationsNotice] = useState(false);
  const [showWaiverNotice, setShowWaiverNotice] = useState(false);

  const handleSubmission = () => {
    setLoading(true);
  };

  const hasErrors =
    actionData?.errors && Object.keys(actionData.errors).length > 0;

  // Watch date of birth to show age-related messages
  const dateOfBirth = form.watch("dateOfBirth");

  useEffect(() => {
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }

      if (age >= 14 && age <= 17) {
        setShowMinorError(
          "For liability and safety all makers between the ages of 14-17 must come in-person to the makerspace with a parent/guardian to register on the portal. Contact us to schedule a time!"
        );
      } else if (age < 14) {
        setShowMinorError(
          "Oh no! Makers that are under 14 are a bit too young to register for the portal. You can talk to your parent/guardian to register and participate with you!"
        );
      } else {
        setShowMinorError("");
      }
    }
  }, [dateOfBirth]);


  React.useEffect(() => {
    if (actionData?.success || actionData?.errors) {
      setLoading(false);
    }
  }, [actionData]);

  // Restore form values after a server error and surface server errors in RHF
  useEffect(() => {
    if (actionData?.errors) {
      const saved = sessionStorage.getItem("registerFormValues");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          form.reset(parsed);
        } catch {}
      }
      const entries = Object.entries(actionData.errors) as Array<[
        keyof RegisterFormValues,
        string[] | undefined
      ]>;
      entries.forEach(([key, messages]) => {
        const message = Array.isArray(messages) ? messages[0] : messages;
        if (message) {
          form.setError(key as keyof RegisterFormValues, {
            type: "server",
            message: String(message),
          } as any);
        }
      });
    }
    if (actionData?.success) {
      sessionStorage.removeItem("registerFormValues");
    }
  }, [actionData, form]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-indigo-400 rounded-xl shadow-md p-8">
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
              <div className="mt-2">
                <p className="text-sm text-gray-600">
                  You can now{" "}
                  <a
                    href="/login"
                    className="text-indigo-600
                    hover:text-indigo-700 font-medium"
                  >
                    login here
                  </a>{" "}
                  or{" "}
                  <a
                    href="/dashboard"
                    className="text-indigo-600
                    hover:text-indigo-700 font-medium"
                  >
                    view the portal as guest
                  </a>
                </p>
              </div>
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
              <p className="text-gray-600 mb-4">You are already logged in!</p>
              <RouterForm method="post" action="/logout">
                <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded">
                  {loading ? "Logging out..." : "Logout"}
                </button>
              </RouterForm>
            </div>
          ) : (
            <>
              {/* Introduction text */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Want to use the makerspace? Please complete this registration
                  to get set up on our Makerspace YK Member Portal! This portal
                  is where you can sign up and keep track of your orientations,
                  workshops and memberships. Plus there are some additional
                  features like volunteer hour tracking and equipment booking
                  for more serious makers.
                </p>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 mt-6">
                  <div className="text-center space-y-3">
                    <p className="text-sm text-gray-600">
                      Already have an account?{" "}
                      <a
                        href="/login"
                        className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors duration-200 decoration-1 underline-offset-2"
                      >
                        Sign in here
                      </a>
                    </p>

                    <p className="text-sm text-gray-600">
                      View the portal as a guest?{" "}
                      <a
                        href="/dashboard"
                        className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors duration-200 decoration-1 underline-offset-2"
                      >
                        View here
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <Form {...form}>
                <form
                  method="post"
                  encType="multipart/form-data"
                  ref={formRef}
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const isValid = await form.trigger();
                    if (!isValid) {
                      setLoading(false);
                      return;
                    }
                    try {
                      sessionStorage.setItem(
                        "registerFormValues",
                        JSON.stringify(form.getValues())
                      );
                    } catch {}
                    handleSubmission();
                    formRef.current?.submit();
                  }}
                  noValidate
                >
                  {/* Basic Fields */}
                  <GenericFormField
                    control={form.control}
                    name="firstName"
                    label="First Name"
                    placeholder="First Name"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="lastName"
                    label="Last Name"
                    placeholder="Last Name"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="email"
                    label="Email"
                    placeholder="your@email.com"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="phone"
                    label="Phone"
                    placeholder="123-456-7890"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    type="password"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="confirmPassword"
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    type="password"
                    required
                    className="w-full"
                  />

                  {/* Date of Birth */}
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Date of Birth <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </FormControl>
                        <FormMessage />
                        {showMinorError && (
                          <p className="text-sm text-red-600 mt-1">
                            {showMinorError}
                          </p>
                        )}
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
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="emergencyContactPhone"
                    label="Emergency Contact Phone"
                    placeholder="Emergency Contact Phone"
                    required
                    className="w-full"
                  />
                  <GenericFormField
                    control={form.control}
                    name="emergencyContactEmail"
                    label="Emergency Contact Email"
                    placeholder="emergency@example.com"
                    required
                    className="w-full"
                  />

                  {/* Media Consent */}
                  <FormField
                    control={form.control}
                    name="mediaConsent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-900">
                          Media Consent <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600">
                          I grant permission to Makerspace YK, its
                          representatives and employees, to take
                          photographs/videos of me and/or my dependant in
                          connection with their programs. This media may be used
                          in advertisements, reporting, reports and other MSYK
                          documents and content to support their programming.
                        </FormDescription>
                        <FormControl>
                          <div className="flex items-center space-x-4 mt-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="mediaConsent"
                                value="true"
                                checked={field.value === true}
                                onChange={() => field.onChange(true)}
                                className="text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                              />
                              <span className="text-sm text-gray-700">
                                I consent
                              </span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="mediaConsent"
                                value="false"
                                checked={field.value === false}
                                onChange={() => field.onChange(false)}
                                className="text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                              />
                              <span className="text-sm text-gray-700">
                                I do not consent
                              </span>
                            </label>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Data Privacy */}
                  <FormField
                    control={form.control}
                    name="dataPrivacy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-900">
                          Data Privacy <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600">
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
                          <label className="flex items-start space-x-3 mt-4">
                            <Checkbox
                              name="dataPrivacy"
                              checked={field.value}
                              onCheckedChange={(value) => field.onChange(value)}
                              id="data-privacy"
                            className="border-2 border-indigo-600 text-indigo-600 focus:ring-indigo-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-white mt-1 h-4 w-4 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-700 leading-relaxed">
                              I have read and agree to the Data Privacy policy
                            </span>
                          </label>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* MSYK Community Guidelines */}
                  <FormField
                    control={form.control}
                    name="communityGuidelines"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-900">
                          MSYK Community Guidelines{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600">
                          Please review the Community Guidelines document. You
                          can{" "}
                          <a
                            href="/documents/msyk-community-guidelines.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700 underline"
                            onClick={() => setCommunityGuidelinesViewed(true)}
                          >
                            download and view the document here
                          </a>
                          .
                        </FormDescription>
                        {!communityGuidelinesViewed && (
                          <Collapsible
                            open={showCommunityNotice}
                            onOpenChange={setShowCommunityNotice}
                            className="mb-4"
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                              <div className="flex items-center space-x-2">
                                <Info className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                  Notice
                                </span>
                              </div>
                              {showCommunityNotice ? (
                                <ChevronUp className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-3 bg-blue-50 border-l border-r border-b border-blue-200 rounded-b-lg">
                              <p className="text-sm text-blue-800">
                                Please click the "download and view the document
                                here" link above to read the Community
                                Guidelines before you can agree to them.
                              </p>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        <FormControl>
                          <label className="flex items-start space-x-3 mt-4">
                            <Checkbox
                              name="communityGuidelines"
                              checked={field.value}
                              onCheckedChange={(value) =>
                                communityGuidelinesViewed
                                  ? field.onChange(value)
                                  : null
                              }
                              disabled={!communityGuidelinesViewed}
                              id="community-guidelines"
                              className={`border-2 ${!communityGuidelinesViewed ? "border-gray-300 bg-gray-100 cursor-not-allowed" : "border-indigo-600"} text-indigo-600 focus:ring-indigo-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-white mt-1 h-4 w-4 flex-shrink-0`}
                              title={
                                !communityGuidelinesViewed
                                  ? "Please download and view the document first"
                                  : ""
                              }
                            />
                            <span
                              className={`text-sm leading-relaxed ${!communityGuidelinesViewed ? "text-gray-400" : "text-gray-700"}`}
                            >
                              I confirm I have read and agree to follow the MSYK
                              Community Guidelines.
                            </span>
                          </label>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* MSYK User Operations Policy */}
                  <FormField
                    control={form.control}
                    name="operationsPolicy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-900">
                          MSYK User Operations & Safety Policy{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600">
                          Please review the User Operations & Safety Policy
                          document. You can{" "}
                          <a
                            href="/documents/msyk-operations-policy.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700 underline"
                            onClick={() => setOperationsPolicyViewed(true)}
                          >
                            download and view the document here
                          </a>
                          .
                        </FormDescription>
                        {!operationsPolicyViewed && (
                          <Collapsible
                            open={showOperationsNotice}
                            onOpenChange={setShowOperationsNotice}
                            className="mb-4"
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                              <div className="flex items-center space-x-2">
                                <Info className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                  Notice
                                </span>
                              </div>
                              {showOperationsNotice ? (
                                <ChevronUp className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-3 bg-blue-50 border-l border-r border-b border-blue-200 rounded-b-lg">
                              <p className="text-sm text-blue-800">
                                Please click the "download and view the document
                                here" link above to read the User Operations &
                                Safety Policy before you can agree to it.
                              </p>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        <FormControl>
                          <label className="flex items-start space-x-3 mt-4">
                            <Checkbox
                              name="operationsPolicy"
                              checked={field.value}
                              onCheckedChange={(value) =>
                                operationsPolicyViewed
                                  ? field.onChange(value)
                                  : null
                              }
                              disabled={!operationsPolicyViewed}
                              id="operations-policy"
                              className={`border-2 ${!operationsPolicyViewed ? "border-gray-300 bg-gray-100 cursor-not-allowed" : "border-indigo-600"} text-indigo-600 focus:ring-indigo-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 data-[state=checked]:text-white mt-1 h-4 w-4 flex-shrink-0`}
                              title={
                                !operationsPolicyViewed
                                  ? "Please download and view the document first"
                                  : ""
                              }
                            />
                            <span
                              className={`text-sm leading-relaxed ${!operationsPolicyViewed ? "text-gray-400" : "text-gray-700"}`}
                            >
                              I confirm I have read and agree to follow the MSYK
                              User Operations & Safety Policy.
                            </span>
                          </label>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Waiver and Hold Harmless Agreement */}
                  <FormField
                    control={form.control}
                    name="waiverSignature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base text-gray-900">
                          Waiver and Hold Harmless Agreement{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-gray-600">
                          Please download, review, and digitally sign the waiver
                          document. You can{" "}
                          <a
                            href="/documents/msyk-waiver-template.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-700 underline"
                            onClick={() => setWaiverDocumentViewed(true)}
                          >
                            download the waiver document here
                          </a>
                          .
                        </FormDescription>
                        {!waiverDocumentViewed && (
                          <Collapsible
                            open={showWaiverNotice}
                            onOpenChange={setShowWaiverNotice}
                            className="mb-4"
                          >
                            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                              <div className="flex items-center space-x-2">
                                <Info className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                  Notice
                                </span>
                              </div>
                              {showWaiverNotice ? (
                                <ChevronUp className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-3 bg-blue-50 border-l border-r border-b border-blue-200 rounded-b-lg">
                              <p className="text-sm text-blue-800">
                                Please click the "download the waiver document
                                here" link above to read the waiver before you
                                can provide your digital signature.
                              </p>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        <FormControl>
                          <div>
                            <DigitalSignaturePad
                              value={field.value}
                              onChange={field.onChange}
                            error={undefined}
                              disabled={!waiverDocumentViewed}
                            />
                            <input
                              type="hidden"
                              name="waiverSignature"
                              value={field.value || ""}
                            />
                          </div>
                        </FormControl>
                      <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !!showMinorError}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg disabled:opacity-50 transition-colors"
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
