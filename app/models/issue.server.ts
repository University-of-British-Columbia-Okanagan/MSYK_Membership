import { db } from "../utils/db.server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public/uploads/issues");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg"];
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const MAX_SCREENSHOTS = 5;

/**
 * Create a new issue report with optional screenshots
 * @param data Issue data object containing title, description, priority, reporter ID, and optional screenshot URLs
 * @param data.title The title/summary of the issue
 * @param data.description Detailed description of the issue and steps to reproduce
 * @param data.priority Priority level of the issue (1-5, where 1 is low and 5 is high)
 * @param data.reportedById The ID of the user reporting the issue
 * @param data.screenshotUrls Optional array of screenshot URLs to attach to the issue
 * @returns Created issue record with screenshots and reporter information
 */
export async function createIssue(data: {
  title: string;
  description: string;
  priority: string;
  reportedById: number;
  screenshots?: File[];
}) {
  const screenshotUrls: string[] = [];
  try {
    if (data.screenshots?.length) {
      if (data.screenshots.length > MAX_SCREENSHOTS) {
        throw new Error(`You can upload a maximum of ${MAX_SCREENSHOTS} screenshots.`);
      }
      for (const file of data.screenshots) {
        if (file instanceof File && file.size > 0) {
          const url = await saveScreenshotToDisk(file);
          screenshotUrls.push(url);
        }
      }
    }
  } catch (error) {
    console.error("Error saving screenshots:", error);
    throw error;
  }

  try {
    const newIssue = await db.issue.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        reportedBy: {
          connect: { id: data.reportedById },
        },
        screenshots: {
          create: screenshotUrls.map((url) => ({ url })),
        },
      },
      include: {
        screenshots: true,
        reportedBy: true,
      },
    });

    console.log("New Issue Created:", newIssue);
    return newIssue;
  } catch (error) {
    console.error("Error creating issue:", error);
    throw new Error("Failed to create issue.");
  }
}

/**
 * Retrieve all issues with reporter information and screenshots, ordered by creation date
 * @returns Array of all issues with included screenshots and reporter details (id, email)
 */
export async function getIssues() {
  try {
    const issues = await db.issue.findMany({
      include: {
        screenshots: true,
        reportedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return issues;
  } catch (error) {
    console.error("Error fetching issues:", error);
    throw new Error("Failed to fetch issues.");
  }
}

/**
 * Update the status of an existing issue (Admin only)
 * @param issueId The ID of the issue to update
 * @param newStatus The new status to set for the issue (e.g., "open", "in-progress", "resolved", "closed")
 * @returns Updated issue record with new status
 */
export async function updateIssueStatus(issueId: number, newStatus: string) {
  try {
    const updatedIssue = await db.issue.update({
      where: { id: issueId },
      data: { status: newStatus },
    });

    console.log("Updated Issue:", updatedIssue);
    return updatedIssue;
  } catch (error) {
    console.error("Error updating issue status:", error);
    throw new Error("Failed to update issue status.");
  }
}

/**
 * Save an uploaded screenshot image to local disk and return its public URL
 * @param file The uploaded image file (must be an image and <= 5MB)
 * @returns Publicly accessible URL of the saved screenshot (e.g., /uploads/issues/<filename>)
 * @throws Error if the file type is invalid, the file is too large, or the file cannot be written to disk
 */
async function saveScreenshotToDisk(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Only PNG and JPEG images are allowed");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size exceeds 5MB");
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Invalid file extension");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${crypto.randomUUID()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buffer);

  return `/uploads/issues/${filename}`;
}