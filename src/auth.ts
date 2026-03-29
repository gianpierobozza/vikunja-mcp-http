import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

function safeTokenEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.trim().split(/\s+/, 2);

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function requireBearerAuth(expectedToken: string): RequestHandler {
  return (request, response, next) => {
    const token = extractBearerToken(request.header("authorization"));

    if (!token || !safeTokenEqual(token, expectedToken)) {
      response.status(401).json({
        error: "unauthorized",
        message: "A valid bearer token is required for this endpoint.",
      });
      return;
    }

    next();
  };
}
