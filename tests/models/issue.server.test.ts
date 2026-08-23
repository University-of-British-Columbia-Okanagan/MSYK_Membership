const createIssueDbMock = () => ({
  db: {
    issue: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
});

type IssueDbMock = ReturnType<typeof createIssueDbMock>["db"];

jest.mock("~/utils/db.server", () => createIssueDbMock());

// Screenshot uploads hit the real filesystem; stub the two calls that write.
const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockWriteFile = jest.fn().mockResolvedValue(undefined);

jest.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    mkdir: (...args: unknown[]) => (mockMkdir as any)(...args),
    writeFile: (...args: unknown[]) => (mockWriteFile as any)(...args),
  },
}));

import { clearAllMocks } from "tests/helpers/test-utils";
import { createIssue, getIssues, updateIssueStatus } from "~/models/issue.server";

const { db } = require("~/utils/db.server") as { db: IssueDbMock };

/** Builds a File the way a multipart form submission would supply one. */
const makeFile = (
  name: string,
  type: string,
  sizeBytes = 1024
): File => {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  // File.size is read-only but derived from the parts; assert the assumption
  // rather than trusting it silently.
  return file;
};

/** A file that reports an oversized `size` without allocating 6MB. */
const makeOversizedFile = (name: string, type: string): File => {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
  return file;
};

describe("issue.server", () => {
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    db.issue.create.mockResolvedValue({ id: 1, screenshots: [] });
  });

  afterEach(() => {
    consoleLog.mockRestore();
    consoleError.mockRestore();
  });

  describe("createIssue", () => {
    const baseIssue = {
      title: "Laser cutter jammed",
      description: "The gantry stalls halfway",
      priority: "medium",
      reportedById: 4,
    };

    it("creates the issue and connects it to the reporter", async () => {
      await createIssue(baseIssue);

      expect(db.issue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Laser cutter jammed",
            description: "The gantry stalls halfway",
            priority: "medium",
            reportedBy: { connect: { id: 4 } },
          }),
        })
      );
    });

    it("creates no screenshot rows when none are supplied", async () => {
      await createIssue(baseIssue);

      const data = db.issue.create.mock.calls[0][0].data;
      expect(data.screenshots).toEqual({ create: [] });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("writes an accepted screenshot to disk and stores its public URL", async () => {
      await createIssue({
        ...baseIssue,
        screenshots: [makeFile("photo.png", "image/png")],
      });

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining("public/uploads/issues"),
        { recursive: true }
      );
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const data = db.issue.create.mock.calls[0][0].data;
      expect(data.screenshots.create).toHaveLength(1);
      expect(data.screenshots.create[0].url).toMatch(
        /^\/uploads\/issues\/[0-9a-f-]+\.png$/
      );
    });

    it("accepts JPEG as well as PNG", async () => {
      await createIssue({
        ...baseIssue,
        screenshots: [makeFile("photo.jpg", "image/jpeg")],
      });

      const data = db.issue.create.mock.calls[0][0].data;
      expect(data.screenshots.create[0].url).toMatch(/\.jpg$/);
    });

    it("rejects more than 5 screenshots before writing anything", async () => {
      const six = Array.from({ length: 6 }, (_, i) =>
        makeFile(`shot-${i}.png`, "image/png")
      );

      await expect(
        createIssue({ ...baseIssue, screenshots: six })
      ).rejects.toThrow("You can upload a maximum of 5 screenshots.");

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(db.issue.create).not.toHaveBeenCalled();
    });

    it("accepts exactly 5 screenshots", async () => {
      const five = Array.from({ length: 5 }, (_, i) =>
        makeFile(`shot-${i}.png`, "image/png")
      );

      await createIssue({ ...baseIssue, screenshots: five });

      expect(mockWriteFile).toHaveBeenCalledTimes(5);
    });

    it("rejects a disallowed MIME type", async () => {
      await expect(
        createIssue({
          ...baseIssue,
          screenshots: [makeFile("payload.gif", "image/gif")],
        })
      ).rejects.toThrow("Only PNG and JPEG images are allowed");

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("rejects a file over 5MB", async () => {
      await expect(
        createIssue({
          ...baseIssue,
          screenshots: [makeOversizedFile("huge.png", "image/png")],
        })
      ).rejects.toThrow("File size exceeds 5MB");

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("rejects a mismatched extension even when the MIME type is allowed", async () => {
      // Guards against an executable renamed to pass the MIME sniff.
      await expect(
        createIssue({
          ...baseIssue,
          screenshots: [makeFile("payload.exe", "image/png")],
        })
      ).rejects.toThrow("Invalid file extension");

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("skips zero-byte files rather than failing the whole submission", async () => {
      const empty = makeFile("empty.png", "image/png", 0);

      await createIssue({ ...baseIssue, screenshots: [empty] });

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(db.issue.create).toHaveBeenCalled();
    });

    it("gives each upload a random filename rather than the client-supplied one", async () => {
      await createIssue({
        ...baseIssue,
        screenshots: [
          makeFile("same-name.png", "image/png"),
          makeFile("same-name.png", "image/png"),
        ],
      });

      const urls = db.issue.create.mock.calls[0][0].data.screenshots.create.map(
        (s: { url: string }) => s.url
      );
      expect(urls[0]).not.toBe(urls[1]);
      expect(urls[0]).not.toContain("same-name");
    });

    it("surfaces a generic error when the insert fails", async () => {
      db.issue.create.mockRejectedValue(new Error("constraint violation"));

      await expect(createIssue(baseIssue)).rejects.toThrow(
        "Failed to create issue."
      );
    });
  });

  describe("getIssues", () => {
    it("returns issues newest first with screenshots and reporter", async () => {
      db.issue.findMany.mockResolvedValue([{ id: 2 }, { id: 1 }]);

      const issues = await getIssues();

      expect(issues).toHaveLength(2);
      expect(db.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          include: expect.objectContaining({
            screenshots: true,
            reportedBy: { select: { id: true, email: true } },
          }),
        })
      );
    });

    it("wraps a query failure in a generic error", async () => {
      db.issue.findMany.mockRejectedValue(new Error("timeout"));

      await expect(getIssues()).rejects.toThrow("Failed to fetch issues.");
    });
  });

  describe("updateIssueStatus", () => {
    it("writes the new status", async () => {
      db.issue.update.mockResolvedValue({ id: 1, status: "resolved" });

      const result = await updateIssueStatus(1, "resolved");

      expect(db.issue.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "resolved" },
      });
      expect(result.status).toBe("resolved");
    });

    it("wraps an update failure in a generic error", async () => {
      db.issue.update.mockRejectedValue(new Error("not found"));

      await expect(updateIssueStatus(99, "resolved")).rejects.toThrow(
        "Failed to update issue status."
      );
    });
  });
});
