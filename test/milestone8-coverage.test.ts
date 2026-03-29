import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/mcp.js";
import { callTool, getRegisteredTool } from "./helpers/mcp.js";
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

describe("Milestone 8 coverage branches", () => {
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

  it("covers optional field passthrough on create tools", async () => {
    await withServer(async (server, client) => {
      client.createProject.mockResolvedValueOnce({ id: 7, title: "P" });
      client.getProject.mockResolvedValueOnce({
        id: 7,
        title: "P",
        hex_color: "#123456",
        identifier: "STONE",
        is_archived: false,
        is_favorite: true,
        parent_project_id: null,
        position: 2,
      });
      client.createView.mockResolvedValueOnce({ id: 9, title: "Board", view_kind: "kanban" });
      client.getView.mockResolvedValueOnce({
        id: 9,
        title: "Board",
        view_kind: "kanban",
        position: 1,
        default_bucket_id: 6,
        done_bucket_id: 10,
        bucket_configuration_mode: "manual",
        bucket_configuration: [{ title: "Inbox" }],
        filter: { done: false },
      });
      client.createBucket.mockResolvedValueOnce({ id: 11, title: "Inbox" });
      client.listBuckets.mockResolvedValueOnce([
        { id: 11, title: "Inbox", position: 3, limit: 5 },
      ]);
      client.createLabel.mockResolvedValueOnce({ id: 5, title: "ready" });
      client.getLabel.mockResolvedValueOnce({
        id: 5,
        title: "ready",
        hex_color: "#00ff00",
      });

      await callTool(server, "project_create", {
        title: "P",
        hex_color: "#123456",
        identifier: "STONE",
        is_archived: false,
        is_favorite: true,
        parent_project_id: null,
        position: 2,
      });
      await callTool(server, "view_create", {
        project_id: 7,
        title: "Board",
        view_kind: "kanban",
        position: 1,
        default_bucket_id: 6,
        done_bucket_id: 10,
        bucket_configuration_mode: "manual",
        bucket_configuration: [{ title: "Inbox" }],
        filter: { done: false },
      });
      await callTool(server, "bucket_create", {
        project_id: 7,
        view_id: 9,
        title: "Inbox",
        position: 3,
        limit: 5,
      });
      await callTool(server, "label_create", {
        title: "ready",
        hex_color: "#00ff00",
      });

      expect(client.createProject).toHaveBeenCalledWith({
        title: "P",
        hex_color: "#123456",
        identifier: "STONE",
        is_archived: false,
        is_favorite: true,
        parent_project_id: null,
        position: 2,
      });
      expect(client.createView).toHaveBeenCalledWith(7, {
        title: "Board",
        view_kind: "kanban",
        position: 1,
        default_bucket_id: 6,
        done_bucket_id: 10,
        bucket_configuration_mode: "manual",
        bucket_configuration: [{ title: "Inbox" }],
        filter: { done: false },
      });
      expect(client.createBucket).toHaveBeenCalledWith(7, 9, {
        title: "Inbox",
        position: 3,
        limit: 5,
      });
      expect(client.createLabel).toHaveBeenCalledWith({
        title: "ready",
        hex_color: "#00ff00",
      });
    });
  });

  it("covers direct get/list tools added in the expansion", async () => {
    await withServer(async (server, client) => {
      client.getProject.mockResolvedValueOnce({ id: 7, title: "Stonegate Descent" });
      client.getLabel.mockResolvedValueOnce({ id: 5, title: "game design" });
      client.listTaskLabels.mockResolvedValueOnce({
        items: [{ id: 5, title: "game design" }],
        pagination: { page: 1, per_page: 10, total_pages: 1, result_count: 1 },
      });
      client.listTaskAssignees.mockResolvedValueOnce({
        items: [{ id: 2, username: "gm" }],
        pagination: { page: 1, per_page: 10, total_pages: 1, result_count: 1 },
      });
      client.getTaskComment.mockResolvedValueOnce({ id: 12, comment: "Lore" });

      expect(getStructuredContent(await callTool(server, "project_get", { project_id: 7 }))).toEqual({
        project: { id: 7, title: "Stonegate Descent" },
      });
      expect(getStructuredContent(await callTool(server, "label_get", { label_id: 5 }))).toEqual({
        label: { id: 5, title: "game design" },
      });
      expect(
        getStructuredContent(await callTool(server, "task_labels_list", { task_id: 16 })),
      ).toEqual({
        items: [{ id: 5, title: "game design" }],
        pagination: { page: 1, per_page: 10, total_pages: 1, result_count: 1 },
      });
      expect(
        getStructuredContent(await callTool(server, "task_assignees_list", { task_id: 16 })),
      ).toEqual({
        items: [{ id: 2, username: "gm" }],
        pagination: { page: 1, per_page: 10, total_pages: 1, result_count: 1 },
      });
      expect(
        getStructuredContent(await callTool(server, "task_comment_get", { task_id: 16, comment_id: 12 })),
      ).toEqual({
        comment: { id: 12, comment: "Lore" },
      });
    });
  });

  it("covers reaction schema validation and fallback verification branches", async () => {
    await withServer(async (server, client) => {
      client.listReactions
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ]);
      client.addReaction.mockResolvedValueOnce({
        value: "😀",
      });

      await expect(
        callTool(server, "reactions_list", {
          entity_kind: "labels",
          entity_id: 5,
        }),
      ).rejects.toThrow();

      expect(
        getStructuredContent(
          await callTool(server, "reaction_add", {
            entity_kind: "tasks",
            entity_id: 16,
            reaction: "😀",
          }),
        ),
      ).toEqual({
        entity_kind: "tasks",
        entity_id: 16,
        reaction: "😀",
        already_present: false,
        reactions: [
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ],
      });
    });
  });

  it("uses the project_delete fallback list check when the project getter still resolves", async () => {
    await withServer(async (server, client) => {
      client.getProject
        .mockResolvedValueOnce({ id: 7, title: "Temp" })
        .mockResolvedValueOnce({ id: 7, title: "Temp" });
      client.listProjects.mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 0 },
      });

      const result = await callTool(server, "project_delete", {
        project_id: 7,
        confirm: true,
      });

      expect(getStructuredContent(result).verification).toEqual({
        operation: "project_delete",
        verified: true,
      });
    });
  });

  it("returns verification errors for delete and association failure paths", async () => {
    await withServer(async (server, client) => {
      client.listBuckets
        .mockResolvedValueOnce([{ id: 11, title: "Inbox" }])
        .mockResolvedValueOnce([{ id: 11, title: "Inbox" }]);
      client.listViews.mockResolvedValueOnce([{ id: 9, title: "Board" }]);
      client.getTaskComment.mockResolvedValueOnce({ id: 12, comment: "Lore" }).mockResolvedValueOnce({
        id: 12,
        comment: "Lore",
      });
      client.listTaskRelations.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      client.listTaskAssignees
        .mockResolvedValueOnce({
          items: [],
          pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 0 },
        })
        .mockResolvedValueOnce({
          items: [],
          pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 0 },
        });

      expect(
        getErrorText(
          await callTool(server, "bucket_delete", {
            project_id: 7,
            view_id: 9,
            bucket_id: 11,
            confirm: true,
          }),
        ),
      ).toContain("bucket_delete verification failed");
      expect(
        getErrorText(
          await callTool(server, "view_delete", {
            project_id: 7,
            view_id: 9,
            confirm: true,
          }),
        ),
      ).toContain("view_delete verification failed");
      expect(
        getErrorText(
          await callTool(server, "task_comment_delete", {
            task_id: 16,
            comment_id: 12,
            confirm: true,
          }),
        ),
      ).toContain("task_comment_delete verification failed");
      expect(
        getErrorText(
          await callTool(server, "task_relation_create", {
            task_id: 16,
            relation_kind: "blocks",
            other_task_id: 22,
          }),
        ),
      ).toContain("task_relation_create verification failed");
      expect(
        getErrorText(
          await callTool(server, "task_assign_user", {
            task_id: 16,
            user_id: 2,
          }),
        ),
      ).toContain("task_assign_user verification failed");
    });
  });

  it("covers idempotent association branches for add and assign tools", async () => {
    await withServer(async (server, client) => {
      client.listTaskLabels.mockResolvedValueOnce({
        items: [{ id: 5, title: "ready" }],
        pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 1 },
      });
      client.listTaskAssignees.mockResolvedValueOnce({
        items: [{ id: 2, username: "gm" }],
        pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 1 },
      });

      expect(getStructuredContent(await callTool(server, "task_add_label", { task_id: 16, label_id: 5 }))).toEqual({
        task_id: 16,
        label_id: 5,
        already_present: true,
        labels: [{ id: 5, title: "ready" }],
      });
      expect(
        getStructuredContent(await callTool(server, "task_assign_user", { task_id: 16, user_id: 2 })),
      ).toEqual({
        task_id: 16,
        user_id: 2,
        already_present: true,
        assignees: [{ id: 2, username: "gm" }],
      });
    });
  });

  it("covers task_move without a requested position", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
        buckets: [{ id: 8, title: "Doing", project_view_id: 9 }],
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
      });

      expect(client.updateTaskPosition).not.toHaveBeenCalled();
      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_move",
        checked_fields: ["bucket_id"],
        verified: true,
        position_requested: null,
        position_verification: "not_requested",
      });
      expect(client.listTasks).not.toHaveBeenCalled();
    });
  });

  it("covers task_move board fallback when expanded buckets are unavailable", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({
        id: 16,
        title: "BOARD RULES",
        bucket_id: 0,
      });
      client.listTasks.mockResolvedValueOnce({
        items: [
          {
            id: 22,
            title: "Loose task row",
          },
          {
            id: 8,
            title: "Doing",
            project_view_id: 9,
            tasks: [{ id: 16, title: "BOARD RULES", position: 2 }],
          },
        ],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 2,
        },
      });

      const result = await callTool(server, "task_move", {
        task_id: 16,
        project_id: 7,
        view_id: 9,
        bucket_id: 8,
        position: 2,
      });

      expect(getStructuredContent(result).verification).toEqual({
        operation: "task_move",
        checked_fields: ["bucket_id"],
        verified: true,
        position_requested: 2,
        position_verification: "matched",
      });
    });
  });

  it("returns verification errors for task deletion, unassignment, and relation deletion failures", async () => {
    await withServer(async (server, client) => {
      client.getTask.mockResolvedValueOnce({ id: 16, title: "Temp" }).mockResolvedValueOnce({
        id: 16,
        title: "Temp",
      });
      client.listTaskAssignees
        .mockResolvedValueOnce({
          items: [{ id: 2, username: "gm" }],
          pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 1 },
        })
        .mockResolvedValueOnce({
          items: [{ id: 2, username: "gm" }],
          pagination: { page: 1, per_page: 1000, total_pages: 1, result_count: 1 },
        });
      client.listTaskRelations
        .mockResolvedValueOnce([{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }])
        .mockResolvedValueOnce([{ task_id: 16, relation_kind: "blocks", other_task_id: 22 }]);

      expect(
        getErrorText(await callTool(server, "task_delete", { task_id: 16, confirm: true })),
      ).toContain("task_delete verification failed");
      expect(
        getErrorText(await callTool(server, "task_unassign_user", { task_id: 16, user_id: 2 })),
      ).toContain("task_unassign_user verification failed");
      expect(
        getErrorText(
          await callTool(server, "task_relation_delete", {
            task_id: 16,
            relation_kind: "blocks",
            other_task_id: 22,
          }),
        ),
      ).toContain("task_relation_delete verification failed");
    });
  });

  it("returns verification errors for reaction add and remove guard paths", async () => {
    await withServer(async (server, client) => {
      client.listReactions
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            "😀": [{ id: 7, username: "gm" }],
          },
        ])
        .mockResolvedValueOnce([
          {
            "😀": [
              { id: 7, username: "gm" },
              { id: 3, username: "other" },
            ],
          },
        ]);
      client.addReaction.mockResolvedValueOnce({
        value: "😀",
        user: { id: 7, username: "gm" },
      });

      expect(
        getErrorText(
          await callTool(server, "reaction_add", {
            entity_kind: "tasks",
            entity_id: 16,
            reaction: "😀",
          }),
        ),
      ).toContain("reaction_add verification failed");
      expect(
        getErrorText(
          await callTool(server, "reaction_remove", {
            entity_kind: "comments",
            entity_id: 12,
            reaction: "😀",
          }),
        ),
      ).toContain("reaction count increased unexpectedly");
    });
  });

  it("covers read-tool error handling for comments and relations", async () => {
    await withServer(async (server, client) => {
      client.listTaskComments.mockRejectedValueOnce(new Error("comments unavailable"));
      client.getTaskComment.mockRejectedValueOnce(new Error("comment missing"));
      client.listTaskRelations.mockRejectedValueOnce(new Error("relations unavailable"));

      expect(
        getErrorText(await callTool(server, "task_comments_list", { task_id: 16 })),
      ).toBe("Error in task_comments_list: comments unavailable");
      expect(
        getErrorText(await callTool(server, "task_comment_get", { task_id: 16, comment_id: 12 })),
      ).toBe("Error in task_comment_get: comment missing");
      expect(
        getErrorText(await callTool(server, "task_relations_list", { task_id: 16 })),
      ).toBe("Error in task_relations_list: relations unavailable");
    });
  });

  it("covers defensive create guards for project, bucket, view, and label tools", async () => {
    await withServer(async (server) => {
      const projectCreate = getRegisteredTool(server, "project_create") as {
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      };
      const bucketCreate = getRegisteredTool(server, "bucket_create") as {
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      };
      const viewCreate = getRegisteredTool(server, "view_create") as {
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      };
      const labelCreate = getRegisteredTool(server, "label_create") as {
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      };

      expect(getErrorText(await projectCreate.handler({}))).toBe(
        "Error in project_create: title is required.",
      );
      expect(
        getErrorText(await bucketCreate.handler({ project_id: 7, view_id: 9 })),
      ).toBe("Error in bucket_create: title is required.");
      expect(getErrorText(await viewCreate.handler({ project_id: 7 }))).toBe(
        "Error in view_create: title is required.",
      );
      expect(getErrorText(await labelCreate.handler({}))).toBe(
        "Error in label_create: title is required.",
      );
    });
  });
});
