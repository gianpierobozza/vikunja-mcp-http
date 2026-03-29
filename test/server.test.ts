import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../src/config.js";
import { createApp, startServer } from "../src/server.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

type ExpressLayer = {
  handle: (...args: unknown[]) => unknown;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      handle: (...args: unknown[]) => unknown;
    }>;
  };
};

function createConfig(): AppConfig {
  return {
    port: 4010,
    mcpBearerToken: "bridge-token",
    vikunjaBaseUrl: "https://vikunja.example.internal",
    vikunjaApiBaseUrl: "https://vikunja.example.internal/api/v1",
    vikunjaApiToken: "vikunja-token",
    verifySsl: true,
  };
}

function getRouterStack(app: ReturnType<typeof createApp>): ExpressLayer[] {
  return (app as unknown as { router: { stack: ExpressLayer[] } }).router.stack;
}

function getRouteHandlers(
  app: ReturnType<typeof createApp>,
  path: string,
  method: "get" | "post" | "delete",
) {
  const layer = getRouterStack(app).find(
    (entry) => entry.route?.path === path && entry.route.methods[method],
  );

  if (!layer?.route) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found.`);
  }

  return layer.route.stack.map((entry) => entry.handle);
}

function getErrorHandler(app: ReturnType<typeof createApp>) {
  const layer = getRouterStack(app).findLast((entry) => !entry.route && entry.handle.length === 4);

  if (!layer) {
    throw new Error("Error handler not found.");
  }

  return layer.handle;
}

function createRequest(headers: Record<string, string> = {}) {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  };
}

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApp", () => {
  it("wires the expected routes and disables x-powered-by", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const stack = getRouterStack(app);

    expect(app.disabled("x-powered-by")).toBe(true);
    expect(stack.map((entry) => entry.route?.path ?? entry.handle.name)).toEqual([
      "jsonParser",
      "/healthz",
      "/mcp",
      "/mcp",
      "/mcp",
      "",
    ]);
    expect(getRouteHandlers(app, "/mcp", "post")).toHaveLength(2);
  });

  it("returns health status 200 when Vikunja is reachable", async () => {
    const client = createMockVikunjaClient({
      probe: vi.fn().mockResolvedValue({
        ok: true,
        statusCode: 200,
        message: "Vikunja reachable.",
      }),
    });
    const app = createApp(createConfig(), { vikunjaClient: client });
    const [healthHandler] = getRouteHandlers(app, "/healthz", "get");
    const response = createResponse();

    await healthHandler(createRequest(), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      service: "vikunja-mcp-http",
      config_loaded: true,
      vikunja_reachable: true,
      message: "Vikunja reachable.",
      vikunja_status_code: 200,
    });
  });

  it("returns health status 503 when Vikunja is unreachable", async () => {
    const client = createMockVikunjaClient({
      probe: vi.fn().mockResolvedValue({
        ok: false,
        statusCode: 401,
        message: "Invalid Vikunja token.",
      }),
    });
    const app = createApp(createConfig(), { vikunjaClient: client });
    const [healthHandler] = getRouteHandlers(app, "/healthz", "get");
    const response = createResponse();

    await healthHandler(createRequest(), response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      service: "vikunja-mcp-http",
      config_loaded: true,
      vikunja_reachable: false,
      message: "Invalid Vikunja token.",
      vikunja_status_code: 401,
    });
  });

  it("rejects unauthenticated MCP requests in the auth middleware", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const [authHandler] = getRouteHandlers(app, "/mcp", "post");
    const response = createResponse();
    const next = vi.fn();

    authHandler(createRequest(), response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "unauthorized",
      message: "A valid bearer token is required for this endpoint.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes authorized MCP requests to the next handler", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const [authHandler] = getRouteHandlers(app, "/mcp", "post");
    const response = createResponse();
    const next = vi.fn();

    authHandler(createRequest({ authorization: "Bearer bridge-token" }), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns 405 on GET and DELETE /mcp", async () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const [getHandler] = getRouteHandlers(app, "/mcp", "get");
    const [deleteHandler] = getRouteHandlers(app, "/mcp", "delete");

    for (const handler of [getHandler, deleteHandler]) {
      const response = createResponse();

      await handler(createRequest(), response);

      expect(response.status).toHaveBeenCalledWith(405);
      expect(response.set).toHaveBeenCalledWith("Allow", "POST");
      expect(response.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      });
    }
  });

  it("returns JSON 400 for invalid JSON parser errors", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const errorHandler = getErrorHandler(app);
    const response = createResponse();

    errorHandler({ type: "entity.parse.failed" }, createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "invalid_json",
      message: "Request body must be valid JSON.",
    });
  });

  it("returns JSON 413 for oversized request bodies", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const errorHandler = getErrorHandler(app);
    const response = createResponse();

    errorHandler({ status: 413 }, createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith({
      error: "payload_too_large",
      message: "Request body is too large.",
    });
  });

  it("returns JSON 500 for generic Error instances", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const errorHandler = getErrorHandler(app);
    const response = createResponse();

    errorHandler(new Error("boom"), createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "internal_server_error",
      message: "boom",
    });
  });

  it("returns a fallback message for non-Error failures", () => {
    const app = createApp(createConfig(), {
      vikunjaClient: createMockVikunjaClient(),
    });
    const errorHandler = getErrorHandler(app);
    const response = createResponse();

    errorHandler("badness", createRequest(), response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "internal_server_error",
      message: "Unexpected server error.",
    });
  });
});

describe("startServer", () => {
  it("listens on the configured port and logs startup", () => {
    const fakeServer = { close: vi.fn() };
    const listenSpy = vi
      .spyOn(express.application, "listen")
      .mockImplementation(function (_port: number, callback?: () => void) {
        callback?.();
        return fakeServer as never;
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const server = startServer(createConfig());

    expect(listenSpy).toHaveBeenCalledWith(4010, expect.any(Function));
    expect(logSpy).toHaveBeenCalledWith("vikunja-mcp-http listening on port 4010");
    expect(server).toBe(fakeServer);
  });
});
