import { describe, expect, it, vi } from "vitest";

import { createHealthHandler } from "../src/health.js";
import { createMockVikunjaClient } from "./helpers/mock-vikunja-client.js";

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("createHealthHandler", () => {
  it("omits vikunja_status_code when the probe does not provide one", async () => {
    const client = createMockVikunjaClient({
      probe: vi.fn().mockResolvedValue({
        ok: true,
        message: "Vikunja reachable.",
      }),
    });
    const handler = createHealthHandler(client);
    const response = createResponse();

    await handler({} as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      service: "vikunja-mcp-http",
      config_loaded: true,
      vikunja_reachable: true,
      message: "Vikunja reachable.",
    });
  });
});
