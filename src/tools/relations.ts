import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi, VikunjaTaskRelation } from "../vikunja-client.js";
import { toolErrorResult, toolSuccessResult, withToolLogging } from "./shared.js";

function hasRelation(
  relations: VikunjaTaskRelation[],
  relationKind: string,
  otherTaskId: number,
): boolean {
  return relations.some(
    (relation) => relation.relation_kind === relationKind && relation.other_task_id === otherTaskId,
  );
}

export function registerRelationTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "task_relations_list",
    {
      description:
        "List task relations for a Vikunja task. This is derived from the task's related_tasks state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
      },
    },
    withToolLogging("task_relations_list", async ({ task_id }) => {
      try {
        const result = {
          items: await client.listTaskRelations(task_id),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("task_relations_list", error);
      }
    }),
  );

  server.registerTool(
    "task_relation_create",
    {
      description: "Create a relation between two tasks and verify the final relation state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        relation_kind: z.string().trim().min(1).describe("Relation kind."),
        other_task_id: z.number().int().positive().describe("Other task id."),
      },
    },
    withToolLogging("task_relation_create", async ({ task_id, relation_kind, other_task_id }) => {
      try {
        const currentRelations = await client.listTaskRelations(task_id);
        const alreadyPresent = hasRelation(currentRelations, relation_kind, other_task_id);

        if (alreadyPresent) {
          return toolSuccessResult({
            task_id,
            relation_kind,
            other_task_id,
            already_present: true,
            relations: currentRelations,
          });
        }

        await client.createTaskRelation(task_id, {
          relation_kind,
          other_task_id,
        });

        const finalRelations = await client.listTaskRelations(task_id);
        const verified = hasRelation(finalRelations, relation_kind, other_task_id);

        if (!verified) {
          throw new Error(
            "task_relation_create verification failed: relation was not present after the write.",
          );
        }

        return toolSuccessResult({
          task_id,
          relation_kind,
          other_task_id,
          already_present: false,
          relations: finalRelations,
        });
      } catch (error) {
        return toolErrorResult("task_relation_create", error);
      }
    }),
  );

  server.registerTool(
    "task_relation_delete",
    {
      description: "Delete a relation between two tasks and verify the final relation state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        relation_kind: z.string().trim().min(1).describe("Relation kind."),
        other_task_id: z.number().int().positive().describe("Other task id."),
      },
    },
    withToolLogging("task_relation_delete", async ({ task_id, relation_kind, other_task_id }) => {
      try {
        const currentRelations = await client.listTaskRelations(task_id);
        const alreadyAbsent = !hasRelation(currentRelations, relation_kind, other_task_id);

        if (alreadyAbsent) {
          return toolSuccessResult({
            task_id,
            relation_kind,
            other_task_id,
            already_absent: true,
            relations: currentRelations,
          });
        }

        await client.deleteTaskRelation(task_id, {
          relation_kind,
          other_task_id,
        });

        const finalRelations = await client.listTaskRelations(task_id);
        const removed = !hasRelation(finalRelations, relation_kind, other_task_id);

        if (!removed) {
          throw new Error(
            "task_relation_delete verification failed: relation was still present after the write.",
          );
        }

        return toolSuccessResult({
          task_id,
          relation_kind,
          other_task_id,
          already_absent: false,
          relations: finalRelations,
        });
      } catch (error) {
        return toolErrorResult("task_relation_delete", error);
      }
    }),
  );
}
