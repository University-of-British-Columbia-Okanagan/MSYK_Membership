import React, { useState, useRef, useEffect } from "react";
import { redirect, useLoaderData, Form as RouterForm } from "react-router";
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
import { getUser, getRoleUser } from "~/utils/session.server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ChevronDown, ChevronUp, Download } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  membershipAgreementSchema,
  type MembershipAgreementFormValues,
} from "~/schemas/membershipAgreementSchema";
import {
  getMembershipPlanById,
  getUserActiveMembership,
  getUserMembershipForm,
  createMembershipForm,
} from "~/models/membership.server";
import { getUserById } from "~/models/user.server";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "~/components/ui/Dashboard/Sidebar";
import AdminAppSidebar from "~/components/ui/Dashboard/Adminsidebar";
import GuestAppSidebar from "~/components/ui/Dashboard/Guestsidebar";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { membershipId: string };
}) {
  const user = await getUser(request);
  if (!user) throw redirect("/login");

  const roleUser = await getRoleUser(request);
  const membershipId = Number(params.membershipId);
  if (isNaN(membershipId)) {
    throw new Response("Invalid membership ID", { status: 400 });
  }

  const membershipPlan = await getMembershipPlanById(membershipId);
  if (!membershipPlan) {
    throw new Response("Membership Plan not found", { status: 404 });
  }

  const userActiveMembership = await getUserActiveMembership(user.id);
  const userRecord = await getUserById(user.id);

  // Check if user already has a signed agreement for this membership
  const existingForm = await getUserMembershipForm(user.id, membershipId);

  return {
    user,
    roleUser,
    membershipPlan,
    userActiveMembership,
    userRecord,
    existingForm,
  };
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { membershipId: string };
}) {
  const user = await getUser(request);
  if (!user) throw redirect("/login");

  const membershipId = Number(params.membershipId);
  const formData = await request.formData();
  const agreementSignature = formData.get("agreementSignature");

  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  // Ensure signature data is properly handled
  if (
    typeof agreementSignature === "string" &&
    agreementSignature.trim() !== "" &&
    agreementSignature !== "undefined"
  ) {
    rawValues.agreementSignature = agreementSignature;
  } else {
    rawValues.agreementSignature = undefined;
  }

  // Validate the form data
  const parsed = membershipAgreementSchema.safeParse(rawValues);

  if (!parsed.success) {
    const errors = parsed.error.flatten();
    return { errors: errors.fieldErrors };
  }

  try {
    // Create the membership form with encrypted signature
    await createMembershipForm(
      user.id,
      membershipId,
      rawValues.agreementSignature
    );

    // Redirect to payment page with membership ID
    const userActiveMembership = await getUserActiveMembership(user.id);
    let redirectPath = `/dashboard/payment/${membershipId}`;

    // Add upgrade/downgrade query params if user has active membership
    if (userActiveMembership) {
      const membershipPlan = await getMembershipPlanById(membershipId);
      const currentPrice = userActiveMembership.membershipPlan.price;
      const newPrice = membershipPlan?.price || 0;

      if (newPrice < currentPrice) {
        redirectPath += `?downgrade=true`;
      } else if (newPrice > currentPrice) {
        redirectPath += `?upgrade=true`;
      }
    }

    return redirect(redirectPath);
  } catch (error) {
    console.error("Error saving membership agreement:", error);
    return {
      errors: { database: ["Failed to save agreement. Please try again."] },
    };
  }
}

// Digital Signature Pad Component (copied from register.tsx with correct positioning)
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

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
        ctx.lineJoin = "round";
      }
    }
  }, []);

  // Handle touch events to prevent scrolling
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    startDrawing(e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    draw(e);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    stopDrawing();
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className={`border border-gray-200 rounded w-full ${disabled ? "cursor-not-allowed bg-gray-100" : "cursor-crosshair"} touch-none`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        title={
          disabled
            ? "Please download and view the membership agreement first"
            : ""
        }
        style={{ maxWidth: "100%" }}
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

export default function MembershipDetails() {
  const {
    user,
    roleUser,
    membershipPlan,
    userActiveMembership,
    userRecord,
    existingForm,
  } = useLoaderData<typeof loader>();
  const [loading, setLoading] = useState(false);
  const [agreementDocumentViewed, setAgreementDocumentViewed] = useState(false);

  const form = useForm<MembershipAgreementFormValues>({
    resolver: zodResolver(membershipAgreementSchema),
    defaultValues: {
      agreementSignature: "",
    },
  });

  // Determine which agreement document to use
  const agreementDocument = membershipPlan.needAdminPermission
    ? "msyk-membership-agreement-24-7"
    : "msyk-membership-agreement";

  // If user already signed agreement, redirect to payment
  useEffect(() => {
    if (existingForm) {
      window.location.href = `/dashboard/payment/${membershipPlan.id}`;
    }
  }, [existingForm, membershipPlan.id]);

  const handleSubmit = async (data: MembershipAgreementFormValues) => {
    setLoading(true);
    // Form will be submitted via RouterForm
  };

  const downloadAgreement = () => {
    // Create download link for the agreement PDF
    const link = document.createElement("a");
    link.href = `/documents/${agreementDocument}.pdf`;
    link.download = `${agreementDocument}.pdf`;
    link.click();
    setAgreementDocumentViewed(true);
  };

  // Determine membership action type
  let actionType = "Subscribe to";
  if (userActiveMembership) {
    const currentPrice = userActiveMembership.membershipPlan.price;
    const newPrice = membershipPlan.price;
    if (newPrice > currentPrice) {
      actionType = "Upgrade to";
    } else if (newPrice < currentPrice) {
      actionType = "Downgrade to";
    } else {
      actionType = "Switch to";
    }
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        {!user ? (
          <GuestAppSidebar />
        ) : roleUser?.roleName === "Admin" ? (
          <AdminAppSidebar />
        ) : (
          <AppSidebar />
        )}
        <main className="flex-grow p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <div className="mb-6">
              <Button
                type="button"
                onClick={() => window.history.back()}
                variant="outline"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to Memberships
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">
                  {actionType} {membershipPlan.title}
                </h2>
                <p className="mt-2 text-gray-600">
                  {membershipPlan.description}
                </p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${membershipPlan.price}
                  </span>
                  <span className="text-gray-600 text-sm"> /month</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Features Included:
                </h3>
                <ul className="space-y-2">
                  {Array.isArray(membershipPlan.feature)
                    ? (membershipPlan.feature as string[]).map(
                        (feature: string, index: number) => (
                          <li
                            key={index}
                            className="flex items-center text-gray-700"
                          >
                            <span className="text-yellow-500 mr-2">→</span>{" "}
                            {feature}
                          </li>
                        )
                      )
                    : Object.values(
                        membershipPlan.feature as Record<string, string>
                      ).map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-center text-gray-700"
                        >
                          <span className="text-yellow-500 mr-2">→</span>{" "}
                          {String(feature)}
                        </li>
                      ))}
                </ul>
              </div>

              <Form {...form}>
                <RouterForm
                  method="post"
                  onSubmit={form.handleSubmit(handleSubmit)}
                >
                  {/* Membership Agreement Section */}
                  <div className="mb-6">
                    <FormLabel className="text-base text-gray-900">
                      Membership Agreement{" "}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormDescription className="text-sm text-gray-600 mb-4">
                      Please download, review, and digitally sign the membership
                      agreement.
                    </FormDescription>

                    <div className="mb-4">
                      <Button
                        type="button"
                        onClick={downloadAgreement}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Membership Agreement
                      </Button>
                      {agreementDocumentViewed && (
                        <p className="text-green-600 text-sm mt-2">
                          ✓ Agreement document downloaded
                        </p>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="agreementSignature"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div>
                              <DigitalSignaturePad
                                value={field.value}
                                onChange={field.onChange}
                                disabled={!agreementDocumentViewed}
                              />
                              <input
                                type="hidden"
                                name="agreementSignature"
                                value={field.value || ""}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !agreementDocumentViewed}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-lg disabled:opacity-50 transition-colors font-semibold"
                  >
                    {loading ? "Processing..." : "Continue to Payment"}
                  </button>
                </RouterForm>
              </Form>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
