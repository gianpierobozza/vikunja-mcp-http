import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpHandler, createMcpServer } from "../src/mcp.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

function createResponse(headersSent = false) {
  return {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMcpServer", () => {
  it("registers the expected core work tool set", async () => {
    const server = createMcpServer(createMockVikunjaClient());

    try {
      expect(Object.keys((server as McpServer & { _registeredTools: Record<string, unknown> })._registeredTools)).toEqual([
        "projects_list",
        "project_get",
        "project_create",
        "project_update",
        "project_delete",
        "tasks_list",
        "task_get",
        "task_create",
        "task_update",
        "task_delete",
        "task_move",
        "labels_list",
        "label_get",
        "label_create",
        "label_update",
        "label_delete",
        "task_labels_list",
        "task_add_label",
        "task_remove_label",
        "users_search",
        "task_assignees_list",
        "task_assign_user",
        "task_unassign_user",
        "task_comments_list",
        "task_comment_get",
        "task_comment_create",
        "task_comment_update",
        "task_comment_delete",
        "task_relations_list",
        "task_relation_create",
        "task_relation_delete",
        "views_list",
        "view_create",
        "view_update",
        "view_delete",
        "buckets_list",
        "bucket_create",
        "bucket_update",
        "bucket_delete",
      ]);
    } finally {
      await server.close();
    }
  });
});

describe("createMcpHandler", () => {
  it("connects the server, delegates to the transport, and closes both sides on success", async () => {
    const connectSpy = vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    const handleSpy = vi
      .spyOn(StreamableHTTPServerTransport.prototype, "handleRequest")
      .mockResolvedValue(undefined);
    const transportCloseSpy = vi
      .spyOn(StreamableHTTPServerTransport.prototype, "close")
      .mockResolvedValue(undefined);
    const serverCloseSpy = vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const handler = createMcpHandler(createMockVikunjaClient());
    const request = { body: { ping: true } };
    const response = createResponse();

    await handler(request as never, response as never, vi.fn());

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(request, response, request.body);
    expect(transportCloseSpy).toHaveBeenCalledTimes(1);
    expect(serverCloseSpy).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns a JSON-RPC 500 error when request handling throws before headers are sent", async () => {
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(
      new Error("transport boom"),
    );
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse(false);

    await handler({ body: {} } as never, response as never, vi.fn());

    expect(errorSpy).toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal server error",
      },
      id: null,
    });
  });

  it("does not write a second response when headers were already sent", async () => {
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(
      new Error("transport boom"),
    );
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse(true);

    await handler({ body: {} } as never, response as never, vi.fn());

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
