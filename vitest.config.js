import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/rules/**/*.{test,spec}.{js,ts}"],
    environment: "node",
    testTimeout: 30000,
  },
});
