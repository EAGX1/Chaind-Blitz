import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:8765",
    headless: true,
    viewport: { width: 1600, height: 900 }
  },
  webServer: {
    command: "node tools/serve.js 8765",
    url: "http://localhost:8765",
    reuseExistingServer: true,
    timeout: 20000
  }
});
