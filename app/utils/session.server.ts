import {
  createCookieSessionStorage,
  redirect,
  Form as RouterForm,
} from "react-router";
import bcrypt from "bcryptjs";
import { db } from "./db.server";
import { registerSchema } from "../schemas/registrationSchema";
import { loginSchema } from "../schemas/loginSchema";
import { PrismaClient, Prisma } from "@prisma/client";
import path from "path";
import fs from "fs/promises";

export async function register(rawValues: Record<string, any>) {
  try {
    // Validate the incoming form data using the Zod schema
    const parsed = registerSchema.safeParse(rawValues);

    if (!parsed.success) {
      // If validation fails, return errors
      const errors = parsed.error.flatten();
      return { errors: errors.fieldErrors };
    }

    const data = parsed.data;

    const guardianSignedConsent = rawValues.guardianSignedConsent;
    if (
      guardianSignedConsent instanceof File &&
      guardianSignedConsent.size > 0
    ) {
      // Define the storage directory relative to project root
      const storageDir = path.join(process.cwd(), "app", "storage");

      // Ensure the storage directory exists
      await fs.mkdir(storageDir, { recursive: true });

      // Create a unique file name
      const fileName = `${Date.now()}_${guardianSignedConsent.name}`;
      const filePath = path.join(storageDir, fileName);

      // Save the file to the storage directory
      const fileBuffer = await guardianSignedConsent.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(fileBuffer));

      // Add the file name to the data
      data.guardianSignedConsent = fileName;
    } else {
      data.guardianSignedConsent = null;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Insert the new user into the database
    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || "",
        address: data.address || "",
        over18: data.over18 ?? null,
        photoRelease: data.photoRelease ?? null,
        dataPrivacy: data.dataPrivacy ?? null,
        parentGuardianName: data.parentGuardianName || null,
        parentGuardianPhone: data.parentGuardianPhone || null,
        parentGuardianEmail: data.parentGuardianEmail || null,
        guardianSignedConsent: data.guardianSignedConsent || null,
        emergencyContactName: data.emergencyContactName || "",
        emergencyContactPhone: data.emergencyContactPhone || "",
        emergencyContactEmail: data.emergencyContactEmail || "",
        trainingCardUserNumber: data.trainingCardUserNumber || -1,
      },
      select: {
        id: true,
        email: true,
      },
    });

    // Return success message
    return { id: user.id, email: user.email };
  } catch (error) {
    // Handle errors
    console.error("Error saving data:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Handle unique constraint error for email
      return {
        errors: {
          email: ["This email is already registered."],
        },
      };
    }

    return null; // Return null if registration fails
  }
}

export async function login(rawValues: Record<string, any>) {
  // Validate the incoming form data using the Zod schema
  const parsed = loginSchema.safeParse(rawValues);

  if (!parsed.success) {
    // If validation fails, return errors
    const errors = parsed.error.flatten();
    console.log(errors.fieldErrors);
    return { errors: errors.fieldErrors };
  }

  const data = parsed.data;

  const user = await db.user.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      email: true,
      password: true,
      roleUserId: true,
    },
  });

  if (!user) {
    // Return an error if the user is not registered
    return { errors: { email: ["This email is not registered."] } };
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    // Return an error if the password is incorrect
    return { errors: { password: ["Incorrect password."] } };
  }

  return {
    id: user.id,
    email: user.email,
    roleUserId: user.roleUserId,
  };
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    // normally you want this to be `secure: true`
    // but that doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
  },
});

function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    return null;
  }
  return userId;
}

export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  const user = await db.user.findUnique({
    select: { id: true, email: true },
    where: { id: parseInt(userId) },
  });

  if (!user) {
    throw await logout(request);
  }

  return user;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

export async function createUserSession(userId: number, redirectTo: string) {
  const session = await storage.getSession();
  session.set("userId", userId.toString());
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

export async function getRoleUser(request: Request) {
  const userId = await getUserId(request);

  if (userId) {
    const userWithRole = await db.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        roleUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (userWithRole) {
      return {
        userId: userWithRole.id,
        roleId: userWithRole.roleUser.id,
        roleName: userWithRole.roleUser.name,
      };
    }
  }
  return null;
}

