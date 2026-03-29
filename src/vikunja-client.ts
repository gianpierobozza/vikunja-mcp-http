import { Agent as HttpAgent, request as httpRequest } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";

import type { AppConfig } from "./config.js";
import { logWarn } from "./logger.js";
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
  hex_color?: string;
  is_archived?: boolean;
  is_favorite?: boolean;
  identifier?: string;
  parent_project_id?: number;
  position?: number;
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
  buckets?: VikunjaBucket[];
  position?: number;
  related_tasks?: unknown;
  reactions?: VikunjaReactionMap;
  due_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
};

export type VikunjaLabel = {
  id: number;
  title: string;
  description?: string;
  hex_color?: string;
  [key: string]: unknown;
};

export type VikunjaProjectView = {
  id: number;
  title: string;
  project_id?: number;
  view_kind?: string;
  position?: number;
  default_bucket_id?: number;
  done_bucket_id?: number;
  bucket_configuration_mode?: string;
  bucket_configuration?: unknown[];
  filter?: unknown;
  [key: string]: unknown;
};

export type VikunjaBucket = {
  id: number;
  title: string;
  count?: number;
  limit?: number;
  project_view_id?: number;
  position?: number;
  tasks?: VikunjaTask[];
  [key: string]: unknown;
};

export type VikunjaUser = {
  id: number;
  username?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
};

export type ReactionEntityKind = "tasks" | "comments";

export type VikunjaReaction = {
  value: string;
  user?: VikunjaUser;
  created?: string;
  [key: string]: unknown;
};

export type VikunjaReactionMap = Record<string, VikunjaUser[]>;

export type VikunjaTaskComment = {
  id: number;
  comment: string;
  author?: VikunjaUser;
  reactions?: VikunjaReactionMap;
  [key: string]: unknown;
};

export type VikunjaTaskRelation = {
  task_id: number;
  other_task_id: number;
  relation_kind: string;
  [key: string]: unknown;
};

export type VikunjaTaskBucket = {
  task_id?: number;
  bucket_id?: number;
  project_view_id?: number;
  task?: VikunjaTask;
  bucket?: VikunjaBucket;
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

export type TaskAssigneeListParams = TaskLabelListParams;

export type TaskCommentListParams = {
  orderBy?: string;
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

export type CreateProjectInput = {
  title: string;
  description?: string;
  hex_color?: string;
  identifier?: string;
  is_archived?: boolean;
  is_favorite?: boolean;
  parent_project_id?: number | null;
  position?: number;
};

export type UpdateProjectInput = JsonRecord;

export type CreateViewInput = {
  title: string;
  view_kind?: string;
  position?: number;
  default_bucket_id?: number;
  done_bucket_id?: number;
  bucket_configuration_mode?: string;
  bucket_configuration?: unknown[];
  filter?: unknown;
};

export type UpdateViewInput = JsonRecord;

export type CreateBucketInput = {
  title: string;
  position?: number;
  limit?: number | null;
};

export type UpdateBucketInput = JsonRecord;

export type TaskPositionInput = {
  task_id?: number;
  project_view_id: number;
  position: number;
};

export type CreateLabelInput = {
  title: string;
  description?: string;
  hex_color?: string;
};

export type UpdateLabelInput = JsonRecord;

export type TaskCommentInput = {
  comment: string;
};

export type CreateTaskRelationInput = {
  task_id?: number;
  other_task_id: number;
  relation_kind: string;
};

export type VikunjaProbeResult = {
  ok: boolean;
  statusCode?: number;
  message: string;
};

export interface VikunjaClientApi {
  probe(): Promise<VikunjaProbeResult>;
  listProjects(params?: ProjectListParams): Promise<VikunjaPaginatedResult<VikunjaProject>>;
  getProject(projectId: number): Promise<VikunjaProject>;
  createProject(project: CreateProjectInput): Promise<VikunjaProject>;
  updateProject(projectId: number, project: UpdateProjectInput): Promise<VikunjaProject>;
  deleteProject(projectId: number): Promise<JsonRecord>;
  listTasks(
    projectId: number,
    viewId: number,
    params?: TaskListParams,
  ): Promise<VikunjaPaginatedResult<VikunjaTask | VikunjaBucket>>;
  getTask(taskId: number, options?: { expand?: TaskExpandValue[] }): Promise<VikunjaTask>;
  createTask(projectId: number, task: CreateTaskInput): Promise<VikunjaTask>;
  updateTask(taskId: number, task: UpdateTaskInput): Promise<VikunjaTask>;
  deleteTask(taskId: number): Promise<JsonRecord>;
  moveTaskToBucket(
    projectId: number,
    viewId: number,
    bucketId: number,
    taskId: number,
  ): Promise<VikunjaTaskBucket>;
  updateTaskPosition(taskId: number, position: TaskPositionInput): Promise<JsonRecord>;
  listLabels(params?: ProjectListParams): Promise<VikunjaPaginatedResult<VikunjaLabel>>;
  getLabel(labelId: number): Promise<VikunjaLabel>;
  createLabel(label: CreateLabelInput): Promise<VikunjaLabel>;
  updateLabel(labelId: number, label: UpdateLabelInput): Promise<VikunjaLabel>;
  deleteLabel(labelId: number): Promise<JsonRecord>;
  listTaskLabels(
    taskId: number,
    params?: TaskLabelListParams,
  ): Promise<VikunjaPaginatedResult<VikunjaLabel>>;
  addLabelToTask(taskId: number, labelId: number): Promise<JsonRecord>;
  removeLabelFromTask(taskId: number, labelId: number): Promise<JsonRecord>;
  listViews(projectId: number): Promise<VikunjaProjectView[]>;
  getView(projectId: number, viewId: number): Promise<VikunjaProjectView>;
  createView(projectId: number, view: CreateViewInput): Promise<VikunjaProjectView>;
  updateView(projectId: number, viewId: number, view: UpdateViewInput): Promise<VikunjaProjectView>;
  deleteView(projectId: number, viewId: number): Promise<JsonRecord>;
  listBuckets(projectId: number, viewId: number): Promise<VikunjaBucket[]>;
  createBucket(projectId: number, viewId: number, bucket: CreateBucketInput): Promise<VikunjaBucket>;
  updateBucket(
    projectId: number,
    viewId: number,
    bucketId: number,
    bucket: UpdateBucketInput,
  ): Promise<VikunjaBucket>;
  deleteBucket(projectId: number, viewId: number, bucketId: number): Promise<JsonRecord>;
  searchUsers(params?: { search?: string }): Promise<VikunjaUser[]>;
  listTaskAssignees(
    taskId: number,
    params?: TaskAssigneeListParams,
  ): Promise<VikunjaPaginatedResult<VikunjaUser>>;
  addAssigneeToTask(taskId: number, userId: number): Promise<JsonRecord>;
  removeAssigneeFromTask(taskId: number, userId: number): Promise<JsonRecord>;
  listTaskComments(taskId: number, params?: TaskCommentListParams): Promise<VikunjaTaskComment[]>;
  getTaskComment(taskId: number, commentId: number): Promise<VikunjaTaskComment>;
  createTaskComment(taskId: number, comment: TaskCommentInput): Promise<VikunjaTaskComment>;
  updateTaskComment(
    taskId: number,
    commentId: number,
    comment: TaskCommentInput,
  ): Promise<VikunjaTaskComment>;
  deleteTaskComment(taskId: number, commentId: number): Promise<JsonRecord>;
  listReactions(entityKind: ReactionEntityKind, entityId: number): Promise<VikunjaReactionMap[]>;
  addReaction(
    entityKind: ReactionEntityKind,
    entityId: number,
    reaction: string,
  ): Promise<VikunjaReaction>;
  removeReaction(
    entityKind: ReactionEntityKind,
    entityId: number,
    reaction: string,
  ): Promise<JsonRecord>;
  listTaskRelations(taskId: number): Promise<VikunjaTaskRelation[]>;
  createTaskRelation(taskId: number, relation: CreateTaskRelationInput): Promise<JsonRecord>;
  deleteTaskRelation(taskId: number, relation: CreateTaskRelationInput): Promise<JsonRecord>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeReactionMaps(value: unknown): VikunjaReactionMap[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value as VikunjaReactionMap[];
  }

  if (isRecord(value)) {
    return Object.keys(value).length === 0 ? [] : [value as VikunjaReactionMap];
  }

  throw new Error("Expected a reaction list from Vikunja.");
}

function normalizeTaskRelations(taskId: number, relatedTasks: unknown): VikunjaTaskRelation[] {
  const relations = new Map<string, VikunjaTaskRelation>();

  const addRelation = (relation: VikunjaTaskRelation) => {
    const key = `${relation.task_id}:${relation.relation_kind}:${relation.other_task_id}`;

    if (!relations.has(key)) {
      relations.set(key, relation);
    }
  };

  const normalizeEntry = (entry: unknown, relationKind: string) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const relationRecord = entry as Record<string, unknown>;
    const normalizedRelationKind =
      typeof relationRecord.relation_kind === "string"
        ? relationRecord.relation_kind
        : relationKind;
    const normalizedTaskId =
      typeof relationRecord.task_id === "number" ? relationRecord.task_id : taskId;

    if (
      typeof relationRecord.other_task_id === "number" &&
      typeof normalizedRelationKind === "string"
    ) {
      addRelation({
        ...relationRecord,
        task_id: normalizedTaskId,
        relation_kind: normalizedRelationKind,
        other_task_id: relationRecord.other_task_id,
      } as VikunjaTaskRelation);
      return;
    }

    if (typeof relationRecord.id === "number" && typeof normalizedRelationKind === "string") {
      addRelation({
        ...relationRecord,
        task_id: normalizedTaskId,
        relation_kind: normalizedRelationKind,
        other_task_id: relationRecord.id,
      } as VikunjaTaskRelation);
    }
  };

  if (Array.isArray(relatedTasks)) {
    for (const entry of relatedTasks) {
      normalizeEntry(entry, "");
    }

    return Array.from(relations.values());
  }

  if (!relatedTasks || typeof relatedTasks !== "object") {
    return [];
  }

  for (const [relationKind, entries] of Object.entries(relatedTasks as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      normalizeEntry(entry, relationKind);
    }
  }

  return Array.from(relations.values());
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

  async getProject(projectId: number): Promise<VikunjaProject> {
    const response = await this.request<VikunjaProject>("GET", `/projects/${projectId}`);
    return this.assertObject<VikunjaProject>(response.data, "Expected a project object from Vikunja.");
  }

  async createProject(project: CreateProjectInput): Promise<VikunjaProject> {
    const response = await this.request<VikunjaProject>("PUT", "/projects", {
      body: project,
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaProject>(response.data, "Expected a created project object from Vikunja.");
  }

  async updateProject(projectId: number, project: UpdateProjectInput): Promise<VikunjaProject> {
    const response = await this.request<VikunjaProject>("POST", `/projects/${projectId}`, {
      body: project,
    });
    return this.assertObject<VikunjaProject>(response.data, "Expected an updated project object from Vikunja.");
  }

  async deleteProject(projectId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/projects/${projectId}`);
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
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

  async deleteTask(taskId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/tasks/${taskId}`);
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
  }

  async moveTaskToBucket(
    projectId: number,
    viewId: number,
    bucketId: number,
    taskId: number,
  ): Promise<VikunjaTaskBucket> {
    const response = await this.request<VikunjaTaskBucket>(
      "POST",
      `/projects/${projectId}/views/${viewId}/buckets/${bucketId}/tasks`,
      {
        body: {
          task_id: taskId,
        },
      },
    );
    return this.assertObject<VikunjaTaskBucket>(
      response.data,
      "Expected a task-bucket relation object from Vikunja.",
    );
  }

  async updateTaskPosition(taskId: number, position: TaskPositionInput): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("POST", `/tasks/${taskId}/position`, {
      body: {
        task_id: taskId,
        ...position,
      },
    });
    return this.assertObject<JsonRecord>(response.data, "Expected a task position response from Vikunja.");
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

  async getLabel(labelId: number): Promise<VikunjaLabel> {
    const response = await this.request<VikunjaLabel>("GET", `/labels/${labelId}`);
    return this.assertObject<VikunjaLabel>(response.data, "Expected a label object from Vikunja.");
  }

  async createLabel(label: CreateLabelInput): Promise<VikunjaLabel> {
    const response = await this.request<VikunjaLabel>("PUT", "/labels", {
      body: label,
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaLabel>(response.data, "Expected a created label object from Vikunja.");
  }

  async updateLabel(labelId: number, label: UpdateLabelInput): Promise<VikunjaLabel> {
    const response = await this.request<VikunjaLabel>("PUT", `/labels/${labelId}`, {
      body: label,
    });
    return this.assertObject<VikunjaLabel>(response.data, "Expected an updated label object from Vikunja.");
  }

  async deleteLabel(labelId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/labels/${labelId}`);
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
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

  async removeLabelFromTask(taskId: number, labelId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/tasks/${taskId}/labels/${labelId}`);
    return this.assertObject<JsonRecord>(
      response.data,
      "Expected a task-label delete response from Vikunja.",
    );
  }

  async listViews(projectId: number): Promise<VikunjaProjectView[]> {
    const response = await this.request<VikunjaProjectView[]>("GET", `/projects/${projectId}/views`);
    return assertArray<VikunjaProjectView>(response.data, "Expected a project view list from Vikunja.");
  }

  async getView(projectId: number, viewId: number): Promise<VikunjaProjectView> {
    const response = await this.request<VikunjaProjectView>("GET", `/projects/${projectId}/views/${viewId}`);
    return this.assertObject<VikunjaProjectView>(
      response.data,
      "Expected a project view object from Vikunja.",
    );
  }

  async createView(projectId: number, view: CreateViewInput): Promise<VikunjaProjectView> {
    const response = await this.request<VikunjaProjectView>("PUT", `/projects/${projectId}/views`, {
      body: view,
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaProjectView>(
      response.data,
      "Expected a created project view object from Vikunja.",
    );
  }

  async updateView(projectId: number, viewId: number, view: UpdateViewInput): Promise<VikunjaProjectView> {
    const response = await this.request<VikunjaProjectView>(
      "POST",
      `/projects/${projectId}/views/${viewId}`,
      {
        body: view,
      },
    );
    return this.assertObject<VikunjaProjectView>(
      response.data,
      "Expected an updated project view object from Vikunja.",
    );
  }

  async deleteView(projectId: number, viewId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/projects/${projectId}/views/${viewId}`);
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
  }

  async listBuckets(projectId: number, viewId: number): Promise<VikunjaBucket[]> {
    const response = await this.request<VikunjaBucket[]>(
      "GET",
      `/projects/${projectId}/views/${viewId}/buckets`,
    );
    return assertArray<VikunjaBucket>(response.data, "Expected a bucket list from Vikunja.");
  }

  async createBucket(projectId: number, viewId: number, bucket: CreateBucketInput): Promise<VikunjaBucket> {
    const response = await this.request<VikunjaBucket>(
      "PUT",
      `/projects/${projectId}/views/${viewId}/buckets`,
      {
        body: bucket,
        expectedStatusCodes: [200, 201],
      },
    );
    return this.assertObject<VikunjaBucket>(response.data, "Expected a created bucket object from Vikunja.");
  }

  async updateBucket(
    projectId: number,
    viewId: number,
    bucketId: number,
    bucket: UpdateBucketInput,
  ): Promise<VikunjaBucket> {
    const response = await this.request<VikunjaBucket>(
      "POST",
      `/projects/${projectId}/views/${viewId}/buckets/${bucketId}`,
      {
        body: bucket,
      },
    );
    return this.assertObject<VikunjaBucket>(response.data, "Expected an updated bucket object from Vikunja.");
  }

  async deleteBucket(projectId: number, viewId: number, bucketId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>(
      "DELETE",
      `/projects/${projectId}/views/${viewId}/buckets/${bucketId}`,
    );
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
  }

  async searchUsers(params: { search?: string } = {}): Promise<VikunjaUser[]> {
    const response = await this.request<VikunjaUser[]>("GET", "/users", {
      query: {
        s: params.search,
      },
    });
    return assertArray<VikunjaUser>(response.data, "Expected a user list from Vikunja.");
  }

  async listTaskAssignees(
    taskId: number,
    params: TaskAssigneeListParams = {},
  ): Promise<VikunjaPaginatedResult<VikunjaUser>> {
    const response = await this.request<VikunjaUser[]>(`GET`, `/tasks/${taskId}/assignees`, {
      query: {
        page: params.page,
        per_page: params.perPage,
        s: params.search,
      },
    });
    const items = assertArray<VikunjaUser>(response.data, "Expected a task assignee list from Vikunja.");

    return {
      items,
      pagination: buildPagination(response.headers, params.page, params.perPage),
    };
  }

  async addAssigneeToTask(taskId: number, userId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("PUT", `/tasks/${taskId}/assignees`, {
      body: {
        assignees: [{ id: userId }],
      },
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<JsonRecord>(
      response.data,
      "Expected a task-assignee relation object from Vikunja.",
    );
  }

  async removeAssigneeFromTask(taskId: number, userId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("DELETE", `/tasks/${taskId}/assignees/${userId}`);
    return this.assertObject<JsonRecord>(
      response.data,
      "Expected a task-assignee delete response from Vikunja.",
    );
  }

  async listTaskComments(taskId: number, params: TaskCommentListParams = {}): Promise<VikunjaTaskComment[]> {
    const response = await this.request<VikunjaTaskComment[]>(`GET`, `/tasks/${taskId}/comments`, {
      query: {
        order_by: params.orderBy,
      },
    });
    return assertArray<VikunjaTaskComment>(response.data, "Expected a task comment list from Vikunja.");
  }

  async getTaskComment(taskId: number, commentId: number): Promise<VikunjaTaskComment> {
    const response = await this.request<VikunjaTaskComment>(
      "GET",
      `/tasks/${taskId}/comments/${commentId}`,
    );
    return this.assertObject<VikunjaTaskComment>(
      response.data,
      "Expected a task comment object from Vikunja.",
    );
  }

  async createTaskComment(taskId: number, comment: TaskCommentInput): Promise<VikunjaTaskComment> {
    const response = await this.request<VikunjaTaskComment>("PUT", `/tasks/${taskId}/comments`, {
      body: comment,
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaTaskComment>(
      response.data,
      "Expected a created task comment object from Vikunja.",
    );
  }

  async updateTaskComment(
    taskId: number,
    commentId: number,
    comment: TaskCommentInput,
  ): Promise<VikunjaTaskComment> {
    const response = await this.request<VikunjaTaskComment>(
      "POST",
      `/tasks/${taskId}/comments/${commentId}`,
      {
        body: comment,
      },
    );
    return this.assertObject<VikunjaTaskComment>(
      response.data,
      "Expected an updated task comment object from Vikunja.",
    );
  }

  async deleteTaskComment(taskId: number, commentId: number): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>(
      "DELETE",
      `/tasks/${taskId}/comments/${commentId}`,
    );
    return this.assertObject<JsonRecord>(response.data, "Expected a delete response from Vikunja.");
  }

  async listReactions(entityKind: ReactionEntityKind, entityId: number): Promise<VikunjaReactionMap[]> {
    const response = await this.request<VikunjaReactionMap[]>(
      "GET",
      `/${entityKind}/${entityId}/reactions`,
    );
    return normalizeReactionMaps(response.data);
  }

  async addReaction(
    entityKind: ReactionEntityKind,
    entityId: number,
    reaction: string,
  ): Promise<VikunjaReaction> {
    const response = await this.request<VikunjaReaction>("PUT", `/${entityKind}/${entityId}/reactions`, {
      body: {
        value: reaction,
      },
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<VikunjaReaction>(response.data, "Expected a reaction object from Vikunja.");
  }

  async removeReaction(
    entityKind: ReactionEntityKind,
    entityId: number,
    reaction: string,
  ): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>(
      "POST",
      `/${entityKind}/${entityId}/reactions/delete`,
      {
        body: {
          value: reaction,
        },
      },
    );
    return this.assertObject<JsonRecord>(response.data, "Expected a reaction delete response from Vikunja.");
  }

  async listTaskRelations(taskId: number): Promise<VikunjaTaskRelation[]> {
    const task = await this.getTask(taskId);
    return normalizeTaskRelations(taskId, task.related_tasks);
  }

  async createTaskRelation(taskId: number, relation: CreateTaskRelationInput): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>("PUT", `/tasks/${taskId}/relations`, {
      body: {
        task_id: taskId,
        ...relation,
      },
      expectedStatusCodes: [200, 201],
    });
    return this.assertObject<JsonRecord>(response.data, "Expected a task relation response from Vikunja.");
  }

  async deleteTaskRelation(taskId: number, relation: CreateTaskRelationInput): Promise<JsonRecord> {
    const response = await this.request<JsonRecord>(
      "DELETE",
      `/tasks/${taskId}/relations/${encodeURIComponent(relation.relation_kind)}/${relation.other_task_id}`,
      {
        body: {
          task_id: taskId,
          ...relation,
        },
      },
    );
    return this.assertObject<JsonRecord>(response.data, "Expected a task relation delete response from Vikunja.");
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
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
    const requestPath = url.pathname;

    return await new Promise<VikunjaResponse<T>>((resolve, reject) => {
      let timedOut = false;

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

            const message = extractErrorMessage(
              parsedBody,
              `Vikunja ${method} ${url.pathname} failed with HTTP ${statusCode}.`,
            );

            logWarn("vikunja", "request_failed", {
              method,
              path: requestPath,
              status: statusCode,
              message,
            });

            reject(
              new VikunjaClientError(
                message,
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
        timedOut = true;
        logWarn("vikunja", "request_failed", {
          method,
          path: requestPath,
          message: "Request timed out.",
          timeout_ms: 10000,
        });
        request.destroy(new Error("Request timed out"));
      });

      request.on("error", (error) => {
        if (!timedOut) {
          logWarn("vikunja", "request_failed", {
            method,
            path: requestPath,
            message: "Unable to connect to Vikunja.",
          });
        }

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
