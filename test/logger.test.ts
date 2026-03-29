import { afterEach, describe, expect, it, vi } from "vitest";

import { formatLogLine, logError, logInfo, logWarn } from "../src/logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("formats single-line key-value logs and omits undefined fields", () => {
    expect(
      formatLogLine("INFO", "mcp", "tool", {
        name: "tasks_list",
        status: undefined,
        duration_ms: 18,
        message: "Invalid Vikunja token.",
      }),
    ).toBe(
      'INFO mcp tool name=tasks_list duration_ms=18 message="Invalid Vikunja token."',
    );
  });

  it("routes INFO, WARN, and ERROR logs to the expected console methods", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logInfo("server", "listening", { port: 4010 });
    logWarn("auth", "unauthorized", { path: "/mcp" });
    logError("server", "startup_failed", { message: "boom" });

    expect(logSpy).toHaveBeenCalledWith("INFO server listening port=4010");
    expect(warnSpy).toHaveBeenCalledWith("WARN auth unauthorized path=/mcp");
    expect(errorSpy).toHaveBeenCalledWith("ERROR server startup_failed message=boom");
  });
});
