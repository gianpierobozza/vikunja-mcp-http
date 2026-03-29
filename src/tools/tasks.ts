import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CreateTaskInput, VikunjaClientApi, VikunjaTask } from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  ensurePatchFields,
  isEquivalentValue,
  isNotFoundError,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
  withToolLogging,
} from "./shared.js";

const optionalTaskMutationSchema = {
  description: z.string().optional().describe("Task description."),
  done: z.boolean().optional().describe("Whether the task is done."),
  priority: z.number().int().optional().describe("Task priority."),
  percent_done: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Task completion percentage from 0 to 100."),
  due_date: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .describe("Task due date as an ISO-like string, or null to clear it."),
  start_date: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .describe("Task start date as an ISO-like string, or null to clear it."),
  end_date: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .describe("Task end date as an ISO-like string, or null to clear it."),
};

const taskMutationSchema = {
  title: z.string().trim().min(1).optional().describe("Task title."),
  ...optionalTaskMutationSchema,
};

const taskExpandValueSchema = z.enum(["subtasks", "buckets", "reactions", "comments"]);

type TaskPatch = Partial<{
  title: string;
  description: string;
  done: boolean;
  priority: number;
  percent_done: number;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
}>;

function buildTaskPatch(args: Record<string, unknown>): TaskPatch {
  const patch: TaskPatch = {};

  if (args.title !== undefined) {
    patch.title = args.title as string;
  }

  if (args.description !== undefined) {
    patch.description = args.description as string;
  }

  if (args.done !== undefined) {
    patch.done = args.done as boolean;
  }

  if (args.priority !== undefined) {
    patch.priority = args.priority as number;
  }

  if (args.percent_done !== undefined) {
    patch.percent_done = args.percent_done as number;
  }

  if (args.due_date !== undefined) {
    patch.due_date = args.due_date as string | null;
  }

  if (args.start_date !== undefined) {
    patch.start_date = args.start_date as string | null;
  }

  if (args.end_date !== undefined) {
    patch.end_date = args.end_date as string | null;
  }

  return patch;
}

function ensureTaskId(task: VikunjaTask, operation: string): number {
  return ensureNumericId(task.id, operation, "task id");
}

export function registerTaskTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "tasks_list",
    {
      description: "List tasks for a specific Vikunja project view.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        page: z.number().int().positive().optional().describe("Pagination page number."),
        per_page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of results to return."),
        search: z.string().trim().min(1).optional().describe("Search tasks by title."),
        filter: z.string().trim().min(1).optional().describe("Vikunja filter query."),
        filter_include_nulls: z
          .boolean()
          .optional()
          .describe("Whether the filter should include null fields."),
        filter_timezone: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Timezone used when evaluating the filter."),
        sort_by: z.string().trim().min(1).optional().describe("Sort field."),
        order_by: z.string().trim().min(1).optional().describe("Sort order."),
      },
    },
    withToolLogging("tasks_list", async ({
      project_id,
      view_id,
      page,
      per_page,
      search,
      filter,
      filter_include_nulls,
      filter_timezone,
      sort_by,
      order_by,
    }) => {
      try {
        const result = await client.listTasks(project_id, view_id, {
          page,
          perPage: per_page,
          search,
          filter,
          filterIncludeNulls: filter_include_nulls,
          filterTimezone: filter_timezone,
          sortBy: sort_by,
          orderBy: order_by,
        });

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("tasks_list", error);
      }
    }),
  );

  server.registerTool(
    "task_get",
    {
      description: "Get a Vikunja task by id.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        expand: z
          .array(taskExpandValueSchema)
          .min(1)
          .optional()
          .describe("Optional related data to expand in the task response."),
      },
    },
    withToolLogging("task_get", async ({ task_id, expand }) => {
      try {
        const task = await client.getTask(task_id, { expand });
        return toolSuccessResult({ task });
      } catch (error) {
        return toolErrorResult("task_get", error);
      }
    }),
  );

  server.registerTool(
    "task_create",
    {
      description: "Create a task in a Vikunja project and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        title: z.string().trim().min(1).describe("Task title."),
        ...optionalTaskMutationSchema,
      },
    },
    withToolLogging("task_create", async (args) => {
      try {
        const { project_id } = args;
        const patch = buildTaskPatch(args);

        if (!patch.title) {
          return toolErrorResult("task_create", new Error("title is required."));
        }

        const createInput: CreateTaskInput = {
          title: patch.title,
          description: patch.description,
          done: patch.done,
          priority: patch.priority,
          percent_done: patch.percent_done,
          due_date: patch.due_date,
          start_date: patch.start_date,
          end_date: patch.end_date,
        };

        const createdTask = await client.createTask(project_id, createInput);
        const finalTask = await client.getTask(ensureTaskId(createdTask, "task_create"));
        const checkedFields = verifyRequestedFields("task_create", patch, finalTask);

        return toolSuccessResult({
          task: finalTask,
          verification: {
            operation: "task_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("task_create", error);
      }
    }),
  );

  server.registerTool(
    "task_update",
    {
      description: "Update a Vikunja task and verify the final state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        ...taskMutationSchema,
      },
    },
    withToolLogging("task_update", async (args) => {
      try {
        const { task_id } = args;
        const patch = buildTaskPatch(args);
        const fields = ensurePatchFields("task_update", patch);
        const currentTask = await client.getTask(task_id);
        const alreadySatisfied = fields.every((field) => isEquivalentValue(patch[field], currentTask[field]));

        if (alreadySatisfied) {
          return toolSuccessResult({
            task: currentTask,
            verification: {
              operation: "task_update",
              checked_fields: fields,
              verified: true,
              already_satisfied: true,
            },
          });
        }

        await client.updateTask(task_id, {
          ...currentTask,
          ...patch,
        });

        const finalTask = await client.getTask(task_id);
        const checkedFields = verifyRequestedFields("task_update", patch, finalTask);

        return toolSuccessResult({
          task: finalTask,
          verification: {
            operation: "task_update",
            checked_fields: checkedFields,
            verified: true,
            already_satisfied: false,
          },
        });
      } catch (error) {
        return toolErrorResult("task_update", error);
      }
    }),
  );

  server.registerTool(
    "task_delete",
    {
      description: "Delete a task and verify it is no longer accessible.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        confirm: z.boolean().optional().describe("Must be true to delete the task."),
      },
    },
    withToolLogging("task_delete", async ({ task_id, confirm }) => {
      try {
        ensureConfirmed("task_delete", confirm);

        const task = await client.getTask(task_id);
        await client.deleteTask(task_id);

        let deleted = false;

        try {
          await client.getTask(task_id);
        } catch (error) {
          if (isNotFoundError(error)) {
            deleted = true;
          } else {
            throw error;
          }
        }

        if (!deleted) {
          throw new Error("task_delete verification failed: task is still accessible after deletion.");
        }

        return toolSuccessResult({
          deleted: task,
          verification: {
            operation: "task_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("task_delete", error);
      }
    }),
  );

  server.registerTool(
    "task_move",
    {
      description: "Move a task to a different bucket and optionally request a new position.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        bucket_id: z.number().int().positive().describe("Destination bucket id."),
        position: z.number().optional().describe("Optional target position within the destination view."),
      },
    },
    withToolLogging("task_move", async ({ task_id, project_id, view_id, bucket_id, position }) => {
      try {
        await client.moveTaskToBucket(project_id, view_id, bucket_id, task_id);

        if (position !== undefined) {
          await client.updateTaskPosition(task_id, {
            project_view_id: view_id,
            position,
          });
        }

        const finalTask = await client.getTask(task_id);

        if (finalTask.bucket_id !== bucket_id) {
          throw new Error(
            `task_move verification failed: expected bucket_id ${bucket_id}, got ${String(finalTask.bucket_id)}.`,
          );
        }

        const positionMatched =
          position !== undefined && typeof finalTask.position === "number"
            ? finalTask.position === position
            : undefined;

        return toolSuccessResult({
          task: finalTask,
          verification: {
            operation: "task_move",
            checked_fields: ["bucket_id"],
            verified: true,
            position_requested: position ?? null,
            position_verification:
              position === undefined
                ? "not_requested"
                : positionMatched === true
                  ? "matched"
                  : "best_effort",
          },
        });
      } catch (error) {
        return toolErrorResult("task_move", error);
      }
    }),
  );
}
