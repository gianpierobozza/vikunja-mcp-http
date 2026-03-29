import { pathToFileURL } from "node:url";

import express, { type NextFunction, type Request, type Response } from "express";

import { requireBearerAuth } from "./auth.js";
import { loadConfig, SERVICE_NAME, type AppConfig } from "./config.js";
import { createHealthHandler } from "./health.js";
import { createMcpHandler } from "./mcp.js";
import { createVikunjaClient, type VikunjaClientApi } from "./vikunja-client.js";

type HttpError = Error & {
  status?: number;
  type?: string;
  body?: unknown;
};

function methodNotAllowed(_request: Request, response: Response) {
  response.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

export function createApp(
  config: AppConfig,
  options: {
    vikunjaClient?: VikunjaClientApi;
  } = {},
) {
  const app = express();
  const vikunjaClient = options.vikunjaClient ?? createVikunjaClient(config);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", createHealthHandler(vikunjaClient));
  app.post("/mcp", requireBearerAuth(config.mcpBearerToken), createMcpHandler(vikunjaClient));
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const httpError = error as HttpError;
    const isJsonParseError =
      httpError.type === "entity.parse.failed" ||
      (httpError instanceof SyntaxError &&
        httpError.status === 400 &&
        "body" in httpError);

    if (isJsonParseError) {
      response.status(400).json({
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      });
      return;
    }

    if (httpError.type === "entity.too.large" || httpError.status === 413) {
      response.status(413).json({
        error: "payload_too_large",
        message: "Request body is too large.",
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";

    response.status(500).json({
      error: "internal_server_error",
      message,
    });
  });

  return app;
}

export function startServer(config: AppConfig) {
  const app = createApp(config);

  return app.listen(config.port, () => {
    console.log(`${SERVICE_NAME} listening on port ${config.port}`);
  });
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer(loadConfig());
}
