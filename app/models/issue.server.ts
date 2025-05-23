import { db } from "../utils/db.server";

/**
 * Create a new issue report
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
          create: data.screenshotUrls?.map((url) => ({
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
 * Retrieve all issues with reporter and screenshots
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
 * Update the status of an issue
 */
export async function updateIssueStatus(issueId: number, newStatus: string) {
  try {
    const updatedIssue = await db.issue.update({
      where: { id: issueId },
      data: { status: newStatus }
    });

    console.log("Updated Issue:", updatedIssue);
    return updatedIssue;
  } catch (error) {
    console.error("Error updating issue status:", error);
    throw new Error("Failed to update issue status.");
  }
}