import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { type ActionFunctionArgs, redirect } from "react-router";
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
import type { Route } from "./+types/login";
import { loginSchema } from "../../schemas/loginSchema";
import type { LoginFormValues } from "../../schemas/loginSchema";
import { login, createUserSession, getUser } from "~/utils/session.server";
import { useLoaderData, Form as RouterForm } from "react-router";

export async function loader({ request }: { request: Request }) {
  const user = await getUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  // Convert FormData to a plain object
  const rawValues: Record<string, any> = Object.fromEntries(formData.entries());

  const result = await login(rawValues);

  if (!result) {
    return { errors: { database: "Invalid email or password." } };
  }

  if ("errors" in result) {
    return { errors: result.errors };
  }

  return createUserSession(result.id, "/membership"); // Redirect to a protected route on success
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
      const formElement = formRef.current;
      const listener = () => handleSubmission();
      formElement.addEventListener("submit", listener);

      return () => formElement.removeEventListener("submit", listener);
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
          {/* Show error message for invalid credentials */}
          {hasErrors && (
            <div className="mb-8 text-sm text-red-500 bg-red-100 border-red-400 rounded p-2">
              Invalid email or password. Please try again.
            </div>
          )}

          <Form {...form}>
            <form method="post" ref={formRef}>
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your@email.com" {...field} />
                    </FormControl>
                    <FormMessage>{actionData?.errors?.email}</FormMessage>
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{actionData?.errors?.password}</FormMessage>
                  </FormItem>
                )}
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
