import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

function createEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    PORT: "4010",
    MCP_BEARER_TOKEN: "bridge-token",
    VIKUNJA_URL: "https://vikunja.example.internal/api/v1/",
    VIKUNJA_API_TOKEN: "vikunja-token",
    ...overrides,
  };
}

describe("loadConfig", () => {
  it("normalizes the Vikunja base URL and API URL", () => {
    const config = loadConfig(createEnv());

    expect(config).toMatchObject({
      port: 4010,
      mcpBearerToken: "bridge-token",
      vikunjaBaseUrl: "https://vikunja.example.internal",
      vikunjaApiBaseUrl: "https://vikunja.example.internal/api/v1",
      vikunjaApiToken: "vikunja-token",
      verifySsl: true,
    });
  });

  it("parses VERIFY_SSL false-like values", () => {
    const config = loadConfig(createEnv({ VERIFY_SSL: "off" }));

    expect(config.verifySsl).toBe(false);
  });

  it("parses VERIFY_SSL true-like values", () => {
    const config = loadConfig(createEnv({ VERIFY_SSL: "on" }));

    expect(config.verifySsl).toBe(true);
  });

  it("defaults VERIFY_SSL to true when omitted", () => {
    const config = loadConfig(createEnv({ VERIFY_SSL: undefined }));

    expect(config.verifySsl).toBe(true);
  });

  it("throws for invalid VERIFY_SSL values", () => {
    expect(() => loadConfig(createEnv({ VERIFY_SSL: "maybe" }))).toThrow(
      "VERIFY_SSL must be a boolean value",
    );
  });

  it("rejects non-numeric PORT values instead of partially parsing them", () => {
    expect(() => loadConfig(createEnv({ PORT: "4010abc" }))).toThrow(
      "PORT must be an integer between 1 and 65535",
    );
  });

  it("rejects non-http Vikunja URLs", () => {
    expect(() => loadConfig(createEnv({ VIKUNJA_URL: "ftp://vikunja.example.internal" }))).toThrow(
      "VIKUNJA_URL must use http:// or https://",
    );
  });

  it("throws when a required environment variable is missing", () => {
    expect(() => loadConfig(createEnv({ MCP_BEARER_TOKEN: "" }))).toThrow(
      "MCP_BEARER_TOKEN is required",
    );
  });
});
