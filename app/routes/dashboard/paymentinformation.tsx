import { useState, useEffect } from "react";
import {
  useNavigate,
  useLoaderData,
  useActionData,
  Form,
} from "react-router-dom";
import type { ActionFunction, LoaderFunction } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "../../components/ui/Dashboard/sidebar";
import AdminAppSidebar from "../../components/ui/Dashboard/adminsidebar";
import GuestAppSidebar from "../../components/ui/Dashboard/guestsidebar";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { getUserId, getRoleUser } from "~/utils/session.server";
import { getProfileDetails } from "~/models/profile.server";
import { getSavedPaymentMethod } from "~/models/user.server";
import {
  deletePaymentMethod,
  createOrUpdatePaymentMethod,
} from "~/models/payment.server";
import {
  CreditCard,
  CheckCircle,
  Lock,
  AlertCircle,
  MapPin,
  Trash2,
} from "lucide-react";
import { logger } from "~/logging/logger";

// Loader - Get user information and any existing payment method
export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const roleUser = await getRoleUser(request);
  const user = await getProfileDetails(request);
  const savedPaymentMethod = await getSavedPaymentMethod(parseInt(userId));

  return { user, savedPaymentMethod, roleUser };
};

const sanitizeDigits = (value: string) => value.replace(/\D/g, "");

const isValidCardNumber = (value: string | null) => {
  if (!value) return false;
  const digits = sanitizeDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^0+$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = parseInt(digits.charAt(i), 10);
    if (Number.isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

const normalizeYear = (year: number) => {
  if (year < 100) {
    return 2000 + year;
  }
  return year;
};

const isExpiryInFuture = (monthStr: string | null, yearStr: string | null) => {
  if (!monthStr || !yearStr) return false;
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);
  if (Number.isNaN(month) || Number.isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  year = normalizeYear(year);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year > currentYear) return true;
  if (year < currentYear) return false;
  return month >= currentMonth;
};

const isValidCvc = (value: string | null) => {
  if (!value) return false;
  const trimmed = value.trim();
  return /^\d{3,4}$/.test(trimmed);
};

// Action - Handle form submission and card deletion
export const action: ActionFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  // Handle card deletion
  if (action === "delete") {
    try {
      await deletePaymentMethod(parseInt(userId));
      return { success: true, deleted: true };
    } catch (error: any) {
      return {
        errors: {
          form:
            error.message ||
            "Failed to delete payment method. Please try again.",
        },
      };
    }
  }

  // Handle card addition/update
  const cardholderName = formData.get("cardholderName") as string;
  const cardNumber = formData.get("cardNumber") as string;
  const expiryMonth = formData.get("expiryMonth") as string;
  const expiryYear = formData.get("expiryYear") as string;
  const cvc = formData.get("cvc") as string;
  const billingAddressLine1 = formData.get("billingAddressLine1") as string;
  const billingAddressLine2 =
    (formData.get("billingAddressLine2") as string) || null;
  const billingCity = formData.get("billingCity") as string;
  const billingState = formData.get("billingState") as string;
  const billingZip = formData.get("billingZip") as string;
  const billingCountry = formData.get("billingCountry") as string;
  const email = formData.get("email") as string;

  // Basic validation
  const errors: Record<string, string> = {};

  if (!email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address";
  }

  if (!cardholderName) errors.cardholderName = "Cardholder name is required";
  if (!cardNumber) {
    errors.cardNumber = "Card number is required";
  } else if (!isValidCardNumber(cardNumber)) {
    errors.cardNumber = "Enter a valid card number";
  }
  if (!expiryMonth || !expiryYear) {
    errors.expiry = "Expiry date is required";
  } else if (!isExpiryInFuture(expiryMonth, expiryYear)) {
    errors.expiry = "Card has expired";
  }
  if (!cvc) {
    errors.cvc = "CVC is required";
  } else if (!isValidCvc(cvc)) {
    errors.cvc = "CVC must be 3 or 4 digits";
  }
  if (!billingAddressLine1)
    errors.billingAddressLine1 = "Billing address is required";
  if (!billingCity) errors.billingCity = "City is required";
  if (!billingState) errors.billingState = "State is required";
  if (!billingZip) errors.billingZip = "ZIP code is required";
  if (!billingCountry) errors.billingCountry = "Country is required";

  if (Object.keys(errors).length > 0) {
    return { errors, values: Object.fromEntries(formData) };
  }

  try {
    await createOrUpdatePaymentMethod(parseInt(userId), {
      cardholderName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvc,
      billingAddressLine1,
      billingAddressLine2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      email,
    });
    logger.info(`Payment method saved successfully for ${userId}`, {
      url: request.url,
    });

    return { success: true };
  } catch (error: any) {
    logger.error(`Failed to save payment method: ${error}`, {
      url: request.url,
    });
    return {
      errors: {
        form:
          error.message || "Failed to save payment method. Please try again.",
      },
    };
  }
};

export default function PaymentInformationPage() {
  const navigate = useNavigate();
  const loaderData = useLoaderData<{
    user: any;
    savedPaymentMethod: any;
    roleUser: {
      roleId: number;
      roleName: string;
      userId: number;
    } | null;
    error?: string;
  }>();
  const actionData = useActionData<{
    errors?: Record<string, string>;
    values?: Record<string, any>;
    success?: boolean;
    deleted?: boolean;
  }>();
  const { user, savedPaymentMethod, roleUser } = loaderData;
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const computedBillingCountry =
    actionData?.values?.billingCountry ||
    savedPaymentMethod?.billingCountry ||
    "";
  const [billingCountry, setBillingCountry] = useState(computedBillingCountry);
  useEffect(() => {
    setBillingCountry(computedBillingCountry);
  }, [computedBillingCountry]);

  // Determine which sidebar to show based on role
  const isAdmin =
    roleUser &&
    roleUser.roleId === 2 &&
    roleUser.roleName.toLowerCase() === "admin";
  const isGuest = !roleUser || !roleUser.userId;

  const renderSidebar = () => {
    if (isAdmin) {
      return <AdminAppSidebar />;
    } else if (isGuest) {
      return <GuestAppSidebar />;
    } else {
      return <AppSidebar />;
    }
  };

  // Handle success state
  useEffect(() => {
    if (actionData?.success && !showSuccessMessage) {
      setShowSuccessMessage(true);
      if (actionData.deleted) {
        // If deleted, refresh the page to show empty state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // If saved/updated, redirect to profile
        setTimeout(() => {
          navigate("/dashboard/profile");
        }, 3000);
      }
    }
  }, [actionData, showSuccessMessage, navigate]);

  // Credit card input formatting
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0; i < match.length; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return value;
    }
  };

  const isEditMode = !!savedPaymentMethod;

  return (
    <SidebarProvider>
      <div className="absolute inset-0 flex bg-gray-100">
        {renderSidebar()}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Mobile Header with Sidebar Trigger */}
            <div className="flex items-center gap-4 mb-6 md:hidden">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Payment Info</h1>
            </div>

            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center text-sm text-indigo-600 mb-4 hover:text-indigo-700"
              >
                <svg
                  className="w-4 h-4 mr-1"
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
                Back to Profile
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditMode ? "Payment Method" : "Add Payment Method"}
              </h1>
              <p className="text-gray-600">
                {isEditMode
                  ? "Manage your saved payment method"
                  : "Add a payment method for quick checkout"}
              </p>
            </div>

            {/* Success Message */}
            {showSuccessMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-green-800 font-medium">
                    {actionData?.deleted
                      ? "Payment method removed successfully!"
                      : "Payment method saved successfully!"}
                  </h3>
                  <p className="text-green-700 text-sm">
                    {actionData?.deleted
                      ? "Refreshing page..."
                      : "Redirecting you back to your profile..."}
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {actionData?.errors?.form && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-red-800 font-medium">
                    There was a problem
                  </h3>
                  <p className="text-red-700 text-sm">
                    {actionData.errors.form}
                  </p>
                </div>
              </div>
            )}

            {/* Existing Card Info (if any) */}
            {isEditMode && savedPaymentMethod && (
              <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-indigo-500" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Current Payment Method
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card</span>
                      <span className="font-medium">
                        •••• {savedPaymentMethod.cardLast4}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expires</span>
                      <span className="font-medium">
                        {savedPaymentMethod.cardExpiry}
                      </span>
                    </div>
                    {savedPaymentMethod.email && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Email</span>
                        <span className="font-medium">
                          {savedPaymentMethod.email}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Billing Address</span>
                      <span className="font-medium text-right">
                        {savedPaymentMethod.billingAddressLine1}
                        <br />
                        {savedPaymentMethod.billingAddressLine2 && (
                          <>
                            {savedPaymentMethod.billingAddressLine2}
                            <br />
                          </>
                        )}
                        {savedPaymentMethod.billingCity},{" "}
                        {savedPaymentMethod.billingState}{" "}
                        {savedPaymentMethod.billingZip}
                        <br />
                        {savedPaymentMethod.billingCountry}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-600">
                    To update your payment method, remove the current one and
                    add a new one.
                  </p>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                  <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    onClick={() => setShowDeleteConfirm(false)}
                  />
                  <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                          <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                          <h3 className="text-lg font-medium leading-6 text-gray-900">
                            Remove payment method
                          </h3>
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              Are you sure you want to remove this payment
                              method? You'll need to enter payment details for
                              future purchases.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                      <Form method="post" className="sm:ml-3">
                        <input type="hidden" name="_action" value="delete" />
                        <button
                          type="submit"
                          className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto sm:text-sm"
                        >
                          Remove
                        </button>
                      </Form>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Form - Only show if no saved payment method */}
            {!isEditMode && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Card Information
                    </h3>
                  </div>
                </div>

                <div className="p-6">
                  <Form method="post" noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Card Details Section */}
                      <div className="space-y-6 md:col-span-2">
                        <div>
                          <label
                            htmlFor="cardholderName"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Cardholder Name
                          </label>
                          <input
                            type="text"
                            id="cardholderName"
                            name="cardholderName"
                            className={`w-full px-3 py-2 border rounded-md ${
                              actionData?.errors?.cardholderName
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            }`}
                            placeholder="Name as it appears on card"
                            defaultValue={
                              actionData?.values?.cardholderName ||
                              savedPaymentMethod?.cardholderName ||
                              ""
                            }
                          />
                          {actionData?.errors?.cardholderName && (
                            <p className="mt-1 text-sm text-red-600">
                              {actionData.errors.cardholderName}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Email
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            className={`w-full px-3 py-2 border rounded-md ${
                              actionData?.errors?.email
                                ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            }`}
                            placeholder="you@example.com"
                            defaultValue={
                              actionData?.values?.email || user?.email || ""
                            }
                          />
                          {actionData?.errors?.email && (
                            <p className="mt-1 text-sm text-red-600">
                              {actionData.errors.email}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="cardNumber"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Card Number
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              id="cardNumber"
                              name="cardNumber"
                              className={`w-full px-3 py-2 border rounded-md ${
                                actionData?.errors?.cardNumber
                                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                  : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                              }`}
                              placeholder="1234 5678 9012 3456"
                              maxLength={19}
                              onChange={(e) => {
                                e.target.value = formatCardNumber(
                                  e.target.value
                                );
                              }}
                              defaultValue={
                                actionData?.values?.cardNumber || ""
                              }
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                              <Lock className="h-4 w-4 text-gray-400" />
                            </div>
                          </div>
                          {actionData?.errors?.cardNumber && (
                            <p className="mt-1 text-sm text-red-600">
                              {actionData.errors.cardNumber}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="expiryDate"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Expiry Date
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                id="expiryMonth"
                                name="expiryMonth"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.expiry
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.expiryMonth ||
                                  (savedPaymentMethod?.cardExpiry || "").split(
                                    "/"
                                  )[0] ||
                                  ""
                                }
                              >
                                <option value="">MM</option>
                                {Array.from({ length: 12 }, (_, i) => {
                                  const month = (i + 1)
                                    .toString()
                                    .padStart(2, "0");
                                  return (
                                    <option key={month} value={month}>
                                      {month}
                                    </option>
                                  );
                                })}
                              </select>
                              <select
                                id="expiryYear"
                                name="expiryYear"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.expiry
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.expiryYear ||
                                  (savedPaymentMethod?.cardExpiry || "").split(
                                    "/"
                                  )[1]
                                    ? `20${
                                        (
                                          savedPaymentMethod?.cardExpiry || ""
                                        ).split("/")[1]
                                      }`
                                    : ""
                                }
                              >
                                <option value="">YY</option>
                                {Array.from({ length: 10 }, (_, i) => {
                                  const year = (
                                    new Date().getFullYear() + i
                                  ).toString();
                                  return (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            {actionData?.errors?.expiry && (
                              <p className="mt-1 text-sm text-red-600">
                                {actionData.errors.expiry}
                              </p>
                            )}
                          </div>
                          <div>
                            <label
                              htmlFor="cvc"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              CVC / CVV
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                id="cvc"
                                name="cvc"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.cvc
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                placeholder="123"
                                maxLength={4}
                                defaultValue={actionData?.values?.cvc || ""}
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <Lock className="h-4 w-4 text-gray-400" />
                              </div>
                            </div>
                            {actionData?.errors?.cvc && (
                              <p className="mt-1 text-sm text-red-600">
                                {actionData.errors.cvc}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Billing Address Section */}
                      <div className="md:col-span-2 pt-4 border-t border-gray-200">
                        <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
                          <MapPin className="h-4 w-4 text-indigo-500 mr-2" />
                          Billing Address
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="billingAddressLine1"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Address Line 1
                            </label>
                            <input
                              type="text"
                              id="billingAddressLine1"
                              name="billingAddressLine1"
                              className={`w-full px-3 py-2 border rounded-md ${
                                actionData?.errors?.billingAddressLine1
                                  ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                  : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                              }`}
                              placeholder="Street address"
                              defaultValue={
                                actionData?.values?.billingAddressLine1 ||
                                savedPaymentMethod?.billingAddressLine1 ||
                                ""
                              }
                            />
                            {actionData?.errors?.billingAddressLine1 && (
                              <p className="mt-1 text-sm text-red-600">
                                {actionData.errors.billingAddressLine1}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="billingAddressLine2"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Address Line 2{" "}
                              <span className="text-gray-500">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              id="billingAddressLine2"
                              name="billingAddressLine2"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Apartment, suite, unit, etc."
                              defaultValue={
                                actionData?.values?.billingAddressLine2 ||
                                savedPaymentMethod?.billingAddressLine2 ||
                                ""
                              }
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor="billingCity"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                City
                              </label>
                              <input
                                type="text"
                                id="billingCity"
                                name="billingCity"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.billingCity
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.billingCity ||
                                  savedPaymentMethod?.billingCity ||
                                  ""
                                }
                              />
                              {actionData?.errors?.billingCity && (
                                <p className="mt-1 text-sm text-red-600">
                                  {actionData.errors.billingCity}
                                </p>
                              )}
                            </div>
                            <div>
                              <label
                                htmlFor="billingState"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                State / Province
                              </label>
                              <input
                                type="text"
                                id="billingState"
                                name="billingState"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.billingState
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.billingState ||
                                  savedPaymentMethod?.billingState ||
                                  ""
                                }
                              />
                              {actionData?.errors?.billingState && (
                                <p className="mt-1 text-sm text-red-600">
                                  {actionData.errors.billingState}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label
                                htmlFor="billingZip"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                ZIP / Postal Code
                              </label>
                              <input
                                type="text"
                                id="billingZip"
                                name="billingZip"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.billingZip
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.billingZip ||
                                  savedPaymentMethod?.billingZip ||
                                  ""
                                }
                              />
                              {actionData?.errors?.billingZip && (
                                <p className="mt-1 text-sm text-red-600">
                                  {actionData.errors.billingZip}
                                </p>
                              )}
                            </div>
                            <div>
                              <label
                                htmlFor="billingCountry"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Country
                              </label>
                              <CountryDropdown
                                value={billingCountry}
                                onChange={(code) => setBillingCountry(code)}
                                placeholder="Select country"
                                error={actionData?.errors?.billingCountry}
                                disabled={isEditMode}
                              />
                              <input
                                type="hidden"
                                id="billingCountry"
                                name="billingCountry"
                                value={billingCountry || ""}
                              />
                              {actionData?.errors?.billingCountry && (
                                <p className="mt-1 text-sm text-red-600">
                                  {actionData.errors.billingCountry}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard/profile")}
                        className="mr-4 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-indigo-500 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Save Payment Method
                      </button>
                    </div>
                  </Form>
                </div>
              </div>
            )}

            {/* Security Information */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Secure Payment Processing
                  </h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center w-full md:w-auto">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="76.57"
                      height="32"
                      viewBox="0 0 512 214"
                    >
                      <path
                        fill="#635BFF"
                        d="M512 110.08c0-36.409-17.636-65.138-51.342-65.138c-33.85 0-54.33 28.73-54.33 64.854c0 42.808 24.179 64.426 58.88 64.426c16.925 0 29.725-3.84 39.396-9.244v-28.445c-9.67 4.836-20.764 7.823-34.844 7.823c-13.796 0-26.027-4.836-27.591-21.618h69.547c0-1.85.284-9.245.284-12.658m-70.258-13.511c0-16.071 9.814-22.756 18.774-22.756c8.675 0 17.92 6.685 17.92 22.756zm-90.31-51.627c-13.939 0-22.899 6.542-27.876 11.094l-1.85-8.818h-31.288v165.83l35.555-7.537l.143-40.249c5.12 3.698 12.657 8.96 25.173 8.96c25.458 0 48.64-20.48 48.64-65.564c-.142-41.245-23.609-63.716-48.498-63.716m-8.534 97.991c-8.391 0-13.37-2.986-16.782-6.684l-.143-52.765c3.698-4.124 8.818-6.968 16.925-6.968c12.942 0 21.902 14.506 21.902 33.137c0 19.058-8.818 33.28-21.902 33.28M241.493 36.551l35.698-7.68V0l-35.698 7.538zm0 10.809h35.698v124.444h-35.698zm-38.257 10.524L200.96 47.36h-30.72v124.444h35.556V87.467c8.39-10.951 22.613-8.96 27.022-7.396V47.36c-4.551-1.707-21.191-4.836-29.582 10.524m-71.112-41.386l-34.702 7.395l-.142 113.92c0 21.05 15.787 36.551 36.836 36.551c11.662 0 20.195-2.133 24.888-4.693V140.8c-4.55 1.849-27.022 8.391-27.022-12.658V77.653h27.022V47.36h-27.022zM35.982 83.484c0-5.546 4.551-7.68 12.09-7.68c10.808 0 24.461 3.272 35.27 9.103V51.484c-11.804-4.693-23.466-6.542-35.27-6.542C19.2 44.942 0 60.018 0 85.192c0 39.252 54.044 32.995 54.044 49.92c0 6.541-5.688 8.675-13.653 8.675c-11.804 0-26.88-4.836-38.827-11.378v33.849c13.227 5.689 26.596 8.106 38.827 8.106c29.582 0 49.92-14.648 49.92-40.106c-.142-42.382-54.329-34.845-54.329-50.774"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm mb-2">
                      Your payment information is processed securely through
                      Stripe. We never store your full card details on our
                      servers.
                    </p>
                    <p className="text-gray-600 text-sm">
                      This page is protected with SSL encryption. Your personal
                      information is secure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
