import { useState } from "react";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";

interface QuickCheckoutProps {
  userId: number;
  checkoutData: {
    type: "workshop" | "equipment" | "membership";
    workshopId?: number;
    occurrenceId?: number;
    connectId?: number;
    equipmentId?: number;
    slotCount?: number;
    slots?: string[];
    slotsDataKey?: string;
    membershipPlanId?: number;
    price?: number;
    currentMembershipId?: number;
    upgradeFee?: number;
    variationId?: number | null;
  };
  itemName: string;
  itemPrice: number;
  gstPercentage: number;
  savedCard: {
    cardLast4: string;
    cardExpiry: string;
  };
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function QuickCheckout({
  userId,
  checkoutData,
  itemName,
  itemPrice,
  gstPercentage,
  savedCard,
  onSuccess,
  onError,
}: QuickCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleQuickCheckout = async () => {
    setIsProcessing(true);
    setStatus("idle");

    try {
      const response = await fetch("/dashboard/paymentprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutData,
          userId,
          useSavedCard: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus("success");
        onSuccess?.();
        // Redirect to success page after a brief delay
        setTimeout(() => {
          if (checkoutData.type === "equipment") {
            // For equipment, include equipment_id and slots_data_key in the URL and include payment intent ID in the redirect URL
            window.location.href = `/dashboard/payment/success?quick_checkout=true&type=${checkoutData.type}&equipment_id=${checkoutData.equipmentId}&slots_data_key=${checkoutData.slotsDataKey}&payment_intent_id=${result.paymentIntentId}`;
          } else {
            // For other types (workshop, membership), use the regular redirect
            window.location.href = `/dashboard/payment/success?quick_checkout=true&type=${checkoutData.type}`;
          }
        }, 2000);
      } else if (result.requiresAction) {
        setErrorMessage(
          "Payment requires additional authentication. Please use regular checkout below."
        );
        setStatus("error");
        onError?.("Payment requires additional authentication");
      } else {
        setErrorMessage(result.error || "Payment failed");
        setStatus("error");
        onError?.(result.error || "Payment failed");
      }
    } catch (error: any) {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
      onError?.(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (status === "success") {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-green-800">
              Payment Successful!
            </h3>
            <p className="text-green-700">
              Charged CA${(itemPrice * (1 + gstPercentage / 100)).toFixed(2)} to
              card ending in {savedCard.cardLast4}
            </p>
            <p className="text-sm text-green-600 mt-1">
              Redirecting you to confirmation page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-red-800">
              Payment Failed
            </h3>
            <p className="text-red-700 text-sm">{errorMessage}</p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-3 text-sm text-red-600 hover:text-red-700 underline font-medium"
            >
              Try quick checkout again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-2 border-indigo-300 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full flex items-center justify-center shadow-md">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="ml-4">
          <h3 className="text-lg font-bold text-gray-900">Quick Checkout</h3>
          <p className="text-sm text-gray-600">
            Pay instantly with your saved card
          </p>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Item:</span>
          <span className="text-sm font-semibold text-gray-900">
            {itemName}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">Amount:</span>
          <span className="text-lg font-bold text-green-600">
            CA${(itemPrice * (1 + gstPercentage / 100)).toFixed(2)}{" "}
            {/* Display price with dynamic GST */}
          </span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Includes GST:</span>
          <span className="text-xs text-gray-600">
            CA${(itemPrice * (gstPercentage / 100)).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">
            Payment Method:
          </span>
          <div className="flex items-center">
            <CreditCard className="h-4 w-4 text-gray-500 mr-1" />
            <span className="text-sm font-medium text-gray-900">
              •••• {savedCard.cardLast4}
            </span>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <button
        onClick={handleQuickCheckout}
        disabled={isProcessing}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md transition-all duration-200 flex items-center justify-center ${
          isProcessing
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 hover:shadow-lg transform hover:-translate-y-0.5"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Clock className="h-5 w-5 mr-2" />
            Pay CA${(itemPrice * (1 + gstPercentage / 100)).toFixed(2)} Now{" "}
            {/* Display total with dynamic GST */}
          </>
        )}
      </button>

      {/* Benefits */}
      <div className="mt-3 text-xs text-gray-600 text-center">
        ✓ Instant confirmation • ✓ No form filling • ✓ Secure payment
      </div>
    </div>
  );
}
