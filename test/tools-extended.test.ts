import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/mcp.js";
import { VikunjaClientError } from "../src/vikunja-client.js";
import { getRegisteredTool, callTool } from "./helpers/mcp.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content?: Array<{ type: string; text: string }>;
};

function getStructuredContent(result: unknown): Record<string, unknown> {
  const toolResult = result as ToolResult;

  if (toolResult.isError || !toolResult.structuredContent) {
    throw new Error("Expected a successful tool result with structured content.");
  }

  return toolResult.structuredContent;
}

function getErrorText(result: unknown): string {
  const toolResult = result as ToolResult;

  if (!toolResult.isError || !toolResult.content?.[0]) {
    throw new Error("Expected an error tool result.");
  }

  return toolResult.content[0].text;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("additional MCP tool coverage", () => {
  async function withServer(
    run: (server: McpServer, client: ReturnType<typeof createMockVikunjaClient>) => Promise<void>,
  ) {
    const client = createMockVikunjaClient();
    const server = createMcpServer(client);

    try {
      await run(server, client);
    } finally {
      await server.close();
    }
  }

  it("lists projects and preserves pagination", async () => {
    await withServer(async (server, client) => {
      client.listProjects.mockResolvedValueOnce({
        items: [{ id: 1, title: "Stonegate Descent" }],
        pagination: {
          page: 2,
          per_page: 10,
          total_pages: 4,
          result_count: 31,
        },
      });

      const result = await callTool(server, "projects_list", {
        page: 2,
        per_page: 10,
        search: "Stonegate",
      });

      expect(client.listProjects).toHaveBeenCalledWith({
        page: 2,
        perPage: 10,
        search: "Stonegate",
      });
      expect(getStructuredContent(result)).toEqual({
        items: [{ id: 1, title: "Stonegate Descent" }],
        pagination: {
          page: 2,
          per_page: 10,
          total_pages: 4,
          result_count: 31,
        },
      });
    });
  });

  it("returns a tool error when projects_list fails", async () => {
    await withServer(async (server, client) => {
      client.listProjects.mockRejectedValueOnce(
        new VikunjaClientError("Invalid Vikunja token.", { statusCode: 401 }),
      );

      const result = await callTool(server, "projects_list", {});

      expect(getErrorText(result)).toBe("Error in projects_list: Invalid Vikunja token.");
    });
  });

  it("lists tasks with the full supported filter and sorting options", async () => {
    await withServer(async (server, client) => {
      client.listTasks.mockResolvedValueOnce({
        items: [{ id: 16, title: "BOARD RULES" }],
        pagination: {
          page: 3,
          per_page: 25,
          total_pages: 7,
          result_count: 160,
        },
      });

      const result = await callTool(server, "tasks_list", {
        project_id: 8,
        view_id: 4,
        page: 3,
        per_page: 25,
        search: "BOARD",
        filter: "done = false",
        filter_include_nulls: true,
        filter_timezone: "Europe/Rome",
        sort_by: "id",
        order_by: "asc",
      });

      expect(client.listTasks).toHaveBeenCalledWith(8, 4, {
        page: 3,
        perPage: 25,
        search: "BOARD",
        filter: "done = false",
        filterIncludeNulls: true,
        filterTimezone: "Europe/Rome",
        sortBy: "id",
        orderBy: "asc",
      });
      expect(getStructuredContent(result)).toMatchObject({
        items: [{ id: 16, title: "BOARD RULES" }],
      });
    });
  });

  it("returns a tool error when tasks_list fails", async () => {
    await withServer(async (server, client) => {
      client.listTasks.mockRejectedValueOnce(new Error("view not found"));

      const result = await callTool(server, "tasks_list", {
        project_id: 1,
        view_id: 2,
      });

      expect(getErrorText(result)).toBe("Error in tasks_list: view not found");
    });
  });

  it("gets a task with expand options", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 14,
        title: "Lore notes",
      });

      const result = await callTool(server, "task_get", {
        task_id: 14,
        expand: ["comments", "reactions"],
      });

      expect(client.getTask).toHaveBeenCalledWith(14, {
        expand: ["comments", "reactions"],
      });
      expect(getStructuredContent(result)).toEqual({
        task: {
          id: 14,
          title: "Lore notes",
        },
      });
    });
  });

  it("returns a tool error when task_get fails", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockRejectedValueOnce(new Error("task missing"));

      const result = await callTool(server, "task_get", {
        task_id: 77,
      });

      expect(getErrorText(result)).toBe("Error in task_get: task missing");
    });
  });

  it("covers the defensive task_create title check", async () => {
    await withServer(async (server) => {
      const taskCreate = getRegisteredTool(server, "task_create") as {
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      };

      const result = await taskCreate.handler({
        project_id: 7,
      });

      expect(getErrorText(result)).toBe("Error in task_create: title is required.");
    });
  });

  it("returns a tool error when task_create does not receive a numeric id back", async () => {
    await withServer(async (server, client) => {
      client.createTask.mockResolvedValueOnce({
        title: "Broken task response",
      });

      const result = await callTool(server, "task_create", {
        project_id: 7,
        title: "Broken task response",
      });

      expect(getErrorText(result)).toBe(
        "Error in task_create: task_create failed: Vikunja did not return a numeric task id.",
      );
    });
  });

  it("returns a tool error when task_create verification fails", async () => {
    await withServer(async (server, client) => {
      client.createTask.mockResolvedValueOnce({
        id: 51,
        title: "Draft title",
      });
      client.getTask.mockResolvedValueOnce({
        id: 51,
        title: "Different title",
      });

      const result = await callTool(server, "task_create", {
        project_id: 7,
        title: "Expected title",
      });

      expect(getErrorText(result)).toContain(
        'Error in task_create: task_create verification failed: field "title" did not match the final task state.',
      );
    });
  });

  it("returns a tool error when task_update has no patch fields", async () => {
    await withServer(async (server) => {
      const result = await callTool(server, "task_update", {
        task_id: 9,
      });

      expect(getErrorText(result)).toBe(
        "Error in task_update: At least one updatable field must be provided.",
      );
    });
  });

  it("treats null task fields as already satisfied when both sides are empty", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 21,
        title: "Optional due date",
        due_date: null,
      });

      const result = await callTool(server, "task_update", {
        task_id: 21,
        due_date: null,
      });

      expect(client.updateTask).not.toHaveBeenCalled();
      expect(getStructuredContent(result)).toMatchObject({
        verification: {
          operation: "task_update",
          checked_fields: ["due_date"],
          verified: true,
          already_satisfied: true,
        },
      });
    });
  });

  it("merges the current task with the requested patch before updating", async () => {
    await withServer(async (server, client) => {
      const currentTask = {
        id: 11,
        title: "Old title",
        description: "Old description",
        done: false,
        priority: 1,
        percent_done: 10,
        due_date: null,
        start_date: null,
        end_date: null,
      };
      const finalTask = {
        ...currentTask,
        title: "New title",
        description: "New description",
        done: true,
        priority: 5,
        percent_done: 90,
        due_date: "2026-03-29T08:00:00.000Z",
        start_date: "2026-03-28T08:00:00.000Z",
        end_date: "2026-03-30T08:00:00.000Z",
      };

      client.getTask.mockResolvedValueOnce(currentTask).mockResolvedValueOnce(finalTask);
      client.updateTask.mockResolvedValueOnce(finalTask);

      const result = await callTool(server, "task_update", {
        task_id: 11,
        title: "New title",
        description: "New description",
        done: true,
        priority: 5,
        percent_done: 90,
        due_date: "2026-03-29T10:00:00+02:00",
        start_date: "2026-03-28T10:00:00+02:00",
        end_date: "2026-03-30T10:00:00+02:00",
      });

      expect(client.updateTask).toHaveBeenCalledWith(11, {
        ...currentTask,
        title: "New title",
        description: "New description",
        done: true,
        priority: 5,
        percent_done: 90,
        due_date: "2026-03-29T10:00:00+02:00",
        start_date: "2026-03-28T10:00:00+02:00",
        end_date: "2026-03-30T10:00:00+02:00",
      });
      expect(getStructuredContent(result)).toMatchObject({
        task: finalTask,
      });
    });
  });

  it("returns a tool error when task_update verification fails", async () => {
    await withServer(async (server, client) => {
      client.getTask
        .mockResolvedValueOnce({
          id: 12,
          title: "Old title",
        })
        .mockResolvedValueOnce({
          id: 12,
          title: "Still old title",
        });
      client.updateTask.mockResolvedValueOnce({
        id: 12,
        title: "Still old title",
      });

      const result = await callTool(server, "task_update", {
        task_id: 12,
        title: "New title",
      });

      expect(getErrorText(result)).toContain(
        'Error in task_update: task_update verification failed: field "title" did not match the final task state.',
      );
    });
  });

  it("lists labels", async () => {
    await withServer(async (server, client) => {
      client.listLabels.mockResolvedValueOnce({
        items: [{ id: 4, title: "ready" }],
        pagination: {
          page: 1,
          per_page: 10,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "labels_list", {
        page: 1,
        per_page: 10,
        search: "ready",
      });

      expect(client.listLabels).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
        search: "ready",
      });
      expect(getStructuredContent(result)).toMatchObject({
        items: [{ id: 4, title: "ready" }],
      });
    });
  });

  it("returns a tool error when labels_list fails", async () => {
    await withServer(async (server, client) => {
      client.listLabels.mockRejectedValueOnce(new Error("labels unavailable"));

      const result = await callTool(server, "labels_list", {});

      expect(getErrorText(result)).toBe("Error in labels_list: labels unavailable");
    });
  });

  it("returns a tool error when task_add_label verification fails", async () => {
    await withServer(async (server, client) => {
      client.listTaskLabels
        .mockResolvedValueOnce({
          items: [],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 0,
          },
        })
        .mockResolvedValueOnce({
          items: [{ id: 2, title: "other" }],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 1,
          },
        });

      const result = await callTool(server, "task_add_label", {
        task_id: 12,
        label_id: 6,
      });

      expect(getErrorText(result)).toBe(
        "Error in task_add_label: task_add_label verification failed: label was not present after the write.",
      );
    });
  });

  it("lists views", async () => {
    await withServer(async (server, client) => {
      client.listViews.mockResolvedValueOnce([{ id: 3, title: "Kanban" }]);

      const result = await callTool(server, "views_list", {
        project_id: 9,
      });

      expect(client.listViews).toHaveBeenCalledWith(9);
      expect(getStructuredContent(result)).toEqual({
        items: [{ id: 3, title: "Kanban" }],
      });
    });
  });

  it("returns a tool error when views_list fails", async () => {
    await withServer(async (server, client) => {
      client.listViews.mockRejectedValueOnce(new Error("view error"));

      const result = await callTool(server, "views_list", {
        project_id: 9,
      });

      expect(getErrorText(result)).toBe("Error in views_list: view error");
    });
  });

  it("lists buckets", async () => {
    await withServer(async (server, client) => {
      client.listBuckets.mockResolvedValueOnce([{ id: 8, title: "Doing" }]);

      const result = await callTool(server, "buckets_list", {
        project_id: 9,
        view_id: 4,
      });

      expect(client.listBuckets).toHaveBeenCalledWith(9, 4);
      expect(getStructuredContent(result)).toEqual({
        items: [{ id: 8, title: "Doing" }],
      });
    });
  });

  it("returns a tool error when buckets_list fails", async () => {
    await withServer(async (server, client) => {
      client.listBuckets.mockRejectedValueOnce(new Error("bucket error"));

      const result = await callTool(server, "buckets_list", {
        project_id: 9,
        view_id: 4,
      });

      expect(getErrorText(result)).toBe("Error in buckets_list: bucket error");
    });
  });
});
