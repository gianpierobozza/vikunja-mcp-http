import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  CreateViewInput,
  UpdateViewInput,
  VikunjaClientApi,
  VikunjaProjectView,
} from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  ensurePatchFields,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
} from "./shared.js";

const optionalViewMutationSchema = {
  view_kind: z.string().trim().min(1).optional().describe("Project view kind."),
  position: z.number().optional().describe("Project view position."),
  default_bucket_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Default bucket id."),
  done_bucket_id: z.number().int().positive().optional().describe("Done bucket id."),
  bucket_configuration_mode: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Bucket configuration mode."),
  bucket_configuration: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Bucket configuration entries."),
  filter: z.unknown().optional().describe("Raw Vikunja view filter object."),
};

type ViewPatch = Partial<CreateViewInput>;

function buildViewPatch(args: Record<string, unknown>): ViewPatch {
  const patch: ViewPatch = {};

  if (args.title !== undefined) {
    patch.title = args.title as string;
  }

  if (args.view_kind !== undefined) {
    patch.view_kind = args.view_kind as string;
  }

  if (args.position !== undefined) {
    patch.position = args.position as number;
  }

  if (args.default_bucket_id !== undefined) {
    patch.default_bucket_id = args.default_bucket_id as number;
  }

  if (args.done_bucket_id !== undefined) {
    patch.done_bucket_id = args.done_bucket_id as number;
  }

  if (args.bucket_configuration_mode !== undefined) {
    patch.bucket_configuration_mode = args.bucket_configuration_mode as string;
  }

  if (args.bucket_configuration !== undefined) {
    patch.bucket_configuration = args.bucket_configuration as unknown[];
  }

  if (args.filter !== undefined) {
    patch.filter = args.filter;
  }

  return patch;
}

function ensureViewId(view: VikunjaProjectView, operation: string): number {
  return ensureNumericId(view.id, operation, "view id");
}

export function registerViewTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "views_list",
    {
      description: "List the views for a Vikunja project.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
      },
    },
    async ({ project_id }) => {
      try {
        const result = {
          items: await client.listViews(project_id),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("views_list", error);
      }
    },
  );

  server.registerTool(
    "view_create",
    {
      description: "Create a project view and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        title: z.string().trim().min(1).describe("Project view title."),
        ...optionalViewMutationSchema,
      },
    },
    async (args) => {
      try {
        const { project_id } = args;
        const patch = buildViewPatch(args);

        if (!patch.title) {
          return toolErrorResult("view_create", new Error("title is required."));
        }

        const createInput = patch as CreateViewInput;

        const createdView = await client.createView(project_id, createInput);
        const finalView = await client.getView(project_id, ensureViewId(createdView, "view_create"));
        const checkedFields = verifyRequestedFields("view_create", createInput, finalView);

        return toolSuccessResult({
          view: finalView,
          verification: {
            operation: "view_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("view_create", error);
      }
    },
  );

  server.registerTool(
    "view_update",
    {
      description: "Update a project view and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        title: z.string().trim().min(1).optional().describe("Project view title."),
        ...optionalViewMutationSchema,
      },
    },
    async (args) => {
      try {
        const { project_id, view_id } = args;
        const patch = buildViewPatch(args);
        ensurePatchFields("view_update", patch);
        const currentView = await client.getView(project_id, view_id);
        await client.updateView(project_id, view_id, {
          ...currentView,
          ...patch,
        } as UpdateViewInput);
        const finalView = await client.getView(project_id, view_id);
        const checkedFields = verifyRequestedFields("view_update", patch, finalView);

        return toolSuccessResult({
          view: finalView,
          verification: {
            operation: "view_update",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("view_update", error);
      }
    },
  );

  server.registerTool(
    "view_delete",
    {
      description: "Delete a project view and verify it is no longer listed.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        confirm: z.boolean().optional().describe("Must be true to delete the project view."),
      },
    },
    async ({ project_id, view_id, confirm }) => {
      try {
        ensureConfirmed("view_delete", confirm);

        const view = await client.getView(project_id, view_id);
        await client.deleteView(project_id, view_id);

        const finalViews = await client.listViews(project_id);
        const deleted = !finalViews.some((candidate) => candidate.id === view_id);

        if (!deleted) {
          throw new Error("view_delete verification failed: view is still listed after deletion.");
        }

        return toolSuccessResult({
          deleted: view,
          verification: {
            operation: "view_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("view_delete", error);
      }
    },
  );
}
