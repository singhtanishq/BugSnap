/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// The app is deployed to GitHub Pages under the /BugSnap/ project subpath.
// Hash routing keeps deep links and refreshes working on static hosting.
const BASE_PATH = process.env.BUGSNAP_BASE_PATH ?? "/BugSnap/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          jszip: ["jszip"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.*", "tests/integration/**/*.test.*"],
    css: false,
  },
});
