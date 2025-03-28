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
      return () =>
        formRef.current?.removeEventListener("submit", listener);
    }
  }, []);

  React.useEffect(() => {
    if (actionData?.success || actionData?.errors) {
      setLoading(false);
    }
  }, [actionData]);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold text-center mb-4">Login</h1>

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
          {hasErrors && (
            <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
              Invalid email or password. Please try again.
            </div>
          )}

          <Form {...form}>
            <form method="post" ref={formRef}>
              {/* Email Field using GenericFormField */}
              <GenericFormField
                control={form.control}
                name="email"
                label="Email"
                placeholder="your@email.com"
                required
                error={actionData?.errors?.email}
              />

              {/* Password Field using GenericFormField */}
              <GenericFormField
                control={form.control}
                name="password"
                label="Password"
                placeholder="Password"
                type="password"
                required
                error={actionData?.errors?.password}
              />

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button type="submit" className="mt-4" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
}
