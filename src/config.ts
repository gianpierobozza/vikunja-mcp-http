import { z } from "zod";

export const SERVICE_NAME = "vikunja-mcp-http";
export const SERVICE_VERSION = "0.1.0";

const EnvSchema = z.object({
  PORT: z
    .string()
    .trim()
    .min(1, "PORT is required")
    .regex(/^\d+$/, "PORT must be an integer between 1 and 65535")
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0 && value <= 65535, {
      message: "PORT must be an integer between 1 and 65535",
    }),
  MCP_BEARER_TOKEN: z.string().trim().min(1, "MCP_BEARER_TOKEN is required"),
  VIKUNJA_URL: z
    .string()
    .trim()
    .url("VIKUNJA_URL must be a valid URL")
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "VIKUNJA_URL must use http:// or https://"),
  VIKUNJA_API_TOKEN: z.string().trim().min(1, "VIKUNJA_API_TOKEN is required"),
  VERIFY_SSL: z.string().trim().optional(),
});

export type AppConfig = {
  port: number;
  mcpBearerToken: string;
  vikunjaBaseUrl: string;
  vikunjaApiBaseUrl: string;
  vikunjaApiToken: string;
  verifySsl: boolean;
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  switch (value.toLowerCase()) {
    case "true":
    case "1":
    case "yes":
    case "on":
      return true;
    case "false":
    case "0":
    case "no":
    case "off":
      return false;
    default:
      throw new Error("VERIFY_SSL must be a boolean value");
  }
}

function normalizeVikunjaBaseUrl(value: string): string {
  const url = new URL(value.trim());

  url.hash = "";
  url.search = "";

  let pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/api/v1")) {
    pathname = pathname.slice(0, -"/api/v1".length);
  }

  url.pathname = pathname || "/";

  return url.toString().replace(/\/$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const verifySsl = parseBoolean(parsed.data.VERIFY_SSL, true);
  const vikunjaBaseUrl = normalizeVikunjaBaseUrl(parsed.data.VIKUNJA_URL);

  return {
    port: parsed.data.PORT,
    mcpBearerToken: parsed.data.MCP_BEARER_TOKEN,
    vikunjaBaseUrl,
    vikunjaApiBaseUrl: `${vikunjaBaseUrl}/api/v1`,
    vikunjaApiToken: parsed.data.VIKUNJA_API_TOKEN,
    verifySsl,
  };
}
