import { logError, logInfo, logWarn } from "../logger.js";
import { VikunjaClientError } from "../vikunja-client.js";

export function asJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function asTextContent(text: string) {
  return [{ type: "text" as const, text }];
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
