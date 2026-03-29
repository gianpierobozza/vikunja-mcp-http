import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi } from "../vikunja-client.js";
import { toolErrorResult, toolSuccessResult, withToolLogging } from "./shared.js";

const verificationPageSize = 1000;

export function registerUserTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "users_search",
    {
      description: "Search Vikunja users visible to the configured API token.",
      inputSchema: {
        search: z.string().trim().min(1).optional().describe("Search term."),
      },
    },
    withToolLogging("users_search", async ({ search }) => {
      try {
        const result = {
          items: await client.searchUsers({ search }),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("users_search", error);
      }
    }),
  );

  server.registerTool(
    "task_assignees_list",
    {
      description: "List assignees for a Vikunja task.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        page: z.number().int().positive().optional().describe("Pagination page number."),
        per_page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of assignees to return."),
        search: z.string().trim().min(1).optional().describe("Search assignees."),
      },
    },
    withToolLogging("task_assignees_list", async ({ task_id, page, per_page, search }) => {
      try {
        const result = await client.listTaskAssignees(task_id, {
          page,
          perPage: per_page,
          search,
        });

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("task_assignees_list", error);
      }
    }),
  );

  server.registerTool(
    "task_assign_user",
    {
      description: "Assign a user to a task and verify the final assignee state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        user_id: z.number().int().positive().describe("User id."),
      },
    },
    withToolLogging("task_assign_user", async ({ task_id, user_id }) => {
      try {
        const currentAssignees = await client.listTaskAssignees(task_id, {
          perPage: verificationPageSize,
        });
        const alreadyPresent = currentAssignees.items.some((user) => user.id === user_id);

        if (alreadyPresent) {
          return toolSuccessResult({
            task_id,
            user_id,
            already_present: true,
            assignees: currentAssignees.items,
          });
        }

        await client.addAssigneeToTask(task_id, user_id);

        const finalAssignees = await client.listTaskAssignees(task_id, {
          perPage: verificationPageSize,
        });
        const verified = finalAssignees.items.some((user) => user.id === user_id);

        if (!verified) {
          throw new Error("task_assign_user verification failed: assignee was not present after the write.");
        }

        return toolSuccessResult({
          task_id,
          user_id,
          already_present: false,
          assignees: finalAssignees.items,
        });
      } catch (error) {
        return toolErrorResult("task_assign_user", error);
      }
    }),
  );

  server.registerTool(
    "task_unassign_user",
    {
      description: "Remove a user assignment from a task and verify the final assignee state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        user_id: z.number().int().positive().describe("User id."),
      },
    },
    withToolLogging("task_unassign_user", async ({ task_id, user_id }) => {
      try {
        const currentAssignees = await client.listTaskAssignees(task_id, {
          perPage: verificationPageSize,
        });
        const alreadyAbsent = !currentAssignees.items.some((user) => user.id === user_id);

        if (alreadyAbsent) {
          return toolSuccessResult({
            task_id,
            user_id,
            already_absent: true,
            assignees: currentAssignees.items,
          });
        }

        await client.removeAssigneeFromTask(task_id, user_id);

        const finalAssignees = await client.listTaskAssignees(task_id, {
          perPage: verificationPageSize,
        });
        const removed = !finalAssignees.items.some((user) => user.id === user_id);

        if (!removed) {
          throw new Error(
            "task_unassign_user verification failed: assignee was still present after the write.",
          );
        }

        return toolSuccessResult({
          task_id,
          user_id,
          already_absent: false,
          assignees: finalAssignees.items,
        });
      } catch (error) {
        return toolErrorResult("task_unassign_user", error);
      }
    }),
  );
}
