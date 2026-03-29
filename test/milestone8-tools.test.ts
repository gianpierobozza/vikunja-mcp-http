import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/mcp.js";
import { VikunjaClientError } from "../src/vikunja-client.js";
import { callTool } from "./helpers/mcp.js";
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

describe("Milestone 8 MCP tools", () => {
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

  it("verifies project_create with the final read-back project", async () => {
    await withServer(async (server, client) => {
      client.createProject.mockResolvedValueOnce({
        id: 7,
        title: "Codex test - Project",
      });
      client.getProject.mockResolvedValueOnce({
        id: 7,
        title: "Codex test - Project",
        description: "Temporary project",
      });

      const result = await callTool(server, "project_create", {
        title: "Codex test - Project",
        description: "Temporary project",
      });

      expect(client.createProject).toHaveBeenCalledWith({
        title: "Codex test - Project",
        description: "Temporary project",
      });
      expect(getStructuredContent(result).verification).toEqual({
        operation: "project_create",
        checked_fields: ["title", "description"],
        verified: true,
      });
    });
  });

  it("updates and deletes projects with verification", async () => {
    await withServer(async (server, client) => {
      client.getProject
        .mockResolvedValueOnce({
          id: 7,
          title: "Codex test - Project",
          description: "Before",
        })
        .mockResolvedValueOnce({
          id: 7,
          title: "Codex test - Project",
          description: "After",
        })
        .mockResolvedValueOnce({
          id: 7,
          title: "Codex test - Project",
          description: "After",
        })
        .mockRejectedValueOnce(
          new VikunjaClientError("Not found.", {
            statusCode: 404,
          }),
        );
      client.updateProject.mockResolvedValueOnce({
        id: 7,
        title: "Codex test - Project",
      });

      const updateResult = await callTool(server, "project_update", {
        project_id: 7,
        description: "After",
      });
      const deleteResult = await callTool(server, "project_delete", {
        project_id: 7,
        confirm: true,
      });

      expect(getStructuredContent(updateResult).verification).toEqual({
        operation: "project_update",
        checked_fields: ["description"],
        verified: true,
      });
      expect(getStructuredContent(deleteResult).verification).toEqual({
        operation: "project_delete",
        verified: true,
      });
    });
  });

  it("requires confirm=true for destructive project, task, label, and comment deletes", async () => {
    await withServer(async (server) => {
      await expect(callTool(server, "project_delete", { project_id: 1 })).resolves.toMatchObject({
        isError: true,
      });
      await expect(callTool(server, "task_delete", { task_id: 2 })).resolves.toMatchObject({
        isError: true,
      });
      await expect(callTool(server, "label_delete", { label_id: 3 })).resolves.toMatchObject({
        isError: true,
      });
      await expect(
        callTool(server, "task_comment_delete", { task_id: 4, comment_id: 5 }),
      ).resolves.toMatchObject({
        isError: true,
      });
    });
  });

  it("creates, updates, and deletes views with verification", async () => {
    await withServer(async (server, client) => {
      client.createView.mockResolvedValueOnce({
        id: 9,
        title: "Project Board",
        view_kind: "kanban",
      });
      client.getView
        .mockResolvedValueOnce({
          id: 9,
          title: "Project Board",
          view_kind: "kanban",
        })
        .mockResolvedValueOnce({
          id: 9,
          title: "Project Backlog",
          view_kind: "list",
        })
        .mockResolvedValueOnce({
          id: 9,
          title: "Project Backlog",
          view_kind: "list",
        });
      client.updateView.mockResolvedValueOnce({
        id: 9,
        title: "Project Backlog",
        view_kind: "list",
      });
      client.listViews.mockResolvedValueOnce([]);

      const createResult = await callTool(server, "view_create", {
        project_id: 7,
        title: "Project Board",
        view_kind: "kanban",
      });
      const updateResult = await callTool(server, "view_update", {
        project_id: 7,
        view_id: 9,
        title: "Project Backlog",
        view_kind: "list",
      });
      const deleteResult = await callTool(server, "view_delete", {
        project_id: 7,
        view_id: 9,
        confirm: true,
      });

      expect(getStructuredContent(createResult).verification).toEqual({
        operation: "view_create",
        checked_fields: ["title", "view_kind"],
        verified: true,
      });
      expect(getStructuredContent(updateResult).verification).toEqual({
        operation: "view_update",
        checked_fields: ["title", "view_kind"],
        verified: true,
      });
      expect(getStructuredContent(deleteResult).verification).toEqual({
        operation: "view_delete",
        verified: true,
      });
    });
  });

  it("creates, updates, and deletes buckets with verification", async () => {
    await withServer(async (server, client) => {
      client.createBucket.mockResolvedValueOnce({
        id: 11,
        title: "Inbox",
      });
      client.listBuckets
        .mockResolvedValueOnce([{ id: 11, title: "Inbox" }])
        .mockResolvedValueOnce([{ id: 11, title: "Doing", limit: 1 }])
        .mockResolvedValueOnce([{ id: 11, title: "Doing", limit: 1 }])
        .mockResolvedValueOnce([{ id: 11, title: "Doing", limit: 1 }])
        .mockResolvedValueOnce([]);
      client.updateBucket.mockResolvedValueOnce({
        id: 11,
        title: "Doing",
        limit: 1,
      });

      const createResult = await callTool(server, "bucket_create", {
        project_id: 7,
        view_id: 9,
        title: "Inbox",
      });
      const updateResult = await callTool(server, "bucket_update", {
        project_id: 7,
        view_id: 9,
        bucket_id: 11,
        title: "Doing",
        limit: 1,
      });
      const deleteResult = await callTool(server, "bucket_delete", {
        project_id: 7,
        view_id: 9,
        bucket_id: 11,
        confirm: true,
      });

      expect(getStructuredContent(createResult).verification).toEqual({
        operation: "bucket_create",
        checked_fields: ["title"],
        verified: true,
      });
      expect(getStructuredContent(updateResult).verification).toEqual({
        operation: "bucket_update",
        checked_fields: ["title", "limit"],
        verified: true,
      });
      expect(getStructuredContent(deleteResult).verification).toEqual({
        operation: "bucket_delete",
        verified: true,
      });
    });
  });

  it("deletes tasks and verifies absence by read-back", async () => {
    await withServer(async (server, client) => {
      client.getTask
        .mockResolvedValueOnce({
          id: 16,
          title: "Disposable task",
        })
        .mockRejectedValueOnce(
          new VikunjaClientError("Not found.", {
            statusCode: 404,
          }),
        );

      const result = await callTool(server, "task_delete", {
        task_id: 16,
        confirm: true,
      });

      expect(client.deleteTask).toHaveBeenCalledWith(16);
      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_delete",
        verified: true,
      });
    });
  });

  it("moves tasks between buckets and treats position as best effort", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
        buckets: [{ id: 8, title: "Doing", project_view_id: 9 }],
      });
      client.listTasks.mockResolvedValueOnce({
        items: [
          {
            id: 8,
            title: "Doing",
            project_view_id: 9,
            tasks: [{ id: 16, title: "BOARD RULES", position: 0.5 }],
          },
        ],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
        position: 1,
      });

      expect(client.moveTaskToBucket).toHaveBeenCalledWith(7, 9, 8, 16);
      expect(client.updateTaskPosition).toHaveBeenCalledWith(16, {
        project_view_id: 9,
        position: 1,
      });
      expect(client.getTask).toHaveBeenCalledWith(16, {
        expand: ["buckets"],
      });
      expect(client.listTasks).toHaveBeenCalledWith(7, 9);
      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_move",
        checked_fields: ["bucket_id"],
        verified: true,
        position_requested: 1,
        position_verification: "best_effort",
      });
    });
  });

  it("falls back to the board view when expanded task buckets do not confirm the move", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
        buckets: [{ id: 6, title: "Inbox", project_view_id: 12 }],
      });
      client.listTasks.mockResolvedValueOnce({
        items: [
          {
            id: 8,
            title: "Doing",
            project_view_id: 9,
            tasks: [{ id: 16, title: "BOARD RULES", position: 1 }],
          },
        ],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
      });

      expect(client.getTask).toHaveBeenCalledWith(16, {
        expand: ["buckets"],
      });
      expect(client.listTasks).toHaveBeenCalledWith(7, 9);
      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_move",
        checked_fields: ["bucket_id"],
        verified: true,
        position_requested: null,
        position_verification: "not_requested",
      });
    });
  });

  it("uses the board view position to report a matched move position", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
        buckets: [{ id: 8, title: "Doing", project_view_id: 9 }],
      });
      client.listTasks.mockResolvedValueOnce({
        items: [
          {
            id: 8,
            title: "Doing",
            project_view_id: 9,
            tasks: [{ id: 16, title: "BOARD RULES", position: 1 }],
          },
        ],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
        position: 1,
      });

      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_move",
        checked_fields: ["bucket_id"],
        verified: true,
        position_requested: 1,
        position_verification: "matched",
      });
    });
  });

  it("returns a verification error when neither task expansion nor board view confirms the bucket", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
        buckets: [{ id: 6, title: "Inbox", project_view_id: 9 }],
      });
      client.listTasks.mockResolvedValueOnce({
        items: [
          {
            id: 7,
            title: "Next 5",
            project_view_id: 9,
            tasks: [],
          },
        ],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
      });

      expect(getErrorText(result)).toContain("task_move verification failed: expected bucket_id 8, got 6.");
    });
  });

  it("creates, removes, and deletes labels with verification", async () => {
    await withServer(async (server, client) => {
      client.createLabel.mockResolvedValueOnce({
        id: 5,
        title: "game design",
      });
      client.getLabel
        .mockResolvedValueOnce({
          id: 5,
          title: "game design",
          description: "Design work",
        })
        .mockResolvedValueOnce({
          id: 5,
          title: "game design",
          description: "Refined",
        })
        .mockResolvedValueOnce({
          id: 5,
          title: "game design",
          description: "Refined",
        })
        .mockResolvedValueOnce({
          id: 5,
          title: "game design",
          description: "Refined",
        })
        .mockRejectedValueOnce(
          new VikunjaClientError("Not found.", {
            statusCode: 404,
          }),
        );
      client.updateLabel.mockResolvedValueOnce({
        id: 5,
        title: "game design",
      });
      client.listTaskLabels
        .mockResolvedValueOnce({
          items: [{ id: 5, title: "game design" }],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 1,
          },
        })
        .mockResolvedValueOnce({
          items: [],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 0,
          },
        });

      const createResult = await callTool(server, "label_create", {
        title: "game design",
        description: "Design work",
      });
      const updateResult = await callTool(server, "label_update", {
        label_id: 5,
        description: "Refined",
      });
      const removeResult = await callTool(server, "task_remove_label", {
        task_id: 16,
        label_id: 5,
      });
      const deleteResult = await callTool(server, "label_delete", {
        label_id: 5,
        confirm: true,
      });

      expect(getStructuredContent(createResult).verification).toEqual({
        operation: "label_create",
        checked_fields: ["title", "description"],
        verified: true,
      });
      expect(getStructuredContent(updateResult).verification).toEqual({
        operation: "label_update",
        checked_fields: ["description"],
        verified: true,
      });
      expect(getStructuredContent(removeResult)).toEqual({
        task_id: 16,
        label_id: 5,
        already_absent: false,
        labels: [],
      });
      expect(getStructuredContent(deleteResult).verification).toEqual({
        operation: "label_delete",
        verified: true,
      });
    });
  });

  it("returns already_absent when removing a label that is not attached", async () => {
    await withServer(async (server, client) => {
      client.listTaskLabels.mockResolvedValueOnce({
        items: [],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 0,
        },
      });

      const result = await callTool(server, "task_remove_label", {
        task_id: 16,
        label_id: 99,
      });

      expect(client.removeLabelFromTask).not.toHaveBeenCalled();
      expect(getStructuredContent(result).already_absent).toBe(true);
    });
  });

  it("searches users and verifies task assign/unassign behavior", async () => {
    await withServer(async (server, client) => {
      client.searchUsers.mockResolvedValueOnce([{ id: 2, username: "gm" }]);
      client.listTaskAssignees
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
          items: [{ id: 2, username: "gm" }],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 1,
          },
        })
        .mockResolvedValueOnce({
          items: [{ id: 2, username: "gm" }],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 1,
          },
        })
        .mockResolvedValueOnce({
          items: [],
          pagination: {
            page: 1,
            per_page: 1000,
            total_pages: 1,
            result_count: 0,
          },
        });

      const searchResult = await callTool(server, "users_search", {
        search: "gm",
      });
      const assignResult = await callTool(server, "task_assign_user", {
        task_id: 16,
        user_id: 2,
      });
      const unassignResult = await callTool(server, "task_unassign_user", {
        task_id: 16,
        user_id: 2,
      });

      expect(getStructuredContent(searchResult)).toEqual({
        items: [{ id: 2, username: "gm" }],
      });
      expect(getStructuredContent(assignResult)).toEqual({
        task_id: 16,
        user_id: 2,
        already_present: false,
        assignees: [{ id: 2, username: "gm" }],
      });
      expect(getStructuredContent(unassignResult)).toEqual({
        task_id: 16,
        user_id: 2,
        already_absent: false,
        assignees: [],
      });
    });
  });

  it("returns already_absent when unassigning a user who is not assigned", async () => {
    await withServer(async (server, client) => {
      client.listTaskAssignees.mockResolvedValueOnce({
        items: [],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 0,
        },
      });

      const result = await callTool(server, "task_unassign_user", {
        task_id: 16,
        user_id: 7,
      });

      expect(client.removeAssigneeFromTask).not.toHaveBeenCalled();
      expect(getStructuredContent(result).already_absent).toBe(true);
    });
  });

  it("lists reactions for supported entities", async () => {
    await withServer(async (server, client) => {
      client.listReactions.mockResolvedValueOnce([
        {
          "😀": [{ id: 7, username: "gm" }],
        },
      ]);

      const result = await callTool(server, "reactions_list", {
        entity_kind: "comments",
        entity_id: 12,
      });

      expect(client.listReactions).toHaveBeenCalledWith("comments", 12);
      expect(getStructuredContent(result)).toEqual({
        items: [
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ],
      });
    });
  });

  it("adds reactions with verification and reports already_present precisely", async () => {
    await withServer(async (server, client) => {
      client.listReactions
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 3, username: "other" }],
          },
        ])
        .mockResolvedValueOnce([
          {
            "😀": [
              { id: 3, username: "other" },
              { id: 7, username: "gm" },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ])
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ]);
      client.addReaction
        .mockResolvedValueOnce({
          value: "😀",
          user: { id: 7, username: "gm" },
        })
        .mockResolvedValueOnce({
          value: "😀",
          user: { id: 7, username: "gm" },
        });

      const addResult = await callTool(server, "reaction_add", {
        entity_kind: "tasks",
        entity_id: 16,
        reaction: "😀",
      });
      const alreadyPresentResult = await callTool(server, "reaction_add", {
        entity_kind: "comments",
        entity_id: 12,
        reaction: "😀",
      });

      expect(client.addReaction).toHaveBeenNthCalledWith(1, "tasks", 16, "😀");
      expect(client.addReaction).toHaveBeenNthCalledWith(2, "comments", 12, "😀");
      expect(getStructuredContent(addResult)).toEqual({
        entity_kind: "tasks",
        entity_id: 16,
        reaction: "😀",
        already_present: false,
        reactions: [
          {
            "😀": [
              { id: 3, username: "other" },
              { id: 7, username: "gm" },
            ],
          },
        ],
      });
      expect(getStructuredContent(alreadyPresentResult)).toEqual({
        entity_kind: "comments",
        entity_id: 12,
        reaction: "😀",
        already_present: true,
        reactions: [
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ],
      });
    });
  });

  it("removes reactions and reports already_absent idempotently", async () => {
    await withServer(async (server, client) => {
      client.listReactions
        .mockResolvedValueOnce([
          {
            "😀": [
              { id: 7, username: "gm" },
              { id: 3, username: "other" },
            ],
          },
        ])
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 3, username: "other" }],
          },
        ])
        .mockResolvedValueOnce([]);

      const removeResult = await callTool(server, "reaction_remove", {
        entity_kind: "tasks",
        entity_id: 16,
        reaction: "😀",
      });
      const alreadyAbsentResult = await callTool(server, "reaction_remove", {
        entity_kind: "comments",
        entity_id: 12,
        reaction: "😀",
      });

      expect(client.removeReaction).toHaveBeenCalledTimes(1);
      expect(client.removeReaction).toHaveBeenCalledWith("tasks", 16, "😀");
      expect(getStructuredContent(removeResult)).toEqual({
        entity_kind: "tasks",
        entity_id: 16,
        reaction: "😀",
        already_absent: false,
        reactions: [
          {
            "😀": [{ id: 3, username: "other" }],
          },
        ],
      });
      expect(getStructuredContent(alreadyAbsentResult)).toEqual({
        entity_kind: "comments",
        entity_id: 12,
        reaction: "😀",
        already_absent: true,
        reactions: [],
      });
    });
  });

  it("lists, creates, updates, and deletes task comments with verification", async () => {
    await withServer(async (server, client) => {
      client.listTaskComments.mockResolvedValueOnce([{ id: 12, comment: "First" }]);
      client.createTaskComment.mockResolvedValueOnce({
        id: 13,
        comment: "Created",
      });
      client.getTaskComment
        .mockResolvedValueOnce({
          id: 13,
          comment: "Created",
        })
        .mockResolvedValueOnce({
          id: 12,
          comment: "Before",
        })
        .mockResolvedValueOnce({
          id: 12,
          comment: "After",
        })
        .mockResolvedValueOnce({
          id: 12,
          comment: "After",
        })
        .mockRejectedValueOnce(
          new VikunjaClientError("Not found.", {
            statusCode: 404,
          }),
        );
      client.updateTaskComment.mockResolvedValueOnce({
        id: 12,
        comment: "After",
      });

      const listResult = await callTool(server, "task_comments_list", {
        task_id: 16,
        order_by: "desc",
      });
      const createResult = await callTool(server, "task_comment_create", {
        task_id: 16,
        comment: "Created",
      });
      const updateResult = await callTool(server, "task_comment_update", {
        task_id: 16,
        comment_id: 12,
        comment: "After",
      });
      const deleteResult = await callTool(server, "task_comment_delete", {
        task_id: 16,
        comment_id: 12,
        confirm: true,
      });

      expect(getStructuredContent(listResult)).toEqual({
        items: [{ id: 12, comment: "First" }],
      });
      expect(getStructuredContent(createResult).verification).toEqual({
        operation: "task_comment_create",
        checked_fields: ["comment"],
        verified: true,
      });
      expect(getStructuredContent(updateResult).verification).toEqual({
        operation: "task_comment_update",
        checked_fields: ["comment"],
        verified: true,
        already_satisfied: false,
      });
      expect(getStructuredContent(deleteResult).verification).toEqual({
        operation: "task_comment_delete",
        verified: true,
      });
    });
  });

  it("returns already_satisfied for no-op task comment updates", async () => {
    await withServer(async (server, client) => {
      client.getTaskComment.mockResolvedValueOnce({
        id: 12,
        comment: "No change",
      });

      const result = await callTool(server, "task_comment_update", {
        task_id: 16,
        comment_id: 12,
        comment: "No change",
      });

      expect(client.updateTaskComment).not.toHaveBeenCalled();
      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_comment_update",
        checked_fields: ["comment"],
        verified: true,
        already_satisfied: true,
      });
    });
  });

  it("lists, creates, and deletes task relations with idempotent behavior", async () => {
    await withServer(async (server, client) => {
      client.listTaskRelations
        .mockResolvedValueOnce([{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }])
        .mockResolvedValueOnce([{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const listResult = await callTool(server, "task_relations_list", {
        task_id: 16,
      });
      const createResult = await callTool(server, "task_relation_create", {
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
      });
      const deleteResult = await callTool(server, "task_relation_delete", {
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
      });
      const deleteAgainResult = await callTool(server, "task_relation_delete", {
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
      });

      expect(getStructuredContent(listResult)).toEqual({
        items: [{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }],
      });
      expect(getStructuredContent(createResult)).toEqual({
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
        already_present: false,
        relations: [{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }],
      });
      expect(getStructuredContent(deleteResult)).toEqual({
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
        already_absent: false,
        relations: [],
      });
      expect(getStructuredContent(deleteAgainResult)).toEqual({
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
        already_absent: true,
        relations: [],
      });
    });
  });

  it("returns already_present when creating an existing relation", async () => {
    await withServer(async (server, client) => {
      client.listTaskRelations.mockResolvedValueOnce([
        { task_id: 16, relation_kind: "duplicates", other_task_id: 30 },
      ]);

      const result = await callTool(server, "task_relation_create", {
        task_id: 16,
        relation_kind: "duplicates",
        other_task_id: 30,
      });

      expect(client.createTaskRelation).not.toHaveBeenCalled();
      expect(getStructuredContent(result).already_present).toBe(true);
    });
  });

  it("returns the new validation errors for empty update payloads", async () => {
    await withServer(async (server) => {
      expect(getErrorText(await callTool(server, "project_update", { project_id: 7 }))).toBe(
        "Error in project_update: At least one updatable field must be provided.",
      );
      expect(
        getErrorText(await callTool(server, "view_update", { project_id: 7, view_id: 9 })),
      ).toBe("Error in view_update: At least one updatable field must be provided.");
      expect(
        getErrorText(
          await callTool(server, "bucket_update", {
            project_id: 7,
            view_id: 9,
            bucket_id: 11,
          }),
        ),
      ).toBe("Error in bucket_update: At least one updatable field must be provided.");
      expect(getErrorText(await callTool(server, "label_update", { label_id: 5 }))).toBe(
        "Error in label_update: At least one updatable field must be provided.",
      );
    });
  });
});
