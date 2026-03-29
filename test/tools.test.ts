import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpServer } from "../src/mcp.js";
import { callTool } from "./helpers/mcp.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

function getStructuredContent(result: unknown): Record<string, unknown> {
  const toolResult = result as ToolResult;

  if (toolResult.isError || !toolResult.structuredContent) {
    throw new Error("Expected a successful tool result with structured content.");
  }

  return toolResult.structuredContent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP tool behavior", () => {
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

  it("verifies task_create with the final read-back task", async () => {
    await withServer(async (server, client) => {
      client.createTask.mockResolvedValueOnce({
        id: 42,
        title: "Draft task",
      });
      client.getTask.mockResolvedValueOnce({
        id: 42,
        title: "Stonegate checklist",
        description: "Final description",
      });

      const result = await callTool(server, "task_create", {
        project_id: 7,
        title: "Stonegate checklist",
        description: "Final description",
      });
      const structured = getStructuredContent(result);

      expect(client.createTask).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          title: "Stonegate checklist",
          description: "Final description",
        }),
      );
      expect(client.getTask).toHaveBeenCalledWith(42);
      expect(structured.task).toEqual({
        id: 42,
        title: "Stonegate checklist",
        description: "Final description",
      });
      expect(structured.verification).toEqual({
        operation: "task_create",
        checked_fields: ["title", "description"],
        verified: true,
      });
    });
  });

  it("returns already_satisfied for no-op task updates", async () => {
    await withServer(async (server, client) => {
      vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1009);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      client.getTask.mockResolvedValueOnce({
        id: 9,
        title: "BOARD RULES",
        description: "Keep things tidy.",
      });

      const result = await callTool(server, "task_update", {
        task_id: 9,
        description: "Keep things tidy.",
      });
      const structured = getStructuredContent(result);

      expect(client.updateTask).not.toHaveBeenCalled();
      expect(structured.verification).toEqual({
        operation: "task_update",
        checked_fields: ["description"],
        verified: true,
        already_satisfied: true,
      });
      expect(logSpy).toHaveBeenCalledWith(
        "INFO mcp tool name=task_update outcome=ok status=already_satisfied duration_ms=9",
      );
    });
  });

  it("accepts equivalent date strings during task_update verification", async () => {
    await withServer(async (server, client) => {
      client.getTask
        .mockResolvedValueOnce({
          id: 16,
          title: "Schedule session",
          due_date: null,
        })
        .mockResolvedValueOnce({
          id: 16,
          title: "Schedule session",
          due_date: "2026-03-29T08:00:00.000Z",
        });
      client.updateTask.mockResolvedValueOnce({
        id: 16,
        title: "Schedule session",
        due_date: "2026-03-29T08:00:00.000Z",
      });

      const result = await callTool(server, "task_update", {
        task_id: 16,
        due_date: "2026-03-29T10:00:00+02:00",
      });
      const structured = getStructuredContent(result);

      expect(client.updateTask).toHaveBeenCalledTimes(1);
      expect(structured.verification).toEqual({
        operation: "task_update",
        checked_fields: ["due_date"],
        verified: true,
        already_satisfied: false,
      });
    });
  });

  it("returns already_present when adding a label that is already attached", async () => {
    await withServer(async (server, client) => {
      vi.spyOn(Date, "now").mockReturnValueOnce(2000).mockReturnValueOnce(2007);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      client.listTaskLabels.mockResolvedValueOnce({
        items: [{ id: 5, title: "game design" }],
        pagination: {
          page: 1,
          per_page: 1000,
          total_pages: 1,
          result_count: 1,
        },
      });

      const result = await callTool(server, "task_add_label", {
        task_id: 16,
        label_id: 5,
      });
      const structured = getStructuredContent(result);

      expect(client.addLabelToTask).not.toHaveBeenCalled();
      expect(structured).toEqual({
        task_id: 16,
        label_id: 5,
        already_present: true,
        labels: [{ id: 5, title: "game design" }],
      });
      expect(logSpy).toHaveBeenCalledWith(
        "INFO mcp tool name=task_add_label outcome=ok status=already_present duration_ms=7",
      );
    });
  });

  it("verifies label presence after a successful label add", async () => {
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
          items: [{ id: 6, title: "ready" }],
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
      const structured = getStructuredContent(result);

      expect(client.addLabelToTask).toHaveBeenCalledWith(12, 6);
      expect(structured).toEqual({
        task_id: 12,
        label_id: 6,
        already_present: false,
        labels: [{ id: 6, title: "ready" }],
      });
    });
  });
});
