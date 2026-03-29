import { vi, type Mock } from "vitest";

import type { VikunjaClientApi } from "../../src/vikunja-client.js";

const emptyPagination = {
  page: 1,
  per_page: 0,
  total_pages: 0,
  result_count: 0,
};

export type MockVikunjaClient = VikunjaClientApi & {
  [Key in keyof VikunjaClientApi]: Mock;
};

export function createMockVikunjaClient(
  overrides: Partial<MockVikunjaClient> = {},
): MockVikunjaClient {
  const client = {
    probe: vi.fn().mockResolvedValue({
      ok: true,
      message: "Vikunja reachable.",
    }),
    listProjects: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    getProject: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example project",
    }),
    createProject: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example project",
    }),
    updateProject: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example project",
    }),
    deleteProject: vi.fn().mockResolvedValue({}),
    listTasks: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    getTask: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example task",
    }),
    createTask: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example task",
    }),
    updateTask: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example task",
    }),
    deleteTask: vi.fn().mockResolvedValue({}),
    moveTaskToBucket: vi.fn().mockResolvedValue({
      task_id: 1,
      bucket_id: 1,
    }),
    updateTaskPosition: vi.fn().mockResolvedValue({}),
    listLabels: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    getLabel: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example label",
    }),
    createLabel: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example label",
    }),
    updateLabel: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example label",
    }),
    deleteLabel: vi.fn().mockResolvedValue({}),
    listTaskLabels: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    addLabelToTask: vi.fn().mockResolvedValue({}),
    removeLabelFromTask: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([]),
    getView: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example view",
      view_kind: "kanban",
    }),
    createView: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example view",
      view_kind: "kanban",
    }),
    updateView: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example view",
      view_kind: "kanban",
    }),
    deleteView: vi.fn().mockResolvedValue({}),
    listBuckets: vi.fn().mockResolvedValue([]),
    createBucket: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example bucket",
    }),
    updateBucket: vi.fn().mockResolvedValue({
      id: 1,
      title: "Example bucket",
    }),
    deleteBucket: vi.fn().mockResolvedValue({}),
    searchUsers: vi.fn().mockResolvedValue([]),
    listTaskAssignees: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    addAssigneeToTask: vi.fn().mockResolvedValue({}),
    removeAssigneeFromTask: vi.fn().mockResolvedValue({}),
    listTaskComments: vi.fn().mockResolvedValue([]),
    getTaskComment: vi.fn().mockResolvedValue({
      id: 1,
      comment: "Example comment",
    }),
    createTaskComment: vi.fn().mockResolvedValue({
      id: 1,
      comment: "Example comment",
    }),
    updateTaskComment: vi.fn().mockResolvedValue({
      id: 1,
      comment: "Example comment",
    }),
    deleteTaskComment: vi.fn().mockResolvedValue({}),
    listTaskRelations: vi.fn().mockResolvedValue([]),
    createTaskRelation: vi.fn().mockResolvedValue({}),
    deleteTaskRelation: vi.fn().mockResolvedValue({}),
  } as MockVikunjaClient;

  return Object.assign(client, overrides);
}
