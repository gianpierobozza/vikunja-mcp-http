import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../src/config.js";
import { createVikunjaClient } from "../src/vikunja-client.js";

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

describe("VikunjaClient Milestone 8 mappings", () => {
  it("maps project CRUD methods to the official endpoints", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValueOnce({
        data: { id: 7, title: "Codex test - Project" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { id: 7, title: "Codex test - Project" },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { id: 7, title: "Codex test - Project" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { message: "deleted" },
        headers: {},
        statusCode: 200,
      });

    await client.getProject(7);
    await client.createProject({ title: "Codex test - Project" });
    await client.updateProject(7, { description: "updated" });
    await client.deleteProject(7);

    expect(requestSpy).toHaveBeenNthCalledWith(1, "GET", "/projects/7");
    expect(requestSpy).toHaveBeenNthCalledWith(2, "PUT", "/projects", {
      body: { title: "Codex test - Project" },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(3, "POST", "/projects/7", {
      body: { description: "updated" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(4, "DELETE", "/projects/7");
  });

  it("maps view and bucket CRUD methods to the official endpoints", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValue({
        data: { id: 9, title: "Example" },
        headers: {},
        statusCode: 200,
      });

    await client.getView(7, 9);
    await client.createView(7, { title: "Board" });
    await client.updateView(7, 9, { title: "Backlog" });
    await client.deleteView(7, 9);
    await client.createBucket(7, 9, { title: "Inbox" });
    await client.updateBucket(7, 9, 11, { title: "Doing" });
    await client.deleteBucket(7, 9, 11);

    expect(requestSpy).toHaveBeenNthCalledWith(1, "GET", "/projects/7/views/9");
    expect(requestSpy).toHaveBeenNthCalledWith(2, "PUT", "/projects/7/views", {
      body: { title: "Board" },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(3, "POST", "/projects/7/views/9", {
      body: { title: "Backlog" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(4, "DELETE", "/projects/7/views/9");
    expect(requestSpy).toHaveBeenNthCalledWith(5, "PUT", "/projects/7/views/9/buckets", {
      body: { title: "Inbox" },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(6, "POST", "/projects/7/views/9/buckets/11", {
      body: { title: "Doing" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(7, "DELETE", "/projects/7/views/9/buckets/11");
  });

  it("maps task move, delete, label removal, and assignee operations", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {
          "x-pagination-total-pages": "1",
          "x-pagination-result-count": "1",
        },
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: [{ id: 2, username: "gm" }],
        headers: {
          "x-pagination-total-pages": "1",
          "x-pagination-result-count": "1",
        },
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 200,
      });

    await client.deleteTask(16);
    await client.moveTaskToBucket(7, 9, 8, 16);
    await client.updateTaskPosition(16, { project_view_id: 9, position: 1 });
    await client.removeLabelFromTask(16, 5);
    await client.listTaskAssignees(16, { page: 2, perPage: 5, search: "gm" });
    await client.addAssigneeToTask(16, 2);
    await client.removeAssigneeFromTask(16, 2);

    expect(requestSpy).toHaveBeenNthCalledWith(1, "DELETE", "/tasks/16");
    expect(requestSpy).toHaveBeenNthCalledWith(2, "POST", "/projects/7/views/9/buckets/8/tasks", {
      body: { task_id: 16 },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(3, "POST", "/tasks/16/position", {
      body: {
        task_id: 16,
        project_view_id: 9,
        position: 1,
      },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(4, "DELETE", "/tasks/16/labels/5");
    expect(requestSpy).toHaveBeenNthCalledWith(5, "GET", "/tasks/16/assignees", {
      query: {
        page: 2,
        per_page: 5,
        s: "gm",
      },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(6, "PUT", "/tasks/16/assignees", {
      body: { assignees: [{ id: 2 }] },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(7, "DELETE", "/tasks/16/assignees/2");
  });

  it("maps label, user, comment, and relation operations", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;
    const requestSpy = vi
      .spyOn(internalClient, "request")
      .mockResolvedValueOnce({
        data: { id: 5, title: "Example" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { id: 5, title: "ready" },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { id: 5, title: "Example" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { message: "deleted" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: [{ id: 2, username: "gm" }],
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: [{ id: 12, comment: "Hi" }],
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { id: 12, comment: "Hi" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { id: 13, comment: "Hi" },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { id: 12, comment: "Bye" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { message: "deleted" },
        headers: {},
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 201,
      })
      .mockResolvedValueOnce({
        data: { ok: true },
        headers: {},
        statusCode: 200,
      });

    await client.getLabel(5);
    await client.createLabel({ title: "ready" });
    await client.updateLabel(5, { description: "updated" });
    await client.deleteLabel(5);
    await client.searchUsers({ search: "gm" });
    await client.listTaskComments(16, { orderBy: "desc" });
    await client.getTaskComment(16, 12);
    await client.createTaskComment(16, { comment: "Hi" });
    await client.updateTaskComment(16, 12, { comment: "Bye" });
    await client.deleteTaskComment(16, 12);
    await client.createTaskRelation(16, { relation_kind: "blocks", other_task_id: 22 });
    await client.deleteTaskRelation(16, { relation_kind: "blocks", other_task_id: 22 });

    expect(requestSpy).toHaveBeenNthCalledWith(1, "GET", "/labels/5");
    expect(requestSpy).toHaveBeenNthCalledWith(2, "PUT", "/labels", {
      body: { title: "ready" },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(3, "PUT", "/labels/5", {
      body: { description: "updated" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(4, "DELETE", "/labels/5");
    expect(requestSpy).toHaveBeenNthCalledWith(5, "GET", "/users", {
      query: { s: "gm" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(6, "GET", "/tasks/16/comments", {
      query: { order_by: "desc" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(7, "GET", "/tasks/16/comments/12");
    expect(requestSpy).toHaveBeenNthCalledWith(8, "PUT", "/tasks/16/comments", {
      body: { comment: "Hi" },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(9, "POST", "/tasks/16/comments/12", {
      body: { comment: "Bye" },
    });
    expect(requestSpy).toHaveBeenNthCalledWith(10, "DELETE", "/tasks/16/comments/12");
    expect(requestSpy).toHaveBeenNthCalledWith(11, "PUT", "/tasks/16/relations", {
      body: {
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
      },
      expectedStatusCodes: [200, 201],
    });
    expect(requestSpy).toHaveBeenNthCalledWith(
      12,
      "DELETE",
      "/tasks/16/relations/blocks/22",
      {
        body: {
          task_id: 16,
          relation_kind: "blocks",
          other_task_id: 22,
        },
      },
    );
  });

  it("normalizes task relations from task.related_tasks", async () => {
    const client = createVikunjaClient(createConfig());
    const internalClient = client as unknown as InternalVikunjaClient;

    vi.spyOn(internalClient, "request").mockResolvedValue({
      data: {
        id: 16,
        title: "BOARD RULES",
        related_tasks: {
          blocks: [{ id: 22, title: "Blocked task" }],
          duplicates: [{ task_id: 16, relation_kind: "duplicates", other_task_id: 30 }],
        },
      },
      headers: {},
      statusCode: 200,
    });

    await expect(client.listTaskRelations(16)).resolves.toEqual([
      {
        id: 22,
        title: "Blocked task",
        task_id: 16,
        relation_kind: "blocks",
        other_task_id: 22,
      },
      {
        task_id: 16,
        relation_kind: "duplicates",
        other_task_id: 30,
      },
    ]);
  });
});
