import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi } from "../vikunja-client.js";
import { asJsonText, toolErrorResult } from "./shared.js";

export function registerProjectTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "projects_list",
    {
      description: "List Vikunja projects available to the configured API token.",
      inputSchema: {
        page: z.number().int().positive().optional().describe("Pagination page number."),
        per_page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of projects to return."),
        search: z.string().trim().min(1).optional().describe("Search projects by title."),
      },
    },
    async ({ page, per_page, search }) => {
      try {
        const result = await client.listProjects({
          page,
          perPage: per_page,
          search,
        });

        return {
          content: [
            {
              type: "text",
              text: asJsonText(result),
            },
          ],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("projects_list", error);
      }
    },
  );
}
