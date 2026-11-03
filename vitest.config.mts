import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import os from "node:os";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Each database test file boots its own in-process Postgres (PGlite), a few hundred MB each.
// Run about one test file per GB of RAM (at most one per spare CPU), so `npm test` doesn't
// run out of memory on a small machine.
const maxWorkers = Math.max(1, Math.min(os.availableParallelism() - 1, Math.floor(os.totalmem() / 1024 ** 3)));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `server-only` throws outside a React Server Component build; in tests
      // the modules that import it run in plain Node, which is fine.
      "server-only": fromRoot("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // The database suite boots an in-process Postgres (PGlite) per file.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    maxWorkers,
    minWorkers: 1,
  },
});
