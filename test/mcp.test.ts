import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMcpHandler, createMcpServer } from "../src/mcp.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

function createResponse(headersSent = false) {
  const response = {
    headersSent,
    statusCode: 200,
    status: vi.fn().mockImplementation(function (statusCode: number) {
      response.statusCode = statusCode;
      return response;
    }),
    json: vi.fn().mockReturnThis(),
  };

  return response;
}

function createRequest(body: unknown = { ping: true }) {
  return {
    method: "POST",
    path: "/mcp",
    originalUrl: "/mcp",
    body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createMcpServer", () => {
  it("registers the expected core work tool set", async () => {
    const server = createMcpServer(createMockVikunjaClient());

    try {
      expect(
        Object.keys(
          (server as McpServer & { _registeredTools: Record<string, unknown> })._registeredTools,
        ),
      ).toEqual([
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
        "reactions_list",
        "reaction_add",
        "reaction_remove",
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
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1014);
    const connectSpy = vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    const handleSpy = vi
      .spyOn(StreamableHTTPServerTransport.prototype, "handleRequest")
      .mockResolvedValue(undefined);
    const transportCloseSpy = vi
      .spyOn(StreamableHTTPServerTransport.prototype, "close")
      .mockResolvedValue(undefined);
    const serverCloseSpy = vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const request = createRequest();
    const response = createResponse();

    await handler(request as never, response as never, vi.fn());

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(request, response, request.body);
    expect(transportCloseSpy).toHaveBeenCalledTimes(1);
    expect(serverCloseSpy).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "INFO mcp request method=POST path=/mcp status=200 duration_ms=14",
    );
  });

  it("logs rpc and tool metadata for tools/call requests", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1100).mockReturnValueOnce(1111);
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse();

    await handler(
      createRequest({
        method: "tools/call",
        params: {
          name: "tasks_list",
        },
      }) as never,
      response as never,
      vi.fn(),
    );

    expect(logSpy).toHaveBeenCalledWith(
      "INFO mcp request method=POST path=/mcp rpc=tools/call tool=tasks_list status=200 duration_ms=11",
    );
  });

  it("omits rpc metadata when the request body is not an object", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1200).mockReturnValueOnce(1206);
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse();

    await handler(createRequest("not-json-rpc") as never, response as never, vi.fn());

    expect(logSpy).toHaveBeenCalledWith(
      "INFO mcp request method=POST path=/mcp status=200 duration_ms=6",
    );
  });

  it("logs rpc metadata without a tool name when tools/call params are malformed", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1300).mockReturnValueOnce(1308);
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse();

    await handler(
      createRequest({
        method: "tools/call",
        params: "bad",
      }) as never,
      response as never,
      vi.fn(),
    );

    expect(logSpy).toHaveBeenCalledWith(
      "INFO mcp request method=POST path=/mcp rpc=tools/call status=200 duration_ms=8",
    );
  });

  it("returns a JSON-RPC 500 error when request handling throws before headers are sent", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(2000).mockReturnValueOnce(2016).mockReturnValueOnce(2018);
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(
      new Error("transport boom"),
    );
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse(false);

    await handler(createRequest({}) as never, response as never, vi.fn());

    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      'ERROR mcp request_failed method=POST path=/mcp message="transport boom" duration_ms=16',
    );
    expect(errorSpy).toHaveBeenNthCalledWith(
      2,
      "ERROR mcp request method=POST path=/mcp status=500 duration_ms=18",
    );
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
    vi.spyOn(Date, "now").mockReturnValueOnce(3000).mockReturnValueOnce(3015).mockReturnValueOnce(3019);
    vi.spyOn(McpServer.prototype, "connect").mockResolvedValue(undefined);
    vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(
      new Error("transport boom"),
    );
    vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
    vi.spyOn(McpServer.prototype, "close").mockResolvedValue(undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createMcpHandler(createMockVikunjaClient());
    const response = createResponse(true);

    await handler(createRequest({}) as never, response as never, vi.fn());

    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      'ERROR mcp request_failed method=POST path=/mcp message="transport boom" duration_ms=15',
    );
    expect(logSpy).toHaveBeenCalledWith(
      "INFO mcp request method=POST path=/mcp status=200 duration_ms=19",
    );
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
