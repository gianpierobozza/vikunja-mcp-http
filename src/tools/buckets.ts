import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi } from "../vikunja-client.js";
import { asJsonText, toolErrorResult } from "./shared.js";

export function registerBucketTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "buckets_list",
    {
      description: "List the kanban buckets for a Vikunja project view.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
      },
    },
    async ({ project_id, view_id }) => {
      try {
        const result = {
          items: await client.listBuckets(project_id, view_id),
        };

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("buckets_list", error);
      }
    },
  );
}
