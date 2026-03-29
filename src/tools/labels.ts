import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi } from "../vikunja-client.js";
import { asJsonText, toolErrorResult } from "./shared.js";

const verificationPageSize = 1000;

export function registerLabelTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "labels_list",
    {
      description: "List Vikunja labels available to the configured API token.",
      inputSchema: {
        page: z.number().int().positive().optional().describe("Pagination page number."),
        per_page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of labels to return."),
        search: z.string().trim().min(1).optional().describe("Search labels by title."),
      },
    },
    async ({ page, per_page, search }) => {
      try {
        const result = await client.listLabels({
          page,
          perPage: per_page,
          search,
        });

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("labels_list", error);
      }
    },
  );

  server.registerTool(
    "task_add_label",
    {
      description: "Add a label to a Vikunja task and verify the final label state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        label_id: z.number().int().positive().describe("Label id."),
      },
    },
    async ({ task_id, label_id }) => {
      try {
        const currentLabels = await client.listTaskLabels(task_id, {
          perPage: verificationPageSize,
        });
        const alreadyPresent = currentLabels.items.some((label) => label.id === label_id);

        if (alreadyPresent) {
          const result = {
            task_id,
            label_id,
            already_present: true,
            labels: currentLabels.items,
          };

          return {
            content: [{ type: "text", text: asJsonText(result) }],
            structuredContent: result,
          };
        }

        await client.addLabelToTask(task_id, label_id);

        const finalLabels = await client.listTaskLabels(task_id, {
          perPage: verificationPageSize,
        });
        const verified = finalLabels.items.some((label) => label.id === label_id);

        if (!verified) {
          throw new Error("task_add_label verification failed: label was not present after the write.");
        }

        const result = {
          task_id,
          label_id,
          already_present: false,
          labels: finalLabels.items,
        };

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("task_add_label", error);
      }
    },
  );
}
