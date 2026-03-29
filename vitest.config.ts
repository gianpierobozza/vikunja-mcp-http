import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
