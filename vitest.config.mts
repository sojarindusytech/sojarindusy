import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

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
  },
});
