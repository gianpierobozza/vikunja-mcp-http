import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { CreateTaskInput, VikunjaClientApi, VikunjaTask } from "../vikunja-client.js";
import { toolErrorResult, asJsonText } from "./shared.js";

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

function requestedFields(patch: TaskPatch): Array<keyof TaskPatch> {
  return Object.keys(patch) as Array<keyof TaskPatch>;
}

function isEquivalentValue(expected: unknown, actual: unknown): boolean {
  if (expected == null && actual == null) {
    return true;
  }

  if (typeof expected === "string" && typeof actual === "string") {
    const expectedTime = Date.parse(expected);
    const actualTime = Date.parse(actual);

    if (!Number.isNaN(expectedTime) && !Number.isNaN(actualTime)) {
      return expectedTime === actualTime;
    }
  }

  return expected === actual;
}

function verifyTaskFields(operation: string, patch: TaskPatch, task: VikunjaTask): Array<keyof TaskPatch> {
  const fields = requestedFields(patch);
  const mismatchedField = fields.find((field) => !isEquivalentValue(patch[field], task[field]));

  if (mismatchedField) {
    throw new Error(
      `${operation} verification failed: field "${mismatchedField}" did not match the final task state.`,
    );
  }

  return fields;
}

function ensureTaskId(task: VikunjaTask, operation: string): number {
  if (typeof task.id !== "number") {
    throw new Error(`${operation} failed: Vikunja did not return a numeric task id.`);
  }

  return task.id;
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
    async ({
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

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("tasks_list", error);
      }
    },
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
    async ({ task_id, expand }) => {
      try {
        const task = await client.getTask(task_id, { expand });
        const result = { task };

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("task_get", error);
      }
    },
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
    async (args) => {
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
        const checkedFields = verifyTaskFields("task_create", patch, finalTask);
        const result = {
          task: finalTask,
          verification: {
            operation: "task_create",
            checked_fields: checkedFields,
            verified: true,
          },
        };

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("task_create", error);
      }
    },
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
    async (args) => {
      try {
        const { task_id } = args;
        const patch = buildTaskPatch(args);
        const fields = requestedFields(patch);

        if (fields.length === 0) {
          return toolErrorResult(
            "task_update",
            new Error("At least one updatable field must be provided."),
          );
        }

        const currentTask = await client.getTask(task_id);
        const alreadySatisfied = fields.every((field) =>
          isEquivalentValue(patch[field], currentTask[field]),
        );

        if (alreadySatisfied) {
          const result = {
            task: currentTask,
            verification: {
              operation: "task_update",
              checked_fields: fields,
              verified: true,
              already_satisfied: true,
            },
          };

          return {
            content: [{ type: "text", text: asJsonText(result) }],
            structuredContent: result,
          };
        }

        await client.updateTask(task_id, {
          ...currentTask,
          ...patch,
        });

        const finalTask = await client.getTask(task_id);
        const checkedFields = verifyTaskFields("task_update", patch, finalTask);
        const result = {
          task: finalTask,
          verification: {
            operation: "task_update",
            checked_fields: checkedFields,
            verified: true,
            already_satisfied: false,
          },
        };

        return {
          content: [{ type: "text", text: asJsonText(result) }],
          structuredContent: result,
        };
      } catch (error) {
        return toolErrorResult("task_update", error);
      }
    },
  );
}
