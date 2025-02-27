import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const workshopId = searchParams.get("workshopId");
  const occurrenceId = searchParams.get("occurrenceId");
  const userId = searchParams.get("userId");

  useEffect(() => {
    const registerUser = async () => {
      try {
        const response = await fetch("/dashboard/register", {
          method: "POST",
          body: JSON.stringify({ occurrenceId, userId }),
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (data.success) {
          setMessage("🎉 Registration successful! A confirmation email has been sent.");
        } else {
          setMessage("Registration failed: " + data.error);
        }
      } catch (error) {
        setMessage("Error registering: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    registerUser();
  }, [occurrenceId]);

  return (
    <div className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Payment Successful!</h2>
      {loading ? <p>Processing registration...</p> : <p>{message}</p>}
      <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded" onClick={() => navigate("/dashboard/workshops")}>
        Back to Workshops
      </button>
    </div>
  );
}
