import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../src/config.js";
import { createVikunjaClient, VikunjaClientError } from "../src/vikunja-client.js";

type InternalVikunjaClient = {
  request: (method: string, path: string, options?: unknown) => Promise<unknown>;
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VikunjaClient", () => {
  it("maps listProjects arguments and builds pagination from headers", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi.spyOn(internalClient, "request").mockResolvedValue({
      data: [{ id: 3, title: "Stonegate Descent" }],
      headers: {
        "x-pagination-per-page": "10",
        "x-pagination-total-pages": "5",
        "x-pagination-result-count": "42",
      },
      statusCode: 200,
    });

    const result = await client.listProjects({
      page: 2,
      perPage: 10,
      search: "Stonegate",
    });

    expect(requestSpy).toHaveBeenCalledWith("GET", "/projects", {
      query: {
        page: 2,
        per_page: 10,
        s: "Stonegate",
      },
    });
    expect(result).toEqual({
      items: [{ id: 3, title: "Stonegate Descent" }],
      pagination: {
        page: 2,
        per_page: 10,
        total_pages: 5,
        result_count: 42,
      },
    });
  });

  it("normalizes VikunjaClientError results in probe()", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;

    vi.spyOn(internalClient, "request").mockRejectedValue(
      new VikunjaClientError("Invalid Vikunja token.", {
        statusCode: 401,
      }),
    );

    await expect(client.probe()).resolves.toEqual({
      ok: false,
      statusCode: 401,
      message: "Invalid Vikunja token.",
    });
  });

  it("falls back to a generic connectivity message in probe()", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;

    vi.spyOn(internalClient, "request").mockRejectedValue(new Error("socket hang up"));

    await expect(client.probe()).resolves.toEqual({
      ok: false,
      message: "Unable to connect to Vikunja.",
    });
  });

  it("maps listTasks arguments and pagination", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi.spyOn(internalClient, "request").mockResolvedValue({
      data: [{ id: 16, title: "BOARD RULES" }],
      headers: {
        "x-pagination-per-page": "25",
        "x-pagination-total-pages": "2",
        "x-pagination-result-count": "12",
      },
      statusCode: 200,
    });

    const result = await client.listTasks(8, 4, {
      page: 2,
      perPage: 25,
      search: "board",
      filter: "done = false",
      filterIncludeNulls: true,
      filterTimezone: "Europe/Rome",
      sortBy: "id",
      orderBy: "asc",
    });

    expect(requestSpy).toHaveBeenCalledWith("GET", "/projects/8/views/4/tasks", {
      query: {
        page: 2,
        per_page: 25,
        s: "board",
        filter: "done = false",
        filter_include_nulls: true,
        filter_timezone: "Europe/Rome",
        sort_by: "id",
        order_by: "asc",
      },
    });
    expect(result.pagination.total_pages).toBe(2);
    expect(result.items).toEqual([{ id: 16, title: "BOARD RULES" }]);
  });

  it("returns null for pagination.per_page when the caller did not request it and Vikunja does not report it", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;

    vi.spyOn(internalClient, "request").mockResolvedValue({
      data: [{ id: 3, title: "Stonegate Descent" }],
      headers: {
        "x-pagination-total-pages": "5",
        "x-pagination-result-count": "42",
      },
      statusCode: 200,
    });

    const result = await client.listProjects();

    expect(result.pagination).toEqual({
      page: 1,
      per_page: null,
      total_pages: 5,
      result_count: 42,
    });
  });

  it("passes expand options to getTask", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi.spyOn(internalClient, "request").mockResolvedValue({
      data: { id: 2, title: "Lore" },
      headers: {},
      statusCode: 200,
    });

    const result = await client.getTask(2, {
      expand: ["comments", "reactions"],
    });

    expect(requestSpy).toHaveBeenCalledWith("GET", "/tasks/2", {
      query: {
        expand: ["comments", "reactions"],
      },
    });
    expect(result).toEqual({ id: 2, title: "Lore" });
  });

  it("passes createTask and updateTask payloads through correctly", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValueOnce({
        data: { id: 4, title: "New task" },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { id: 4, title: "Updated task" },
        headers: {},
        statusCode: 200,
      });

    await expect(
      client.createTask(7, {
        title: "New task",
        done: true,
      }),
    ).resolves.toEqual({ id: 4, title: "New task" });
    await expect(
      client.updateTask(4, {
        title: "Updated task",
      }),
    ).resolves.toEqual({ id: 4, title: "Updated task" });

    expect(requestSpy).toHaveBeenNthCalledWith(1, "PUT", "/projects/7/tasks", {
      body: {
        title: "New task",
        done: true,
      },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(2, "POST", "/tasks/4", {
      body: {
        title: "Updated task",
      },
    });
  });

  it("maps labels, task labels, views, buckets, and label assignment", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValueOnce({
        data: [{ id: 1, title: "ready" }],
        headers: {
          "x-pagination-per-page": "20",
          "x-pagination-total-pages": "1",
          "x-pagination-result-count": "1",
        },
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, title: "ready" }],
        headers: {
          "x-pagination-per-page": "5",
          "x-pagination-total-pages": "1",
          "x-pagination-result-count": "1",
        },
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { label_id: 1, task_id: 16 },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: [{ id: 3, title: "Kanban" }],
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: [{ id: 8, title: "Doing" }],
        headers: {},
        statusCode: 200,
      });

    await expect(client.listLabels({ page: 1, perPage: 20, search: "ready" })).resolves.toMatchObject({
      items: [{ id: 1, title: "ready" }],
    });
    await expect(client.listTaskLabels(16, { page: 1, perPage: 5, search: "ready" })).resolves.toMatchObject({
      items: [{ id: 1, title: "ready" }],
    });
    await expect(client.addLabelToTask(16, 1)).resolves.toEqual({
      label_id: 1,
      task_id: 16,
    });
    await expect(client.listViews(4)).resolves.toEqual([{ id: 3, title: "Kanban" }]);
    await expect(client.listBuckets(4, 3)).resolves.toEqual([{ id: 8, title: "Doing" }]);

    expect(requestSpy).toHaveBeenNthCalledWith(1, "GET", "/labels", {
      query: {
        page: 1,
        per_page: 20,
        s: "ready",
      },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(2, "GET", "/tasks/16/labels", {
      query: {
        page: 1,
        per_page: 5,
        s: "ready",
      },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(3, "PUT", "/tasks/16/labels", {
      body: {
        label_id: 1,
      },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(4, "GET", "/projects/4/views");
    expect(requestSpy).toHaveBeenNthCalledWith(5, "GET", "/projects/4/views/3/buckets");
  });

  it("throws when list-like endpoints receive non-arrays", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi.spyOn(internalClient, "request");

    requestSpy.mockResolvedValueOnce({
      data: { nope: true },
      headers: {},
      statusCode: 200,
    });
    await expect(client.listViews(4)).rejects.toThrow("Expected a project view list from Vikunja.");

    requestSpy.mockResolvedValueOnce({
      data: { nope: true },
      headers: {},
      statusCode: 200,
    });
    await expect(client.listBuckets(4, 3)).rejects.toThrow("Expected a bucket list from Vikunja.");
  });

  it("throws when object endpoints receive non-objects", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi.spyOn(internalClient, "request");

    requestSpy.mockResolvedValueOnce({
      data: ["not", "a", "task"],
      headers: {},
      statusCode: 200,
    });
    await expect(client.getTask(5)).rejects.toThrow("Expected a task object from Vikunja.");

    requestSpy.mockResolvedValueOnce({
      data: "no relation",
      headers: {},
      statusCode: 200,
    });
    await expect(client.addLabelToTask(5, 2)).rejects.toThrow(
      "Expected a task-label relation object from Vikunja.",
    );
  });
});
