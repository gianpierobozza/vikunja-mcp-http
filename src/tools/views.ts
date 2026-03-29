import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi } from "../vikunja-client.js";
import { asJsonText, asTextContent, toolErrorResult, withToolLogging } from "./shared.js";

export function registerViewTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "views_list",
    {
      description: "List the views for a Vikunja project.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
      },
    },
    withToolLogging("views_list", async ({ project_id }) => {
      try {
        const result = {
          items: await client.listViews(project_id),
        };

        return {
          content: asTextContent(asJsonText(result)),
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("views_list", error);
      }
    }),
  );
}
