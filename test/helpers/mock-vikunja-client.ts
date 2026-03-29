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
    listLabels: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    listTaskLabels: vi.fn().mockResolvedValue({
      items: [],
      pagination: emptyPagination,
    }),
    addLabelToTask: vi.fn().mockResolvedValue({}),
    listViews: vi.fn().mockResolvedValue([]),
    listBuckets: vi.fn().mockResolvedValue([]),
  } as MockVikunjaClient;

  return Object.assign(client, overrides);
}
