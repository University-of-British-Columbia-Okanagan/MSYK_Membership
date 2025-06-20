import { useState, useEffect } from "react";
import {
  useNavigate,
  useLoaderData,
  useActionData,
  Form,
} from "react-router-dom";
import type { ActionFunction, LoaderFunction } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import Sidebar from "../../components/ui/Dashboard/sidebar";
import { getUserId } from "~/utils/session.server";
import { getProfileDetails } from "~/models/profile.server";
import { getSavedPaymentMethod } from "~/models/user.server";
import {
  deletePaymentMethod,
  createOrUpdatePaymentMethod,
} from "~/models/payment.server";
import {
  CreditCard,
  CheckCircle,
  User,
  Lock,
  AlertCircle,
  Calendar,
  MapPin,
  Trash2,
} from "lucide-react";

// Loader - Get user information and any existing payment method
export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) {
    return { error: "Unauthorized" };
  }

  const user = await getProfileDetails(request);
  const savedPaymentMethod = await getSavedPaymentMethod(parseInt(userId));

  return { user, savedPaymentMethod };
};

// Action - Handle form submission and card deletion
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
  if (!cardNumber || cardNumber.replace(/\s/g, "").length !== 16)
    errors.cardNumber = "Valid card number is required";
  if (!expiryMonth || !expiryYear) errors.expiry = "Expiry date is required";
  if (!cvc || cvc.length < 3 || cvc.length > 4)
    errors.cvc = "Valid CVC is required";
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

    return { success: true };
  } catch (error: any) {
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
    error?: string;
  }>();
  const actionData = useActionData<{
    errors?: Record<string, string>;
    values?: Record<string, any>;
    success?: boolean;
    deleted?: boolean;
  }>();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { user, savedPaymentMethod } = loaderData;

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
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center text-sm text-yellow-600 mb-4 hover:text-yellow-700"
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
                      <CreditCard className="h-5 w-5 text-yellow-500" />
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
                    <CreditCard className="h-5 w-5 text-yellow-500" />
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
                                : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                  : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                          {/* <p className="mt-1 text-xs text-gray-500">
                            For testing, use: 4242 4242 4242 4242
                          </p> */}
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                          <MapPin className="h-4 w-4 text-yellow-500 mr-2" />
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
                                  : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
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
                              <select
                                id="billingCountry"
                                name="billingCountry"
                                className={`w-full px-3 py-2 border rounded-md ${
                                  actionData?.errors?.billingCountry
                                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                                    : "border-gray-300 focus:ring-yellow-500 focus:border-yellow-500"
                                }`}
                                defaultValue={
                                  actionData?.values?.billingCountry ||
                                  savedPaymentMethod?.billingCountry ||
                                  ""
                                }
                              >
                                <option value="">Select Country</option>
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="MX">Mexico</option>
                                <option value="UK">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="NZ">New Zealand</option>
                                <option value="JP">Japan</option>
                                <option value="FR">France</option>
                                <option value="DE">Germany</option>
                                <option value="IT">Italy</option>
                                {/* Add more countries as needed */}
                              </select>
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
                        className="mr-4 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-yellow-500 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
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
                  <Lock className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Secure Payment Processing
                  </h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                  <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center w-full md:w-auto">
                    <svg
                      width="100"
                      height="40"
                      viewBox="0 0 60 25"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M28.7 10.9c-0.8-0.2-0.8-0.3-0.8-0.5 0-0.2 0.2-0.3 0.6-0.3 0.2 0 0.5 0 0.9 0.2 0.1 0 0.2 0.1 0.3 0.1 0.2 0 0.3-0.1 0.4-0.3l0.2-0.6c0-0.2-0.1-0.3-0.2-0.4C29.7 8.9 29.2 8.8 28.6 8.8c-1.5 0-2.4 0.8-2.4 2 0 1 0.6 1.5 1.9 1.8 0.8 0.2 0.8 0.3 0.8 0.5 0 0.3-0.2 0.4-0.8 0.4 -0.4 0-0.8-0.1-1.1-0.2 -0.1 0-0.2-0.1-0.3-0.1 -0.2 0-0.3 0.1-0.4 0.3l-0.2 0.6c-0.1 0.2 0 0.3 0.1 0.4 0.3 0.2 0.9 0.4 1.9 0.4 1.5 0 2.5-0.8 2.5-2.1C30.6 11.7 30 11.2 28.7 10.9M22.1 14.3h-1.1c-0.4 0-0.7-0.3-0.7-0.7V9.6c0-0.4 0.3-0.7 0.7-0.7h1.1c0.4 0 0.7 0.3 0.7 0.7v4.1C22.7 14 22.5 14.3 22.1 14.3M22.5 8.1h-1.8c-0.3 0-0.5-0.2-0.5-0.5V6.7c0-0.3 0.2-0.5 0.5-0.5h1.8c0.3 0 0.5 0.2 0.5 0.5v0.9C23 7.9 22.8 8.1 22.5 8.1M18.5 14.3h-1.1c-0.4 0-0.7-0.3-0.7-0.7v-4.7h-1.3c-0.4 0-0.7-0.3-0.7-0.7V7.3c0-0.4 0.3-0.7 0.7-0.7h1.3V5.9c0-0.8 0.2-1.4 0.7-1.9C17.7 3.5 18.3 3.3 19 3.3c0.3 0 0.5 0 0.7 0.1 0.2 0.1 0.3 0.2 0.3 0.4v0.8c0 0.2-0.1 0.4-0.3 0.4 -0.1 0-0.1 0-0.2 0 -0.5 0-0.7 0.2-0.7 0.8v0.8h1c0.4 0 0.7 0.3 0.7 0.7v0.9c0 0.4-0.3 0.7-0.7 0.7h-1v4.7C19.2 14 18.9 14.3 18.5 14.3M10.9 9c-0.5 0-0.9 0.2-1.2 0.6 -0.3 0.4-0.5 0.9-0.5 1.5 0 0.7 0.2 1.2 0.5 1.5 0.3 0.4 0.7 0.6 1.2 0.6 0.5 0 0.9-0.2 1.2-0.5 0.3-0.4 0.5-0.9 0.5-1.5 0-0.7-0.2-1.2-0.5-1.5C11.8 9.2 11.4 9 10.9 9 10.9 9 10.9 9 10.9 9M10.9 14.7c-0.5 0-0.9-0.1-1.4-0.3 -0.4-0.2-0.8-0.5-1.1-0.8s-0.5-0.8-0.7-1.3c-0.2-0.5-0.2-1-0.2-1.5 0-0.5 0.1-1 0.2-1.5 0.2-0.5 0.4-0.9 0.7-1.3 0.3-0.4 0.7-0.6 1.1-0.8 0.4-0.2 0.9-0.3 1.4-0.3 0.5 0 0.9 0.1 1.4 0.3 0.4 0.2 0.8 0.5 1.1 0.8 0.3 0.4 0.5 0.8 0.7 1.3 0.2 0.5 0.2 1 0.2 1.5 0 0.5-0.1 1-0.2 1.5 -0.2 0.5-0.4 0.9-0.7 1.3 -0.3 0.4-0.7 0.6-1.1 0.8C11.9 14.6 11.4 14.7 10.9 14.7M6.7 6.7C6.3 6.5 5.9 6.5 5.5 6.5c-0.5 0-1 0.1-1.4 0.3S3.3 7.3 3 7.7C2.7 8 2.4 8.5 2.3 9c-0.2 0.5-0.3 1-0.3 1.6 0 0.6 0.1 1.1 0.3 1.6 0.2 0.5 0.4 0.9 0.7 1.3 0.3 0.4 0.7 0.6 1.1 0.8 0.4 0.2 0.9 0.3 1.5 0.3 0.8 0 1.5-0.2 2.1-0.6 0.2-0.1 0.2-0.3 0.2-0.5 0-0.3-0.3-0.4-0.5-0.4 -0.1 0-0.2 0-0.3 0.1 -0.5 0.3-0.9 0.4-1.5 0.4 -0.7 0-1.3-0.2-1.7-0.7C2.6 12.4 2.3 11.8 2.3 11h5.5c0.4 0 0.7-0.3 0.7-0.7 0-0.7-0.1-1.3-0.2-1.8 -0.2-0.5-0.4-0.9-0.6-1.2 -0.3-0.3-0.6-0.5-0.9-0.7M5.5 7.5c0.6 0 1.1 0.2 1.4 0.5C7.3 8.3 7.5 8.8 7.6 9.5H2.3c0.1-0.7 0.4-1.3 0.8-1.6C3.6 7.7 4.2 7.5 4.8 7.5 4.9 7.5 5 7.5 5.1 7.5c0.1 0 0.2 0 0.3 0 0 0 0.1 0 0.1 0C5.5 7.5 5.5 7.5 5.5 7.5"
                        fill="#635BFF"
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
