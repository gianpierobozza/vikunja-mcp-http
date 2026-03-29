import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import type { IncomingHttpHeaders } from "node:http";

import type { AppConfig } from "./config.js";
import { SERVICE_NAME, SERVICE_VERSION } from "./config.js";

type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | QueryPrimitive[] | undefined;
type QueryParams = Record<string, QueryValue>;
type JsonRecord = Record<string, unknown>;

type VikunjaResponse<T> = {
  data: T;
  headers: IncomingHttpHeaders;
  statusCode: number;
};

export type VikunjaPagination = {
  page: number;
  per_page: number | null;
  total_pages: number | null;
  result_count: number | null;
};

export type VikunjaPaginatedResult<T> = {
  items: T[];
  pagination: VikunjaPagination;
};

export type VikunjaProject = {
  id: number;
  title: string;
  description?: string;
  [key: string]: unknown;
};

export type VikunjaTask = {
  id: number;
  title: string;
  description?: string;
  done?: boolean;
  priority?: number;
  percent_done?: number;
  project_id?: number;
  bucket_id?: number;
  due_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
};

export type VikunjaLabel = {
  id: number;
  title: string;
  description?: string;
  [key: string]: unknown;
};

export type VikunjaProjectView = {
  id: number;
  title: string;
  project_id?: number;
  view_kind?: string | number;
  [key: string]: unknown;
};

export type VikunjaBucket = {
  id: number;
  title: string;
  project_view_id?: number;
  position?: number;
  tasks?: VikunjaTask[];
  [key: string]: unknown;
};

export type ProjectListParams = {
  page?: number;
  perPage?: number;
  search?: string;
};

export type TaskListParams = ProjectListParams & {
  filter?: string;
  filterIncludeNulls?: boolean;
  filterTimezone?: string;
  sortBy?: string;
  orderBy?: string;
};

export type TaskExpandValue = "subtasks" | "buckets" | "reactions" | "comments";

export type TaskLabelListParams = {
  page?: number;
  perPage?: number;
  search?: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  done?: boolean;
  priority?: number;
  percent_done?: number;
  due_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type UpdateTaskInput = JsonRecord;

export type VikunjaProbeResult = {
  ok: boolean;
  statusCode?: number;
  message: string;
};

export interface VikunjaClientApi {
  probe(): Promise<VikunjaProbeResult>;
  listProjects(params?: ProjectListParams): Promise<VikunjaPaginatedResult<VikunjaProject>>;
  listTasks(
    projectId: number,
    viewId: number,
    params?: TaskListParams,
  ): Promise<VikunjaPaginatedResult<VikunjaTask | VikunjaBucket>>;
  getTask(taskId: number, options?: { expand?: TaskExpandValue[] }): Promise<VikunjaTask>;
  createTask(projectId: number, task: CreateTaskInput): Promise<VikunjaTask>;
  updateTask(taskId: number, task: UpdateTaskInput): Promise<VikunjaTask>;
  listLabels(params?: ProjectListParams): Promise<VikunjaPaginatedResult<VikunjaLabel>>;
  listTaskLabels(
    taskId: number,
    params?: TaskLabelListParams,
  ): Promise<VikunjaPaginatedResult<VikunjaLabel>>;
  addLabelToTask(taskId: number, labelId: number): Promise<JsonRecord>;
  listViews(projectId: number): Promise<VikunjaProjectView[]>;
  listBuckets(projectId: number, viewId: number): Promise<VikunjaBucket[]>;
}

function parseJsonBody(body: string): unknown {
  if (body === "") {
    return undefined;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function parseHeaderNumber(headerValue: string | string[] | undefined): number | null {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPagination(
  headers: IncomingHttpHeaders,
  page: number | undefined,
  perPage: number | undefined,
): VikunjaPagination {
  return {
    page: page ?? 1,
    per_page: perPage ?? parseHeaderNumber(headers["x-pagination-per-page"]),
    total_pages: parseHeaderNumber(headers["x-pagination-total-pages"]),
    result_count: parseHeaderNumber(headers["x-pagination-result-count"]),
  };
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }

  if (typeof body === "string" && body.trim() !== "") {
    return body;
  }

  return fallback;
}

function assertArray<T>(value: unknown, message: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }

  return value as T[];
}

export class VikunjaClientError extends Error {
  readonly statusCode?: number;
  readonly responseBody?: unknown;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      responseBody?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "VikunjaClientError";
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
  }
}

export class VikunjaClient implements VikunjaClientApi {
  readonly baseUrl: string;
  readonly apiBaseUrl: string;
  readonly verifySsl: boolean;
  readonly apiToken: string;
  readonly httpAgent: HttpAgent;
  readonly httpsAgent: HttpsAgent;

  constructor(config: AppConfig) {
    this.baseUrl = config.vikunjaBaseUrl;
    this.apiBaseUrl = config.vikunjaApiBaseUrl;
    this.verifySsl = config.verifySsl;
    this.apiToken = config.vikunjaApiToken;
    this.httpAgent = new HttpAgent({ keepAlive: true });
    this.httpsAgent = new HttpsAgent({
      keepAlive: true,
      rejectUnauthorized: this.verifySsl,
    });
  }

  async probe(): Promise<VikunjaProbeResult> {
    try {
      const response = await this.request<VikunjaProject[]>("GET", "/projects", {
        query: { page: 1, per_page: 1 },
      });

      return {
        ok: true,
        statusCode: response.statusCode,
        message: "Vikunja reachable.",
      };
    } catch (error) {
      if (error instanceof VikunjaClientError) {
        return {
          ok: false,
          statusCode: error.statusCode,
          message: error.message,
        };
      }

      return {
        ok: false,
        message: "Unable to connect to Vikunja.",
      };
    }
  }

  async listProjects(params: ProjectListParams = {}): Promise<VikunjaPaginatedResult<VikunjaProject>> {
    const response = await this.request<VikunjaProject[]>("GET", "/projects", {
      query: {
        page: params.page,
        per_page: params.perPage,
        s: params.search,
      },
    });
    const items = assertArray<VikunjaProject>(response.data, "Expected a project list from Vikunja.");

    return {
      items,
      pagination: buildPagination(response.headers, params.page, params.perPage),
    };
  }

  async listTasks(
    projectId: number,
    viewId: number,
    params: TaskListParams = {},
  ): Promise<VikunjaPaginatedResult<VikunjaTask | VikunjaBucket>> {
    const response = await this.request<Array<VikunjaTask | VikunjaBucket>>(
      "GET",
      `/projects/${projectId}/views/${viewId}/tasks`,
      {
        query: {
          page: params.page,
          per_page: params.perPage,
          s: params.search,
          filter: params.filter,
          filter_include_nulls: params.filterIncludeNulls,
          filter_timezone: params.filterTimezone,
          sort_by: params.sortBy,
          order_by: params.orderBy,
        },
      },
    );
    const items = assertArray<VikunjaTask | VikunjaBucket>(
      response.data,
      "Expected a task list from Vikunja.",
    );

    return {
      items,
      pagination: buildPagination(response.headers, params.page, params.perPage),
    };
  }

  async getTask(taskId: number, options: { expand?: TaskExpandValue[] } = {}): Promise<VikunjaTask> {
    const response = await this.request<VikunjaTask>("GET", `/tasks/${taskId}`, {
      query: {
        expand: options.expand,
      },
    });
    return this.assertObject<VikunjaTask>(response.data, "Expected a task object from Vikunja.");
  }

  async createTask(projectId: number, task: CreateTaskInput): Promise<VikunjaTask> {
    const response = await this.request<VikunjaTask>("PUT", `/projects/${projectId}/tasks`, {
      body: task,
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaTask>(response.data, "Expected a created task object from Vikunja.");
  }

  async updateTask(taskId: number, task: UpdateTaskInput): Promise<VikunjaTask> {
    const response = await this.request<VikunjaTask>("POST", `/tasks/${taskId}`, {
      body: task,
    });
    return this.assertObject<VikunjaTask>(response.data, "Expected an updated task object from Vikunja.");
  }

  async listLabels(params: ProjectListParams = {}): Promise<VikunjaPaginatedResult<VikunjaLabel>> {
    const response = await this.request<VikunjaLabel[]>("GET", "/labels", {
      query: {
        page: params.page,
        per_page: params.perPage,
        s: params.search,
      },
    });
    const items = assertArray<VikunjaLabel>(response.data, "Expected a label list from Vikunja.");

    return {
      items,
      pagination: buildPagination(response.headers, params.page, params.perPage),
    };
  }

  async listTaskLabels(
    taskId: number,
    params: TaskLabelListParams = {},
  ): Promise<VikunjaPaginatedResult<VikunjaLabel>> {
    const response = await this.request<VikunjaLabel[]>("GET", `/tasks/${taskId}/labels`, {
      query: {
        page: params.page,
        per_page: params.perPage,
        s: params.search,
      },
    });
    const items = assertArray<VikunjaLabel>(response.data, "Expected a task label list from Vikunja.");

    return {
      items,
      pagination: buildPagination(response.headers, params.page, params.perPage),
    };
  }

  async addLabelToTask(taskId: number, labelId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("PUT", `/tasks/${taskId}/labels`, {
      body: {
        label_id: labelId,
      },
      expectedStatusCodes: [200, 201],
    });

    return this.assertObject<JsonRecord>(
      response.data,
      "Expected a task-label relation object from Vikunja.",
    );
  }

  async listViews(projectId: number): Promise<VikunjaProjectView[]> {
    const response = await this.request<VikunjaProjectView[]>("GET", `/projects/${projectId}/views`);
    return assertArray<VikunjaProjectView>(response.data, "Expected a project view list from Vikunja.");
  }

  async listBuckets(projectId: number, viewId: number): Promise<VikunjaBucket[]> {
    const response = await this.request<VikunjaBucket[]>(
      "GET",
      `/projects/${projectId}/views/${viewId}/buckets`,
    );
    return assertArray<VikunjaBucket>(response.data, "Expected a bucket list from Vikunja.");
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    options: {
      query?: QueryParams;
      body?: unknown;
      expectedStatusCodes?: number[];
    } = {},
  ): Promise<VikunjaResponse<T>> {
    const normalizedPath = path.replace(/^\/+/, "");
    const url = new URL(normalizedPath, `${this.apiBaseUrl}/`);

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;
    const agent = url.protocol === "https:" ? this.httpsAgent : this.httpAgent;

    return await new Promise<VikunjaResponse<T>>((resolve, reject) => {
      const request = requestFn(
        url,
        {
          method,
          agent,
          timeout: 10000,
          headers: {
            accept: "application/json",
            authorization: `Bearer ${this.apiToken}`,
            "user-agent": `${SERVICE_NAME}/${SERVICE_VERSION}`,
            ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk: Buffer | string) => {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          });

          response.on("end", () => {
            const responseBodyText = Buffer.concat(chunks).toString("utf8");
            const parsedBody = parseJsonBody(responseBodyText);
            const statusCode = response.statusCode ?? 500;
            const expectedStatusCodes = options.expectedStatusCodes;
            const isSuccess =
              expectedStatusCodes !== undefined
                ? expectedStatusCodes.includes(statusCode)
                : statusCode >= 200 && statusCode < 300;

            if (isSuccess) {
              resolve({
                data: parsedBody as T,
                headers: response.headers,
                statusCode,
              });
              return;
            }

            reject(
              new VikunjaClientError(
                extractErrorMessage(
                  parsedBody,
                  `Vikunja ${method} ${url.pathname} failed with HTTP ${statusCode}.`,
                ),
                {
                  statusCode,
                  responseBody: parsedBody,
                },
              ),
            );
          });
        },
      );

      request.on("timeout", () => {
        request.destroy(new Error("Request timed out"));
      });

      request.on("error", (error) => {
        reject(
          new VikunjaClientError("Unable to connect to Vikunja.", {
            cause: error,
          }),
        );
      });

      if (options.body !== undefined) {
        request.write(JSON.stringify(options.body));
      }

      request.end();
    });
  }

  private assertObject<T>(value: unknown, message: string): T {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(message);
    }

    return value as T;
  }
}

export function createVikunjaClient(config: AppConfig): VikunjaClient {
  return new VikunjaClient(config);
}
