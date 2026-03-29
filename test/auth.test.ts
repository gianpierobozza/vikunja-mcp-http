import { describe, expect, it, vi } from "vitest";

import { requireBearerAuth } from "../src/auth.js";

function createRequest(authorization?: string) {
  return {
    header: vi.fn().mockImplementation((name: string) =>
      name === "authorization" ? authorization : undefined,
    ),
  };
}

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe("requireBearerAuth", () => {
  it("calls next for a valid bearer token", () => {
    const middleware = requireBearerAuth("bridge-token");
    const request = createRequest("Bearer bridge-token");
    const response = createResponse();
    const next = vi.fn();

    middleware(request as never, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("accepts a lowercase bearer auth scheme", () => {
    const middleware = requireBearerAuth("bridge-token");
    const request = createRequest("bearer bridge-token");
    const response = createResponse();
    const next = vi.fn();

    middleware(request as never, response as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects requests without an authorization header", () => {
    const middleware = requireBearerAuth("bridge-token");
    const response = createResponse();

    middleware(createRequest() as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: "unauthorized",
      message: "A valid bearer token is required for this endpoint.",
    });
  });

  it("rejects requests with the wrong auth scheme", () => {
    const middleware = requireBearerAuth("bridge-token");
    const response = createResponse();

    middleware(createRequest("Basic bridge-token") as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("rejects requests with a missing bearer token value", () => {
    const middleware = requireBearerAuth("bridge-token");
    const response = createResponse();

    middleware(createRequest("Bearer") as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("rejects requests with the wrong token even when lengths match", () => {
    const middleware = requireBearerAuth("bridge-token");
    const response = createResponse();

    middleware(createRequest("Bearer wrongg-token") as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("rejects requests with the wrong token length", () => {
    const middleware = requireBearerAuth("bridge-token");
    const response = createResponse();

    middleware(createRequest("Bearer nope") as never, response as never, vi.fn());

    expect(response.status).toHaveBeenCalledWith(401);
  });
});
