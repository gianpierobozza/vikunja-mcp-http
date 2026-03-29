import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../src/config.js";

type RequestScenario = {
  url?: URL;
  options?: {
    method?: string;
    agent?: unknown;
    timeout?: number;
    headers?: Record<string, string>;
  };
  writtenBody?: string;
  destroyedWith?: Error;
  statusCode?: number;
  headers?: Record<string, string>;
  responseChunks?: Array<string | Buffer>;
  triggerError?: Error;
  triggerTimeout?: boolean;
};

type RequestHandler = (
  url: URL,
  options: {
    method?: string;
    agent?: unknown;
    timeout?: number;
    headers?: Record<string, string>;
  },
  callback: (response: EventEmitter & { statusCode?: number; headers: Record<string, string> }) => void,
) => {
  on: (event: "timeout" | "error", handler: (error?: Error) => void) => unknown;
  write: (chunk: string) => void;
  end: () => void;
  destroy: (error: Error) => void;
};

const mockInternals = vi.hoisted(() => {
  class MockHttpAgent {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }

  class MockHttpsAgent {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }
  }

  return {
    state: {
      httpRequest: undefined as RequestHandler | undefined,
      httpsRequest: undefined as RequestHandler | undefined,
    },
    MockHttpAgent,
    MockHttpsAgent,
  };
});

vi.mock("node:http", () => ({
  Agent: mockInternals.MockHttpAgent,
  request: (...args: Parameters<RequestHandler>) => {
    if (!mockInternals.state.httpRequest) {
      throw new Error("No mocked HTTP request handler.");
    }

    return mockInternals.state.httpRequest(...args);
  },
}));

vi.mock("node:https", () => ({
  Agent: mockInternals.MockHttpsAgent,
  request: (...args: Parameters<RequestHandler>) => {
    if (!mockInternals.state.httpsRequest) {
      throw new Error("No mocked HTTPS request handler.");
    }

    return mockInternals.state.httpsRequest(...args);
  },
}));

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 4010,
    mcpBearerToken: "bridge-token",
    vikunjaBaseUrl: "https://vikunja.example.internal",
    vikunjaApiBaseUrl: "https://vikunja.example.internal/api/v1",
    vikunjaApiToken: "vikunja-token",
    verifySsl: true,
    ...overrides,
  };
}

function createRequestHandler(scenario: RequestScenario): RequestHandler {
  return (url, options, callback) => {
    scenario.url = url;
    scenario.options = options;

    const listeners = new Map<string, (error?: Error) => void>();
    const request = {
      on(event: "timeout" | "error", handler: (error?: Error) => void) {
        listeners.set(event, handler);
        return request;
      },
      write(chunk: string) {
        scenario.writtenBody = (scenario.writtenBody ?? "") + chunk;
      },
      end() {
        if (scenario.triggerTimeout) {
          listeners.get("timeout")?.();
          return;
        }

        if (scenario.triggerError) {
          listeners.get("error")?.(scenario.triggerError);
          return;
        }

        const response = new EventEmitter() as EventEmitter & {
          statusCode?: number;
          headers: Record<string, string>;
        };
        response.statusCode = scenario.statusCode;
        response.headers = scenario.headers ?? {};

        callback(response);

        for (const chunk of scenario.responseChunks ?? []) {
          response.emit("data", chunk);
        }

        response.emit("end");
      },
      destroy(error: Error) {
        scenario.destroyedWith = error;
        listeners.get("error")?.(error);
      },
    };

    return request;
  };
}

beforeEach(() => {
  vi.resetModules();
  mockInternals.state.httpRequest = undefined;
  mockInternals.state.httpsRequest = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VikunjaClient low-level request behavior", () => {
  it("builds https requests with query params, body JSON, and SSL settings", async () => {
    const scenario: RequestScenario = {
      statusCode: 201,
      headers: {
        "x-pagination-total-pages": "1",
      },
      responseChunks: [Buffer.from('{"ok":true}')],
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig({ verifySsl: false }));

    const result = await (client as unknown as { request: Function }).request("PUT", "/tasks/12/labels", {
      query: {
        expand: ["comments", "reactions"],
        page: 2,
        include_done: true,
      },
      body: {
        label_id: 7,
      },
      expectedStatusCodes: [201],
    });

    expect(result).toEqual({
      data: { ok: true },
      headers: {
        "x-pagination-total-pages": "1",
      },
      statusCode: 201,
    });
    expect(scenario.url?.toString()).toBe(
      "https://vikunja.example.internal/api/v1/tasks/12/labels?expand=comments&expand=reactions&page=2&include_done=true",
    );
    expect(scenario.options).toMatchObject({
      method: "PUT",
      timeout: 10000,
      headers: {
        accept: "application/json",
        authorization: "Bearer vikunja-token",
        "content-type": "application/json",
      },
    });
    expect((scenario.options?.agent as { options: { rejectUnauthorized: boolean } }).options).toMatchObject({
      keepAlive: false,
      rejectUnauthorized: false,
    });
    expect(scenario.writtenBody).toBe('{"label_id":7}');
  });

  it("builds plain http requests without a JSON body and parses empty responses", async () => {
    const scenario: RequestScenario = {
      statusCode: 204,
      responseChunks: [],
    };
    mockInternals.state.httpRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(
      createConfig({
        vikunjaBaseUrl: "http://vikunja.example.internal",
        vikunjaApiBaseUrl: "http://vikunja.example.internal/api/v1",
      }),
    );

    const result = await (client as unknown as { request: Function }).request("GET", "/projects", {});

    expect(result).toEqual({
      data: undefined,
      headers: {},
      statusCode: 204,
    });
    expect(scenario.url?.toString()).toBe("http://vikunja.example.internal/api/v1/projects");
    expect((scenario.options?.agent as { options: { keepAlive: boolean } }).options).toEqual({
      keepAlive: false,
    });
    expect(scenario.options?.headers).not.toHaveProperty("content-type");
    expect(scenario.writtenBody).toBeUndefined();
  });

  it("skips undefined query parameters when building a request URL", async () => {
    const scenario: RequestScenario = {
      statusCode: 200,
      responseChunks: [Buffer.from("{}")],
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await (client as unknown as { request: Function }).request("GET", "/projects", {
      query: {
        page: undefined,
        per_page: 5,
      },
    });

    expect(scenario.url?.toString()).toBe("https://vikunja.example.internal/api/v1/projects?per_page=5");
  });

  it("uses the JSON error message from an unsuccessful response body", async () => {
    const scenario: RequestScenario = {
      statusCode: 401,
      responseChunks: [Buffer.from('{"message":"Invalid Vikunja token."}')],
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { VikunjaClientError, createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await expect(
      (client as unknown as { request: Function }).request("GET", "/projects", {}),
    ).rejects.toEqual(
      expect.objectContaining<VikunjaClientError>({
        name: "VikunjaClientError",
        message: "Invalid Vikunja token.",
        statusCode: 401,
        responseBody: {
          message: "Invalid Vikunja token.",
        },
      }),
    );
  });

  it("uses a plain-text error body when JSON parsing fails", async () => {
    const scenario: RequestScenario = {
      statusCode: 502,
      responseChunks: ["Bad gateway"],
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await expect(
      (client as unknown as { request: Function }).request("GET", "/projects", {}),
    ).rejects.toMatchObject({
      message: "Bad gateway",
      statusCode: 502,
      responseBody: "Bad gateway",
    });
  });

  it("falls back to a generated error message when the body is blank", async () => {
    const scenario: RequestScenario = {
      statusCode: 500,
      responseChunks: [""],
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await expect(
      (client as unknown as { request: Function }).request("POST", "/tasks/2", {}),
    ).rejects.toMatchObject({
      message: "Vikunja POST /api/v1/tasks/2 failed with HTTP 500.",
      statusCode: 500,
      responseBody: undefined,
    });
  });

  it("wraps request timeouts as connectivity errors", async () => {
    const scenario: RequestScenario = {
      triggerTimeout: true,
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await expect(
      (client as unknown as { request: Function }).request("GET", "/projects", {}),
    ).rejects.toMatchObject({
      message: "Unable to connect to Vikunja.",
    });
    expect(scenario.destroyedWith).toBeInstanceOf(Error);
    expect(scenario.destroyedWith?.message).toBe("Request timed out");
  });

  it("wraps low-level request errors as connectivity errors", async () => {
    const scenario: RequestScenario = {
      triggerError: new Error("socket hang up"),
    };
    mockInternals.state.httpsRequest = createRequestHandler(scenario);
    const { createVikunjaClient } = await import("../src/vikunja-client.js");
    const client = createVikunjaClient(createConfig());

    await expect(
      (client as unknown as { request: Function }).request("GET", "/projects", {}),
    ).rejects.toMatchObject({
      message: "Unable to connect to Vikunja.",
    });
  });
});
