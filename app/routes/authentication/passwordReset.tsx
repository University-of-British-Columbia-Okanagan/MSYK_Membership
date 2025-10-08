import jwt from 'jsonwebtoken';
import { redirect } from "react-router-dom";
import { findUserByEmail, updateUserPassword } from '~/utils/session.server';
import { useEffect, useState } from "react";
import { sendResetEmail } from '~/utils/email.server';
import { resetPasswordSchema } from "../../schemas/resetPasswordSchema";


export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const requestType = form.get("requestType") as string | null;

  if (!requestType) throw new Response("Invalid Request", {status: 419,});
  if (requestType == "resetPassword") {
    const token = form.get("token") as string | null;
    const newPassword = form.get("newPassword") as string | null;
    if (!token || !newPassword) throw new Response("Invalid Request", {status: 419,});

    const parseResult = resetPasswordSchema.safeParse({ newPassword });
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors
        .map((e) => e.message)
        .join(", ");
      throw new Response(errorMessage, { status: 400 });
    }

    var decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      throw new Response("Invalid token", {status: 419,});
    }

    if (typeof decoded !== "object" || decoded === null || !("email" in decoded)) throw new Response("Invalid Request", {status: 419,});
    const userEmail = decoded.email;

    const user = await findUserByEmail(userEmail);
    if (!user) throw new Response("User with this email does not exists", {status: 404,});

    await updateUserPassword(userEmail, newPassword);

    return redirect("/login");
  } else if (requestType == "sendEmail") {
      const email = form.get("email") as string | null;
      if (!email) throw new Response("Invalid Request", {status: 419,});
      const user = await findUserByEmail(email);
      if (!user) throw new Response("User with this email does not exists", {status: 404,});
      await sendResetEmail(email);
      return new Response("Reset email sent", { status: 200 });
  }
}

export default function ForgotPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Added confirm password
  const [status, setStatus] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setToken(urlParams.get("token"));
  }, []);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Sending reset email...");
    try {
      const res = await fetch("/passwordReset", {
        method: "POST",
        body: new URLSearchParams({
          requestType: "sendEmail",
          email,
        }),
      });
      if (res.ok) setStatus("Reset email sent! Check your inbox.");
      else if (res.status == 404) setStatus("No account with that email was found");
      else setStatus(`Error: ${await res.text()}`);
    } catch {
      setStatus("Something went wrong.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus("Passwords do not match!");
      return;
    }

    setStatus("Resetting password...");
    try {
      const res = await fetch("/passwordReset", {
        method: "POST",
        body: new URLSearchParams({
          requestType: "resetPassword",
          token: token || "",
          newPassword,
        }),
      });
      if (res.redirected) window.location.href = res.url;
      else if (res.status === 400) setStatus("Password must be at least 6 charachters long");
      else setStatus(`Some Unexpected Error Occurred`);
    } catch {
      setStatus("Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-indigo-400 rounded-xl shadow-md p-8">
        <div className="flex flex-col items-center mb-6">
          <img
            src="images/Makerspace Horizontal Text Logo Colour-01.avif"
            alt="Makerspace Logo"
            className="h-16 mb-2"
          />
        </div>

        {!token ? (
          <>
            <h2 className="text-l font-semibold text-center mb-6">Forgot Password</h2>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded"
              >
                Send Reset Link
              </button>
            </form>
            {status && <p className="mt-4 text-sm text-gray-600 text-center">{status}</p>}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-center mb-6">Reset Your Password</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded"
              >
                Reset Password
              </button>
            </form>
            {status && <p className="mt-4 text-sm text-gray-600 text-center">{status}</p>}
          </>
        )}
      </div>
    </div>
  );
}
