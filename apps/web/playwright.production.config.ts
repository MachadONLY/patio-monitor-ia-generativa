import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/production-acceptance.spec.ts",
  timeout: 120_000,
  expect: { timeout: 18_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/production-acceptance.json" }]],
  outputDir: "test-results/production-acceptance",
  use: {
    baseURL: "https://patio-monitor-production.up.railway.app",
    viewport: { width: 1440, height: 900 },
    browserName: "chromium",
    ignoreHTTPSErrors: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: { args: [
      "--use-gl=angle", "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ] },
  },
});
