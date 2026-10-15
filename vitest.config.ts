import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Next resolves "server-only" itself. Tests run outside Next, so it points at an empty module.
    alias: { "@": root, "server-only": path.join(root, "test", "server-only.ts") },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
