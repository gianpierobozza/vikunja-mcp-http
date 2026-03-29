import type { RequestHandler } from "express";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { SERVICE_NAME, SERVICE_VERSION } from "./config.js";
import { registerBucketTools } from "./tools/buckets.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerLabelTools } from "./tools/labels.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerRelationTools } from "./tools/relations.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerUserTools } from "./tools/users.js";
import { registerViewTools } from "./tools/views.js";
import type { VikunjaClientApi } from "./vikunja-client.js";

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
  registerRelationTools(server, client);
  registerViewTools(server, client);
  registerBucketTools(server, client);

  return server;
}

export function createMcpHandler(client: VikunjaClientApi): RequestHandler {
  return async (request, response) => {
    const server = createMcpServer(client);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);

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
      await Promise.allSettled([transport.close(), server.close()]);
    }
  };
}
