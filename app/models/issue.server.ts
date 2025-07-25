import { db } from "../utils/db.server";

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
  screenshotUrls?: string[];
}) {
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
          create:
            data.screenshotUrls?.map((url) => ({
              url,
            })) || [],
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
