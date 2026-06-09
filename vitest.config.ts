import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "client/src/lib/**/*.test.ts",
      "client/src/**/*.test.tsx",
    ],
    testTimeout: 30000,
    globalSetup: ["server/vitest.setup.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
});
