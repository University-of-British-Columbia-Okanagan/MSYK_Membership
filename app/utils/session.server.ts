import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { db } from "./db.server";
import { registerSchema } from "../schemas/registrationSchema";
import { loginSchema } from "../schemas/loginSchema";
import { Prisma } from "@prisma/client";

/**
 * Registers a new user account with validation
 * @param data - User registration data including email, password, and profile information
 * @returns Promise<Object> - User object or error object with validation errors
 */
export async function register(rawValues: Record<string, any>) {
  try {
    // Validate the incoming form data using the Zod schema
    const parsed = registerSchema.safeParse(rawValues);

    if (!parsed.success) {
      // If validation fails, return errors
      const errors = parsed.error.flatten();
      console.log("Validation errors:", errors.fieldErrors);
      return { errors: errors.fieldErrors };
    }

    const data = parsed.data;

    // Handle digital signature as base64 string instead of file
    let guardianSignedConsentData = null;
    const guardianSignedConsent = rawValues.guardianSignedConsent;

    if (
      typeof guardianSignedConsent === "string" &&
      guardianSignedConsent.trim() !== "" &&
      guardianSignedConsent.startsWith("data:image/")
    ) {
      // Uncomment the following line if you want to store the raw base64 string
      // guardianSignedConsentData = guardianSignedConsent;

      // Hash the base64 signature data like a password
      guardianSignedConsentData = await bcrypt.hash(guardianSignedConsent, 10);
    } else {
      guardianSignedConsentData = null;
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
        over18: data.over18 ?? false,
        photoRelease: data.photoRelease ?? false,
        dataPrivacy: data.dataPrivacy ?? false,
        parentGuardianName: data.parentGuardianName || null,
        parentGuardianPhone: data.parentGuardianPhone || null,
        parentGuardianEmail: data.parentGuardianEmail || null,
        guardianSignedConsent: guardianSignedConsentData, // Store base64 string
        emergencyContactName: data.emergencyContactName || "",
        emergencyContactPhone: data.emergencyContactPhone || "",
        emergencyContactEmail: data.emergencyContactEmail || "",
      },
      select: {
        id: true,
        email: true,
        guardianSignedConsent: true,
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

/**
 * Authenticates a user with email and password
 * @param data - Object containing email and password
 * @returns Promise<Object> - User data with id, email, roleUserId, and password, or error object
 */
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
    password: data.password,
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

/**
 * Retrieves the session from the request cookie
 * @param request - The HTTP request object
 * @returns Promise<Session> - The session object from the cookie
 */
function getUserSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

/**
 * Extracts and validates the user ID from the session
 * @param request - The HTTP request object
 * @returns Promise<string|null> - The user ID if valid session, null otherwise
 */
export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  const userPassword = session.get("userPassword");
  if (!userId || typeof userId !== "string" || !userPassword) {
    await logout(request);
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: Number(userId) },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    await logout(request);
    return null;
  }

  const isPasswordValid = await bcrypt.compare(userPassword, user.password);
  if (!isPasswordValid) {
    await logout(request);
    return null;
  }

  return userId;
}

/**
 * Retrieves the current user's basic information from session
 * @param request - The HTTP request object
 * @returns Promise<Object|null> - User object with id, email, roleLevel, or null if not found
 * @throws Logout redirect if user not found
 */
export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  const user = await db.user.findUnique({
    select: {
      id: true,
      email: true,
      roleLevel: true,
    },
    where: { id: parseInt(userId) },
  });

  if (!user) {
    throw await logout(request);
  }

  return user;
}

/**
 * Destroys the user session and redirects to login page
 * @param request - The HTTP request object
 * @returns Promise<Response> - Redirect response to login page
 */
export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await storage.destroySession(session),
    },
  });
}

/**
 * Creates a new user session and redirects to specified URL
 * @param userId - The ID of the user to create session for
 * @param password - The user's password to store in session
 * @param redirectTo - The URL to redirect to after session creation
 * @returns Promise<Response> - Redirect response with session cookie
 */
export async function createUserSession(
  userId: number,
  password: string,
  redirectTo: string
) {
  const session = await storage.getSession();
  session.set("userId", userId.toString());
  session.set("userPassword", password);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await storage.commitSession(session),
    },
  });
}

/**
 * Retrieves user information with their role details
 * @param request - The HTTP request object
 * @returns Promise<Object|null> - Object with userId, roleId, and roleName, or null if not found
 */
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
