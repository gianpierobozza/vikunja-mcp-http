import { describe, expect, it } from "vitest";

import { VikunjaClientError } from "../src/vikunja-client.js";
import { asJsonText, getErrorMessage, toolErrorResult } from "../src/tools/shared.js";

describe("tool shared helpers", () => {
  it("formats JSON text with indentation", () => {
    expect(asJsonText({ ok: true })).toBe('{\n  "ok": true\n}');
  });

  it("extracts messages from VikunjaClientError", () => {
    const error = new VikunjaClientError("Upstream said no.", { statusCode: 403 });

    expect(getErrorMessage(error)).toBe("Upstream said no.");
  });

  it("extracts messages from regular errors", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("falls back for unknown error values", () => {
    expect(getErrorMessage({ nope: true })).toBe("Unexpected tool error.");
  });

  it("wraps tool failures in the expected MCP error result shape", () => {
    expect(toolErrorResult("projects_list", new Error("No token"))).toEqual({
      content: [
        {
          type: "text",
          text: "Error in projects_list: No token",
        },
      ],
      isError: true,
    });
  });
});
