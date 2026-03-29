import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type {
  CreateBucketInput,
  UpdateBucketInput,
  VikunjaBucket,
  VikunjaClientApi,
} from "../vikunja-client.js";
import {
  ensureConfirmed,
  ensureNumericId,
  ensurePatchFields,
  findItemById,
  toolErrorResult,
  toolSuccessResult,
  verifyRequestedFields,
} from "./shared.js";

const optionalBucketMutationSchema = {
  position: z.number().optional().describe("Bucket position."),
  limit: z.number().int().nullable().optional().describe("Optional bucket task limit."),
};

type BucketPatch = Partial<CreateBucketInput> & {
  limit?: number | null;
};

function buildBucketPatch(args: Record<string, unknown>): BucketPatch {
  const patch: BucketPatch = {};

  if (args.title !== undefined) {
    patch.title = args.title as string;
  }

  if (args.position !== undefined) {
    patch.position = args.position as number;
  }

  if (args.limit !== undefined) {
    patch.limit = args.limit as number | null;
  }

  return patch;
}

function ensureBucketId(bucket: VikunjaBucket, operation: string): number {
  return ensureNumericId(bucket.id, operation, "bucket id");
}

export function registerBucketTools(server: McpServer, client: VikunjaClientApi): void {
  server.registerTool(
    "buckets_list",
    {
      description: "List the kanban buckets for a Vikunja project view.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
      },
    },
    async ({ project_id, view_id }) => {
      try {
        const result = {
          items: await client.listBuckets(project_id, view_id),
        };

        return toolSuccessResult(result);
      } catch (error) {
        return toolErrorResult("buckets_list", error);
      }
    },
  );

  server.registerTool(
    "bucket_create",
    {
      description: "Create a bucket in a project view and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        title: z.string().trim().min(1).describe("Bucket title."),
        ...optionalBucketMutationSchema,
      },
    },
    async (args) => {
      try {
        const { project_id, view_id } = args;
        const patch = buildBucketPatch(args);

        if (!patch.title) {
          return toolErrorResult("bucket_create", new Error("title is required."));
        }

        const createInput = patch as CreateBucketInput;

        const createdBucket = await client.createBucket(project_id, view_id, createInput);
        const finalBuckets = await client.listBuckets(project_id, view_id);
        const finalBucket = findItemById(
          finalBuckets,
          ensureBucketId(createdBucket, "bucket_create"),
          "bucket_create",
          "bucket",
        );
        const checkedFields = verifyRequestedFields("bucket_create", createInput, finalBucket);

        return toolSuccessResult({
          bucket: finalBucket,
          verification: {
            operation: "bucket_create",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("bucket_create", error);
      }
    },
  );

  server.registerTool(
    "bucket_update",
    {
      description: "Update a bucket and verify the final state.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        bucket_id: z.number().int().positive().describe("Bucket id."),
        title: z.string().trim().min(1).optional().describe("Bucket title."),
        ...optionalBucketMutationSchema,
      },
    },
    async (args) => {
      try {
        const { project_id, view_id, bucket_id } = args;
        const patch = buildBucketPatch(args);
        ensurePatchFields("bucket_update", patch);
        const currentBuckets = await client.listBuckets(project_id, view_id);
        const currentBucket = findItemById(currentBuckets, bucket_id, "bucket_update", "bucket");

        await client.updateBucket(project_id, view_id, bucket_id, {
          ...currentBucket,
          ...patch,
        } as UpdateBucketInput);

        const finalBuckets = await client.listBuckets(project_id, view_id);
        const finalBucket = findItemById(finalBuckets, bucket_id, "bucket_update", "bucket");
        const checkedFields = verifyRequestedFields("bucket_update", patch, finalBucket);

        return toolSuccessResult({
          bucket: finalBucket,
          verification: {
            operation: "bucket_update",
            checked_fields: checkedFields,
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("bucket_update", error);
      }
    },
  );

  server.registerTool(
    "bucket_delete",
    {
      description: "Delete a bucket and verify it is no longer listed.",
      inputSchema: {
        project_id: z.number().int().positive().describe("Project id."),
        view_id: z.number().int().positive().describe("Project view id."),
        bucket_id: z.number().int().positive().describe("Bucket id."),
        confirm: z.boolean().optional().describe("Must be true to delete the bucket."),
      },
    },
    async ({ project_id, view_id, bucket_id, confirm }) => {
      try {
        ensureConfirmed("bucket_delete", confirm);

        const currentBuckets = await client.listBuckets(project_id, view_id);
        const bucket = findItemById(currentBuckets, bucket_id, "bucket_delete", "bucket");
        await client.deleteBucket(project_id, view_id, bucket_id);

        const finalBuckets = await client.listBuckets(project_id, view_id);
        const deleted = !finalBuckets.some((candidate) => candidate.id === bucket_id);

        if (!deleted) {
          throw new Error("bucket_delete verification failed: bucket is still listed after deletion.");
        }

        return toolSuccessResult({
          deleted: bucket,
          verification: {
            operation: "bucket_delete",
            verified: true,
          },
        });
      } catch (error) {
        return toolErrorResult("bucket_delete", error);
      }
    },
  );
}
