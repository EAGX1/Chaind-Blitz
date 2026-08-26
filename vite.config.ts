import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
  worker: {
    format: "es",
  },
  server: {
    port: 8765,
    strictPort: true,
  },
  preview: {
    port: 8765,
  },
  test: {
    include: ["tests/rules/**/*.{test,spec}.{js,ts}"],
    environment: "node",
    testTimeout: 30000,
  },
});
