import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    pool: "threads",
    maxWorkers: Math.min(4, availableParallelism()),
    fsModuleCache: true,
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});
