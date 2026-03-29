import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  CreateProjectInput,
  UpdateProjectInput,
  VikunjaClientApi,
  VikunjaProject,
} from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  ensurePatchFields,
  isNotFoundError,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
  withToolLogging,
} from "./shared.js";

const optionalProjectMutationSchema = {
  description: z.string().optional().describe("Project description."),
  hex_color: z.string().trim().min(1).optional().describe("Project hex color."),
  identifier: z.string().trim().min(1).optional().describe("Project identifier."),
  is_archived: z.boolean().optional().describe("Whether the project is archived."),
  is_favorite: z.boolean().optional().describe("Whether the project is a favorite."),
  parent_project_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("Parent project id, or null to clear it."),
  position: z.number().optional().describe("Project position."),
};

type ProjectPatch = Partial<CreateProjectInput>;

function buildProjectPatch(args: Record<string, unknown>): ProjectPatch {
  const patch: ProjectPatch = {};

  if (args.title !== undefined) {
    patch.title = args.title as string;
  }

  if (args.description !== undefined) {
    patch.description = args.description as string;
  }

  if (args.hex_color !== undefined) {
    patch.hex_color = args.hex_color as string;
  }

  if (args.identifier !== undefined) {
    patch.identifier = args.identifier as string;
  }

  if (args.is_archived !== undefined) {
    patch.is_archived = args.is_archived as boolean;
  }

  if (args.is_favorite !== undefined) {
    patch.is_favorite = args.is_favorite as boolean;
  }

  if (args.parent_project_id !== undefined) {
    patch.parent_project_id = args.parent_project_id as number | null;
  }

  if (args.position !== undefined) {
    patch.position = args.position as number;
  }

  return patch;
}

function ensureProjectId(project: VikunjaProject, operation: string): number {
  return ensureNumericId(project.id, operation, "project id");
}

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
    withToolLogging("projects_list", async ({ page, per_page, search }) => {
      try {
        const result = await client.listProjects({
          page,
          perPage: per_page,
          search,
        });

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("projects_list", error);
      }
    }),
  );

  server.registerTool(
    "project_get",
    {
      description: "Get a Vikunja project by id.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
      },
    },
    withToolLogging("project_get", async ({ project_id }) => {
      try {
        const project = await client.getProject(project_id);
        return toolSuccessResult({ project });
      } catch (error) {
        return toolErrorResult("project_get", error);
      }
    }),
  );

  server.registerTool(
    "project_create",
    {
      description: "Create a Vikunja project and verify the final state.",
      inputSchema: {
        title: z.string().trim().min(1).describe("Project title."),
        ...optionalProjectMutationSchema,
      },
    },
    withToolLogging("project_create", async (args) => {
      try {
        const patch = buildProjectPatch(args);

        if (!patch.title) {
          return toolErrorResult("project_create", new Error("title is required."));
        }

        const createInput = patch as CreateProjectInput;

        const createdProject = await client.createProject(createInput);
        const projectId = ensureProjectId(createdProject, "project_create");
        const finalProject = await client.getProject(projectId);
        const checkedFields = verifyRequestedFields("project_create", createInput, finalProject);

        return toolSuccessResult({
          project: finalProject,
          verification: {
            operation: "project_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("project_create", error);
      }
    }),
  );

  server.registerTool(
    "project_update",
    {
      description: "Update a Vikunja project and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        title: z.string().trim().min(1).optional().describe("Project title."),
        ...optionalProjectMutationSchema,
      },
    },
    withToolLogging("project_update", async (args) => {
      try {
        const { project_id } = args;
        const patch = buildProjectPatch(args);
        ensurePatchFields("project_update", patch);
        const currentProject = await client.getProject(project_id);
        const updatedProject = await client.updateProject(project_id, {
          ...currentProject,
          ...patch,
        } as UpdateProjectInput);
        const finalProject = await client.getProject(ensureProjectId(updatedProject, "project_update"));
        const checkedFields = verifyRequestedFields("project_update", patch, finalProject);

        return toolSuccessResult({
          project: finalProject,
          verification: {
            operation: "project_update",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("project_update", error);
      }
    }),
  );

  server.registerTool(
    "project_delete",
    {
      description: "Delete a project and verify it is no longer accessible.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        confirm: z.boolean().optional().describe("Must be true to delete the project."),
      },
    },
    withToolLogging("project_delete", async ({ project_id, confirm }) => {
      try {
        ensureConfirmed("project_delete", confirm);

        const project = await client.getProject(project_id);
        await client.deleteProject(project_id);

        let deleted = false;

        try {
          await client.getProject(project_id);
        } catch (error) {
          if (isNotFoundError(error)) {
            deleted = true;
          } else {
            throw error;
          }
        }

        if (!deleted) {
          const visibleProjects = await client.listProjects({
            perPage: 1000,
            search: project.title,
          });
          deleted = !visibleProjects.items.some((candidate) => candidate.id === project_id);
        }

        if (!deleted) {
          throw new Error("project_delete verification failed: project is still visible after deletion.");
        }

        return toolSuccessResult({
          deleted: project,
          verification: {
            operation: "project_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("project_delete", error);
      }
    }),
  );
}
