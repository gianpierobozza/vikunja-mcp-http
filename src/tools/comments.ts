import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VikunjaClientApi, VikunjaTaskComment } from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  isEquivalentValue,
  isNotFoundError,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
  withToolLogging,
} from "./shared.js";

type CommentPatch = {
  comment: string;
};

function ensureCommentId(comment: VikunjaTaskComment, operation: string): number {
  return ensureNumericId(comment.id, operation, "comment id");
}

export function registerCommentTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "task_comments_list",
    {
      description: "List comments for a Vikunja task.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        order_by: z.string().trim().min(1).optional().describe("Comment ordering."),
      },
    },
    withToolLogging("task_comments_list", async ({ task_id, order_by }) => {
      try {
        const result = {
          items: await client.listTaskComments(task_id, {
            orderBy: order_by,
          }),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("task_comments_list", error);
      }
    }),
  );

  server.registerTool(
    "task_comment_get",
    {
      description: "Get a task comment by id.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        comment_id: z.number().int().positive().describe("Comment id."),
      },
    },
    withToolLogging("task_comment_get", async ({ task_id, comment_id }) => {
      try {
        const comment = await client.getTaskComment(task_id, comment_id);
        return toolSuccessResult({ comment });
      } catch (error) {
        return toolErrorResult("task_comment_get", error);
      }
    }),
  );

  server.registerTool(
    "task_comment_create",
    {
      description: "Create a task comment and verify the final state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        comment: z.string().trim().min(1).describe("Comment text."),
      },
    },
    withToolLogging("task_comment_create", async ({ task_id, comment }) => {
      try {
        const patch: CommentPatch = { comment };
        const createdComment = await client.createTaskComment(task_id, patch);
        const finalComment = await client.getTaskComment(
          task_id,
          ensureCommentId(createdComment, "task_comment_create"),
        );
        const checkedFields = verifyRequestedFields("task_comment_create", patch, finalComment);

        return toolSuccessResult({
          comment: finalComment,
          verification: {
            operation: "task_comment_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("task_comment_create", error);
      }
    }),
  );

  server.registerTool(
    "task_comment_update",
    {
      description: "Update a task comment and verify the final state.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        comment_id: z.number().int().positive().describe("Comment id."),
        comment: z.string().trim().min(1).describe("Updated comment text."),
      },
    },
    withToolLogging("task_comment_update", async ({ task_id, comment_id, comment }) => {
      try {
        const patch: CommentPatch = { comment };
        const currentComment = await client.getTaskComment(task_id, comment_id);

        if (isEquivalentValue(patch.comment, currentComment.comment)) {
          return toolSuccessResult({
            comment: currentComment,
            verification: {
              operation: "task_comment_update",
              checked_fields: ["comment"],
              verified: true,
              already_satisfied: true,
            },
          });
        }

        await client.updateTaskComment(task_id, comment_id, patch);
        const finalComment = await client.getTaskComment(task_id, comment_id);
        const checkedFields = verifyRequestedFields("task_comment_update", patch, finalComment);

        return toolSuccessResult({
          comment: finalComment,
          verification: {
            operation: "task_comment_update",
            checked_fields: checkedFields,
            verified: true,
            already_satisfied: false,
          },
        });
      } catch (error) {
        return toolErrorResult("task_comment_update", error);
      }
    }),
  );

  server.registerTool(
    "task_comment_delete",
    {
      description: "Delete a task comment and verify it is no longer accessible.",
      inputSchema: {
        task_id: z.number().int().positive().describe("Task id."),
        comment_id: z.number().int().positive().describe("Comment id."),
        confirm: z.boolean().optional().describe("Must be true to delete the comment."),
      },
    },
    withToolLogging("task_comment_delete", async ({ task_id, comment_id, confirm }) => {
      try {
        ensureConfirmed("task_comment_delete", confirm);

        const comment = await client.getTaskComment(task_id, comment_id);
        await client.deleteTaskComment(task_id, comment_id);

        let deleted = false;

        try {
          await client.getTaskComment(task_id, comment_id);
        } catch (error) {
          if (isNotFoundError(error)) {
            deleted = true;
          } else {
            throw error;
          }
        }

        if (!deleted) {
          throw new Error(
            "task_comment_delete verification failed: comment is still accessible after deletion.",
          );
        }

        return toolSuccessResult({
          deleted: comment,
          verification: {
            operation: "task_comment_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("task_comment_delete", error);
      }
    }),
  );
}
