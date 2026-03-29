import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  ReactionEntityKind,
  VikunjaClientApi,
  VikunjaReaction,
  VikunjaReactionMap,
  VikunjaUser,
} from "../vikunja-client.js";
import { toolErrorResult, toolSuccessResult, withToolLogging } from "./shared.js";

const reactionEntityKindSchema = z.enum(["tasks", "comments"]);

function getReactionUsers(reactions: VikunjaReactionMap[], reaction: string): VikunjaUser[] {
  const users: VikunjaUser[] = [];

  for (const reactionMap of reactions) {
    const candidates = reactionMap[reaction];

    if (Array.isArray(candidates)) {
      users.push(...candidates);
    }
  }

  return users;
}

function getReactionUserCount(reactions: VikunjaReactionMap[], reaction: string): number {
  return getReactionUsers(reactions, reaction).length;
}

function getReactionUserId(reaction: VikunjaReaction): number | undefined {
  return typeof reaction.user?.id === "number" ? reaction.user.id : undefined;
}

function hasReactionForUser(
  reactions: VikunjaReactionMap[],
  reaction: string,
  userId: number,
): boolean {
  return getReactionUsers(reactions, reaction).some((user) => user.id === userId);
}

function isReactionVerified(
  reactions: VikunjaReactionMap[],
  reactionValue: string,
  userId: number | undefined,
): boolean {
  if (userId !== undefined) {
    return hasReactionForUser(reactions, reactionValue, userId);
  }

  return getReactionUserCount(reactions, reactionValue) > 0;
}

function inferAlreadyPresent(
  before: VikunjaReactionMap[],
  after: VikunjaReactionMap[],
  reactionValue: string,
  userId: number | undefined,
): boolean {
  if (userId !== undefined) {
    return hasReactionForUser(before, reactionValue, userId);
  }

  return getReactionUserCount(before, reactionValue) === getReactionUserCount(after, reactionValue);
}

export function registerReactionTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "reactions_list",
    {
      description: "List reactions for a Vikunja task or task comment.",
      inputSchema: {
        entity_kind: reactionEntityKindSchema.describe("Entity kind. Supported values: tasks, comments."),
        entity_id: z.number().int().positive().describe("Entity id."),
      },
    },
    withToolLogging("reactions_list", async ({ entity_kind, entity_id }) => {
      try {
        const result = {
          items: await client.listReactions(entity_kind as ReactionEntityKind, entity_id),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("reactions_list", error);
      }
    }),
  );

  server.registerTool(
    "reaction_add",
    {
      description: "Add a reaction to a Vikunja task or task comment and verify the final state.",
      inputSchema: {
        entity_kind: reactionEntityKindSchema.describe("Entity kind. Supported values: tasks, comments."),
        entity_id: z.number().int().positive().describe("Entity id."),
        reaction: z.string().trim().min(1).max(20).describe("Reaction value, usually an emoji."),
      },
    },
    withToolLogging("reaction_add", async ({ entity_kind, entity_id, reaction }) => {
      try {
        const before = await client.listReactions(entity_kind as ReactionEntityKind, entity_id);
        const createdReaction = await client.addReaction(entity_kind as ReactionEntityKind, entity_id, reaction);
        const currentUserId = getReactionUserId(createdReaction);
        const after = await client.listReactions(entity_kind as ReactionEntityKind, entity_id);

        if (!isReactionVerified(after, reaction, currentUserId)) {
          throw new Error("reaction_add verification failed: reaction was not present after the write.");
        }

        return toolSuccessResult({
          entity_kind,
          entity_id,
          reaction,
          already_present: inferAlreadyPresent(before, after, reaction, currentUserId),
          reactions: after,
        });
      } catch (error) {
        return toolErrorResult("reaction_add", error);
      }
    }),
  );

  server.registerTool(
    "reaction_remove",
    {
      description: "Remove the current user's reaction from a Vikunja task or task comment.",
      inputSchema: {
        entity_kind: reactionEntityKindSchema.describe("Entity kind. Supported values: tasks, comments."),
        entity_id: z.number().int().positive().describe("Entity id."),
        reaction: z.string().trim().min(1).max(20).describe("Reaction value, usually an emoji."),
      },
    },
    withToolLogging("reaction_remove", async ({ entity_kind, entity_id, reaction }) => {
      try {
        const before = await client.listReactions(entity_kind as ReactionEntityKind, entity_id);
        const beforeCount = getReactionUserCount(before, reaction);

        if (beforeCount === 0) {
          return toolSuccessResult({
            entity_kind,
            entity_id,
            reaction,
            already_absent: true,
            reactions: before,
          });
        }

        await client.removeReaction(entity_kind as ReactionEntityKind, entity_id, reaction);
        const after = await client.listReactions(entity_kind as ReactionEntityKind, entity_id);
        const afterCount = getReactionUserCount(after, reaction);

        if (afterCount > beforeCount) {
          throw new Error("reaction_remove verification failed: reaction count increased unexpectedly.");
        }

        return toolSuccessResult({
          entity_kind,
          entity_id,
          reaction,
          already_absent: afterCount === beforeCount,
          reactions: after,
        });
      } catch (error) {
        return toolErrorResult("reaction_remove", error);
      }
    }),
  );
}
