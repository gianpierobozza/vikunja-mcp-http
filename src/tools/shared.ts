import { VikunjaClientError } from "../vikunja-client.js";

export function asJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
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
