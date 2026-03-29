import type { RequestHandler } from "express";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { SERVICE_NAME, SERVICE_VERSION } from "./config.js";
import { logError, logInfo, logWarn } from "./logger.js";
import { registerBucketTools } from "./tools/buckets.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerReactionTools } from "./tools/reactions.js";
import { registerRelationTools } from "./tools/relations.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerUserTools } from "./tools/users.js";
import { registerViewTools } from "./tools/views.js";
import type { VikunjaClientApi } from "./vikunja-client.js";

function getRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const requestBody = body as Record<string, unknown>;
  return typeof requestBody.method === "string" ? requestBody.method : undefined;
}

function getToolName(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const requestBody = body as Record<string, unknown>;

  if (requestBody.method !== "tools/call") {
    return undefined;
  }

  const params = requestBody.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }

  const toolParams = params as Record<string, unknown>;
  return typeof toolParams.name === "string" ? toolParams.name : undefined;
}

export function createMcpServer(client: VikunjaClientApi): McpServer {
  const server = new McpServer(
    {
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  registerProjectTools(server, client);
  registerTaskTools(server, client);
  registerLabelTools(server, client);
  registerUserTools(server, client);
  registerCommentTools(server, client);
  registerReactionTools(server, client);
  registerRelationTools(server, client);
  registerViewTools(server, client);
  registerBucketTools(server, client);

  return server;
}

export function createMcpHandler(client: VikunjaClientApi): RequestHandler {
  return async (request, response) => {
    const startedAt = Date.now();
    const rpcMethod = getRpcMethod(request.body);
    const toolName = getToolName(request.body);
    const server = createMcpServer(client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      logError("mcp", "request_failed", {
        method: request.method,
        path: request.path ?? request.originalUrl,
        rpc: rpcMethod,
        tool: toolName,
        message: error instanceof Error ? error.message : "Unexpected MCP error.",
        duration_ms: Date.now() - startedAt,
      });

      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    } finally {
      const status = response.statusCode;
      const log = status >= 500 ? logError : status >= 400 ? logWarn : logInfo;

      log("mcp", "request", {
        method: request.method,
        path: request.path ?? request.originalUrl,
        rpc: rpcMethod,
        tool: toolName,
        status,
        duration_ms: Date.now() - startedAt,
      });

      await Promise.allSettled([transport.close(), server.close()]);
    }
  };
}
