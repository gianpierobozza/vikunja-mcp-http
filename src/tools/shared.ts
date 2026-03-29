import { isDeepStrictEqual } from "node:util";

import { logError, logInfo, logWarn } from "../logger.js";
import { VikunjaClientError } from "../vikunja-client.js";

type ToolSuccessResult<T> = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
};

export function asJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function asTextContent(text: string) {
  return [{ type: "text" as const, text }];
}

export function toolSuccessResult<T>(value: T): ToolSuccessResult<T> {
  return {
    content: asTextContent(asJsonText(value)),
    structuredContent: value,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof VikunjaClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected tool error.";
}

export function toolErrorResult(operation: string, error: unknown) {
  return {
    content: asTextContent(`Error in ${operation}: ${getErrorMessage(error)}`),
    isError: true as const,
  };
}

type LoggedToolResult = {
  isError?: boolean;
  structuredContent?: unknown;
  content?: Array<{ text?: string }>;
};

function getToolStatus(structuredContent: unknown): string | undefined {
  if (!structuredContent || typeof structuredContent !== "object" || Array.isArray(structuredContent)) {
    return undefined;
  }

  const content = structuredContent as Record<string, unknown>;

  if (
    "already_present" in content &&
    typeof content.already_present === "boolean" &&
    content.already_present
  ) {
    return "already_present";
  }

  if ("already_absent" in content && typeof content.already_absent === "boolean" && content.already_absent) {
    return "already_absent";
  }

  if (
    "verification" in content &&
    content.verification &&
    typeof content.verification === "object" &&
    !Array.isArray(content.verification)
  ) {
    const verification = content.verification as Record<string, unknown>;

    if (
      "already_satisfied" in verification &&
      typeof verification.already_satisfied === "boolean" &&
      verification.already_satisfied
    ) {
      return "already_satisfied";
    }
  }

  return undefined;
}

function getToolErrorText(result: LoggedToolResult): string | undefined {
  const firstContent = result.content?.[0];
  return typeof firstContent?.text === "string" ? firstContent.text : undefined;
}

export function withToolLogging<TArgs, TResult extends LoggedToolResult>(
  operation: string,
  handler: (args: TArgs) => Promise<TResult>,
) {
  return async (args: TArgs): Promise<TResult> => {
    const startedAt = Date.now();

    try {
      const result = await handler(args);
      const duration = Date.now() - startedAt;

      if (result.isError) {
        logWarn("mcp", "tool", {
          name: operation,
          outcome: "error",
          duration_ms: duration,
          message: getToolErrorText(result),
        });
        return result;
      }

      logInfo("mcp", "tool", {
        name: operation,
        outcome: "ok",
        status: getToolStatus(result.structuredContent),
        duration_ms: duration,
      });
      return result;
    } catch (error) {
      logError("mcp", "tool", {
        name: operation,
        outcome: "error",
        duration_ms: Date.now() - startedAt,
        message: getErrorMessage(error),
      });
      throw error;
    }
  };
}

export function ensureConfirmed(operation: string, confirm: boolean | undefined): void {
  if (confirm !== true) {
    throw new Error(`${operation} requires confirm=true.`);
  }
}

export function requestedFields<T extends Record<string, unknown>>(patch: T): Array<keyof T> {
  return Object.keys(patch) as Array<keyof T>;
}

export function ensurePatchFields<T extends Record<string, unknown>>(
  operation: string,
  patch: T,
  message = "At least one updatable field must be provided.",
): Array<keyof T> {
  const fields = requestedFields(patch);

  if (fields.length === 0) {
    throw new Error(message);
  }

  return fields;
}

export function isEquivalentValue(expected: unknown, actual: unknown): boolean {
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

  return isDeepStrictEqual(expected, actual);
}

export function verifyRequestedFields<TRecord extends Record<string, unknown>, TPatch extends Record<string, unknown>>(
  operation: string,
  patch: TPatch,
  record: TRecord,
): Array<keyof TPatch> {
  const fields = requestedFields(patch);
  const mismatchedField = fields.find((field) => !isEquivalentValue(patch[field], record[field as keyof TRecord]));

  if (mismatchedField) {
    throw new Error(
      `${operation} verification failed: field "${String(mismatchedField)}" did not match the final state.`,
    );
  }

  return fields;
}

export function ensureNumericId(value: unknown, operation: string, fieldName = "id"): number {
  if (typeof value !== "number") {
    throw new Error(`${operation} failed: Vikunja did not return a numeric ${fieldName}.`);
  }

  return value;
}

export function findItemById<T extends { id?: unknown }>(
  items: T[],
  id: number,
  operation: string,
  resourceName: string,
): T {
  const item = items.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`${operation} verification failed: ${resourceName} ${id} was not found.`);
  }

  return item;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof VikunjaClientError && error.statusCode === 404;
}
