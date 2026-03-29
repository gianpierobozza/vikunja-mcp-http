import type { RequestHandler } from "express";

import { SERVICE_NAME } from "./config.js";
import type { VikunjaClientApi } from "./vikunja-client.js";

export function createHealthHandler(client: VikunjaClientApi): RequestHandler {
  return async (_request, response) => {
    const probe = await client.probe();

    response.status(probe.ok ? 200 : 503).json({
      ok: probe.ok,
      service: SERVICE_NAME,
      config_loaded: true,
      vikunja_reachable: probe.ok,
      message: probe.message,
      ...(probe.statusCode ? { vikunja_status_code: probe.statusCode } : {}),
    });
  };
}
