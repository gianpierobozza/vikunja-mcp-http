import type { RequestHandler } from "express";

import { SERVICE_NAME } from "./config.js";
import { logInfo, logWarn } from "./logger.js";
import type { VikunjaClientApi } from "./vikunja-client.js";

export function createHealthHandler(client: VikunjaClientApi): RequestHandler {
  return async (request, response) => {
    const startedAt = Date.now();
    const probe = await client.probe();
    const status = probe.ok ? 200 : 503;
    const log = probe.ok ? logInfo : logWarn;

    log("healthz", "request", {
      method: request.method,
      path: request.path ?? request.originalUrl,
      status,
      vikunja_reachable: probe.ok,
      vikunja_status: probe.statusCode,
      duration_ms: Date.now() - startedAt,
    });

    response.status(status).json({
      ok: probe.ok,
      service: SERVICE_NAME,
      config_loaded: true,
      vikunja_reachable: probe.ok,
      message: probe.message,
      ...(probe.statusCode ? { vikunja_status_code: probe.statusCode } : {}),
    });
  };
}
