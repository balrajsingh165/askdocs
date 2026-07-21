import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * Vitest configuration. Tests run in the Node environment, mirror the `lib/`
 * and `app/api/` layout under `tests/`, and resolve the `@/` path alias the
 * same way the Next.js build does.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
});
