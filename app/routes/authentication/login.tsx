import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLoaderData, Form as RouterForm } from "react-router";
import { loginSchema } from "../../schemas/loginSchema";
import type { LoginFormValues } from "../../schemas/loginSchema";
import type { Route } from "./+types/login";
import { login, createUserSession, getUser } from "~/utils/session.server";
import GenericFormField from "@/components/ui/GenericFormField";

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  const result = await login(rawValues);

  if (!result) {
    return { errors: { database: "Invalid email or password." } };
  }

  if ("errors" in result) {
    return { errors: result.errors };
  }

  const redirectTo =
    result.roleUserId === 2 ? "/dashboard/admin" : "/dashboard/user";
  return createUserSession(result.id, redirectTo);
}

interface ActionData {
  errors?: Record<string, string[]>;
  success?: boolean;
}

export default function Login({ actionData }: { actionData?: ActionData }) {
  const loaderData = useLoaderData<{
    user: { id: number; email: string } | null;
  }>();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
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
      const listener = () => handleSubmission();
      formRef.current.addEventListener("submit", listener);
      return () => formRef.current?.removeEventListener("submit", listener);
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
        <div className="flex flex-col items-center mb-6">
          <img
            src="public/images/Makerspace Horizontal Text Logo Colour-01.avif"
            alt="Makerspace Logo"
            className="h-16 mb-2"
          />
        </div>

        {user ? (
          <div className="text-center">
            <p className="text-lg font-medium mb-4">
              You are currently logged in as <strong>{user.email}</strong> (ID:{" "}
              {user.id})
            </p>
            <RouterForm action="/logout" method="post">
              <Button
                type="submit"
                className="mt-4 w-full bg-red-500 hover:bg-red-600 text-white"
              >
                {loading ? "Logging out..." : "Logout"}
              </Button>
            </RouterForm>
          </div>
        ) : (
          <>
            {hasErrors && (
              <div className="mb-4 text-sm text-red-600 bg-red-100 border border-red-400 rounded p-2">
                Invalid email or password. Please try again.
              </div>
            )}

            <Form {...form}>
              <form method="post" ref={formRef} className="space-y-2">
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
                  placeholder="Password"
                  type="password"
                  required
                  error={actionData?.errors?.password}
                  className="w-full"
                />

                <Button
                  type="submit"
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}
