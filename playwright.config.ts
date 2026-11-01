import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(".env.local");
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 240000,
  expect: { timeout: 30000 },
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
    actionTimeout: 20000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
