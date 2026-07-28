// Vite config used exclusively for the SSR bundle built at production build
// time (see script/build.ts).  Kept separate from vite.config.ts so the
// client-only settings (manualChunks, dev plugins, etc.) don't bleed into
// the Node.js render bundle.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    ssr: "src/entry-server.tsx",
    outDir: path.resolve(import.meta.dirname, "dist/ssr"),
    emptyOutDir: true,
    // No manualChunks: SSR bundles are Node.js modules, not browser chunks.
  },
});
