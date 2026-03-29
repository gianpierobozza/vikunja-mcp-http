import { isDeepStrictEqual } from "node:util";

import { VikunjaClientError } from "../vikunja-client.js";

type ToolSuccessResult<T> = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: T;
};

export function asJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function toolSuccessResult<T>(value: T): ToolSuccessResult<T> {
  return {
    content: [{ type: "text", text: asJsonText(value) }],
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
    content: [
      {
        type: "text" as const,
        text: `Error in ${operation}: ${getErrorMessage(error)}`,
      },
    ],
    isError: true as const,
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
