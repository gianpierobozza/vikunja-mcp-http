import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  CreateLabelInput,
  UpdateLabelInput,
  VikunjaClientApi,
  VikunjaLabel,
} from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  ensurePatchFields,
  isNotFoundError,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
} from "./shared.js";

const verificationPageSize = 1000;

const optionalLabelMutationSchema = {
  description: z.string().optional().describe("Label description."),
  hex_color: z.string().trim().min(1).optional().describe("Label hex color."),
};

type LabelPatch = Partial<CreateLabelInput>;

function buildLabelPatch(args: Record<string, unknown>): LabelPatch {
  const patch: LabelPatch = {};

  if (args.title !== undefined) {
    patch.title = args.title as string;
  }

  if (args.description !== undefined) {
    patch.description = args.description as string;
  }

  if (args.hex_color !== undefined) {
    patch.hex_color = args.hex_color as string;
  }

  return patch;
}

function ensureLabelId(label: VikunjaLabel, operation: string): number {
  return ensureNumericId(label.id, operation, "label id");
}

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

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("labels_list", error);
      }
    },
  );

  server.registerTool(
    "label_get",
    {
      description: "Get a Vikunja label by id.",
      inputSchema: {
        label_id: z.number().int().positive().describe("Label id."),
      },
    },
    async ({ label_id }) => {
      try {
        const label = await client.getLabel(label_id);
        return toolSuccessResult({ label });
      } catch (error) {
        return toolErrorResult("label_get", error);
      }
    },
  );

  server.registerTool(
    "label_create",
    {
      description: "Create a label and verify the final state.",
      inputSchema: {
        title: z.string().trim().min(1).describe("Label title."),
        ...optionalLabelMutationSchema,
      },
    },
    async (args) => {
      try {
        const patch = buildLabelPatch(args);

        if (!patch.title) {
          return toolErrorResult("label_create", new Error("title is required."));
        }

        const createInput = patch as CreateLabelInput;

        const createdLabel = await client.createLabel(createInput);
        const finalLabel = await client.getLabel(ensureLabelId(createdLabel, "label_create"));
        const checkedFields = verifyRequestedFields("label_create", createInput, finalLabel);

        return toolSuccessResult({
          label: finalLabel,
          verification: {
            operation: "label_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("label_create", error);
      }
    },
  );

  server.registerTool(
    "label_update",
    {
      description: "Update a label and verify the final state.",
      inputSchema: {
        label_id: z.number().int().positive().describe("Label id."),
        title: z.string().trim().min(1).optional().describe("Label title."),
        ...optionalLabelMutationSchema,
      },
    },
    async (args) => {
      try {
        const { label_id } = args;
        const patch = buildLabelPatch(args);
        ensurePatchFields("label_update", patch);
        const currentLabel = await client.getLabel(label_id);
        await client.updateLabel(label_id, {
          ...currentLabel,
          ...patch,
        } as UpdateLabelInput);
        const finalLabel = await client.getLabel(label_id);
        const checkedFields = verifyRequestedFields("label_update", patch, finalLabel);

        return toolSuccessResult({
          label: finalLabel,
          verification: {
            operation: "label_update",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("label_update", error);
      }
    },
  );

  server.registerTool(
    "label_delete",
    {
      description: "Delete a label and verify it is no longer accessible.",
      inputSchema: {
        label_id: z.number().int().positive().describe("Label id."),
        confirm: z.boolean().optional().describe("Must be true to delete the label."),
      },
    },
    async ({ label_id, confirm }) => {
      try {
        ensureConfirmed("label_delete", confirm);

        const label = await client.getLabel(label_id);
        await client.deleteLabel(label_id);

        let deleted = false;

        try {
          await client.getLabel(label_id);
        } catch (error) {
          if (isNotFoundError(error)) {
            deleted = true;
          } else {
            throw error;
          }
        }

        if (!deleted) {
          throw new Error("label_delete verification failed: label is still accessible after deletion.");
        }

        return toolSuccessResult({
          deleted: label,
          verification: {
            operation: "label_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("label_delete", error);
      }
    },
  );

  server.registerTool(
    "task_labels_list",
    {
      description: "List labels attached to a task.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
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
    async ({ task_id, page, per_page, search }) => {
      try {
        const result = await client.listTaskLabels(task_id, {
          page,
          perPage: per_page,
          search,
        });
        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("task_labels_list", error);
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
          return toolSuccessResult({
            task_id,
            label_id,
            already_present: true,
            labels: currentLabels.items,
          });
        }

        await client.addLabelToTask(task_id, label_id);

        const finalLabels = await client.listTaskLabels(task_id, {
          perPage: verificationPageSize,
        });
        const verified = finalLabels.items.some((label) => label.id === label_id);

        if (!verified) {
          throw new Error("task_add_label verification failed: label was not present after the write.");
        }

        return toolSuccessResult({
          task_id,
          label_id,
          already_present: false,
          labels: finalLabels.items,
        });
      } catch (error) {
        return toolErrorResult("task_add_label", error);
      }
    },
  );

  server.registerTool(
    "task_remove_label",
    {
      description: "Remove a label from a task and verify the final label state.",
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
        const alreadyAbsent = !currentLabels.items.some((label) => label.id === label_id);

        if (alreadyAbsent) {
          return toolSuccessResult({
            task_id,
            label_id,
            already_absent: true,
            labels: currentLabels.items,
          });
        }

        await client.removeLabelFromTask(task_id, label_id);

        const finalLabels = await client.listTaskLabels(task_id, {
          perPage: verificationPageSize,
        });
        const removed = !finalLabels.items.some((label) => label.id === label_id);

        if (!removed) {
          throw new Error("task_remove_label verification failed: label was still present after the write.");
        }

        return toolSuccessResult({
          task_id,
          label_id,
          already_absent: false,
          labels: finalLabels.items,
        });
      } catch (error) {
        return toolErrorResult("task_remove_label", error);
      }
    },
  );
}
