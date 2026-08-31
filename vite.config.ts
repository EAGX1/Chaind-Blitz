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
    host: true,
    proxy: {
      "/health": { target: "http://127.0.0.1:8787" },
      "/v1": { target: "http://127.0.0.1:8787" },
      "/duel": { target: "http://127.0.0.1:8787", ws: true },
      "/plaza": { target: "http://127.0.0.1:8787", ws: true },
    },
  },
  preview: {
    port: 8765,
    proxy: {
      "/health": { target: "http://127.0.0.1:8787" },
      "/v1": { target: "http://127.0.0.1:8787" },
      "/duel": { target: "http://127.0.0.1:8787", ws: true },
      "/plaza": { target: "http://127.0.0.1:8787", ws: true },
    },
  },
  test: {
    include: ["tests/rules/**/*.{test,spec}.{js,ts}"],
    environment: "node",
    testTimeout: 30000,
  },
});
