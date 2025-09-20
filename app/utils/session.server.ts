import { createCookieSessionStorage, redirect } from "react-router";
import bcrypt from "bcryptjs";
import { db } from "./db.server";
import { registerSchema } from "../schemas/registrationSchema";
import { loginSchema } from "../schemas/loginSchema";
import { Prisma } from "@prisma/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import CryptoJS from "crypto-js";
import { sendRegistrationConfirmationEmail } from "./email.server";

/**
 * Generates a digitally signed and encrypted waiver PDF document
 *
 * This function takes a PDF template, overlays the user's information (name, signature, date),
 * and returns an encrypted version of the signed document for secure storage.
 *
 * @param firstName - The user's first name to be printed on the waiver
 * @param lastName - The user's last name to be printed on the waiver
 * @param signatureDataURL - Base64 encoded PNG signature image data (must start with "data:image/")
 * @returns Promise<string> - AES encrypted base64 string of the signed PDF document
 *
 * @throws Error - Throws "Failed to generate signed waiver" if PDF generation fails
 *
 * @example
 * ```typescript
 * const encryptedWaiver = await generateSignedWaiver(
 *   "John",
 *   "Doe",
 *   "data:image/png;base64,iVBORw0KGgo..."
 * );
 * ```
 *
 * @security
 * - Uses AES encryption with key from WAIVER_ENCRYPTION_KEY environment variable
 * - Signature is embedded as PNG image on page 2 of the PDF template
 * - All user data is positioned using fixed coordinates for consistent layout
 *
 * @dependencies
 * - Requires "msyk-waiver-template.pdf" in public/documents/ directory
 * - Uses pdf-lib library for PDF manipulation
 * - Uses crypto-js for AES encryption
 */
async function generateSignedWaiver(
  firstName: string,
  lastName: string,
  signatureDataURL: string
): Promise<string> {
  try {
    // Read the waiver PDF template
    const templatePath = path.join(
      process.cwd(),
      "public",
      "documents",
      "msyk-waiver-template.pdf"
    );

    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    const secondPage = pages[1];

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const baseX = 75; // X position (left/right)

    // Add name using calculated position
    const fullName = `${firstName} ${lastName}`;
    secondPage.drawText(fullName, {
      x: baseX,
      y: 200,
      size: 10, // Slightly smaller font
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add signature using calculated position
    if (signatureDataURL && signatureDataURL.startsWith("data:image/")) {
      try {
        const base64Data = signatureDataURL.split(",")[1];
        const signatureBytes = Uint8Array.from(atob(base64Data), (c) =>
          c.charCodeAt(0)
        );

        const signatureImage = await pdfDoc.embedPng(signatureBytes);

        secondPage.drawImage(signatureImage, {
          x: baseX * 3.5,
          y: 80,
          // width: 140, // Slightly smaller signature
          // height: 20, // Reduced height
        });
      } catch (imageError) {
        console.error("Error embedding signature image:", imageError);
      }
    }

    // Add date using calculated position
    const currentDate = new Date().toLocaleDateString("en-US");
    secondPage.drawText(currentDate, {
      x: baseX,
      y: 114,
      size: 10, // Consistent font size
      font: font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
    const encryptionKey = process.env.WAIVER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("WAIVER_ENCRYPTION_KEY environment variable must be set");
    }
    const encryptedPdf = CryptoJS.AES.encrypt(
      pdfBase64,
      encryptionKey
    ).toString();

    return encryptedPdf;
  } catch (error) {
    console.error("Error generating signed waiver:", error);
    throw new Error("Failed to generate signed waiver");
  }
}

/**
 * Decrypts an encrypted waiver PDF document back to its original binary format
 *
 * This function reverses the encryption process used by generateSignedWaiver(),
 * returning a Buffer containing the original PDF bytes that can be saved or displayed.
 *
 * @param encryptedData - AES encrypted string containing the PDF data (from generateSignedWaiver)
 * @returns Buffer - Binary PDF data ready for file writing or streaming
 *
 * @throws Error - Throws "Failed to decrypt waiver" if decryption fails or data is malformed
 *
 * @example
 * ```typescript
 * const pdfBuffer = decryptWaiver(user.waiverSignature);
 * fs.writeFileSync('signed-waiver.pdf', pdfBuffer);
 * ```
 *
 * @security
 * - Uses same AES decryption key as generateSignedWaiver()
 * - Key retrieved from WAIVER_ENCRYPTION_KEY environment variable
 * - Falls back to default key if environment variable not set
 *
 * @dependencies
 * - Uses crypto-js for AES decryption
 * - Requires valid encrypted data format from generateSignedWaiver()
 *
 * @see generateSignedWaiver - For the encryption counterpart of this function
 */
function decryptWaiver(encryptedData: string): Buffer {
  try {
    const encryptionKey = process.env.WAIVER_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("WAIVER_ENCRYPTION_KEY environment variable must be set");
    }
    const decryptedBase64 = CryptoJS.AES.decrypt(
      encryptedData,
      encryptionKey
    ).toString(CryptoJS.enc.Utf8);
    return Buffer.from(decryptedBase64, "base64");
  } catch (error) {
    console.error("Error decrypting waiver:", error);
    throw new Error("Failed to decrypt waiver");
  }
}

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

    // Handle waiver signature and PDF generation
    let waiverSignatureData = null;
    const waiverSignature = rawValues.waiverSignature;

    if (
      typeof waiverSignature === "string" &&
      waiverSignature.trim() !== "" &&
      waiverSignature.startsWith("data:image/")
    ) {
      // Generate signed and encrypted PDF
      waiverSignatureData = await generateSignedWaiver(
        data.firstName,
        data.lastName,
        waiverSignature
      );
    } else {
      waiverSignatureData = null;
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
        dateOfBirth: data.dateOfBirth,
        emergencyContactName: data.emergencyContactName || "",
        emergencyContactPhone: data.emergencyContactPhone || "",
        emergencyContactEmail: data.emergencyContactEmail || "",
        mediaConsent: data.mediaConsent ?? false,
        dataPrivacy: data.dataPrivacy ?? false,
        communityGuidelines: data.communityGuidelines ?? false,
        operationsPolicy: data.operationsPolicy ?? false,
        waiverSignature: waiverSignatureData,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        waiverSignature: true,
      },
    });

    // Send registration confirmation email
    try {
      await sendRegistrationConfirmationEmail({
        userEmail: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    } catch (emailError) {
      console.error("Failed to send registration confirmation email:", emailError);
      // Don't fail the registration if email fails, just log the error
    }

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

/**
 * Finds a user from the email
 * @param email
 * @returns user
 */
export async function findUserByEmail(email: string) {
  if (!email) return null;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      roleLevel: true,
    },
  });

  return user;
}

/**
 * Updates the password of a user
 * @param email
 * @param password
 * @returns user
 */
export async function updateUserPassword(email: string, password: string) {
  if (!email || !password) return null;

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.update({
    where: { email },
    data: { password: hashedPassword },
    select: {
      id: true,
      email: true,
      password: true
    },
  });

  return user;
}


export { decryptWaiver };
