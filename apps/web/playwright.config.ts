import { defineConfig } from "@playwright/test";

const animationTest = /the Alvorada scenery animates independently of GPS and respects reduced motion/;
const crossingsTest = /operating view displays estimated terminal crossing intervals and evidence method/;
const operatingRegression = "**/operating-regression.spec.ts";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  workers: 1,
  // Give the screenshot-heavy WebGL tests their own browser processes.
  projects: [
    { name: "animation", testMatch: operatingRegression, grep: animationTest },
    { name: "terminal-crossings", testMatch: operatingRegression, grep: crossingsTest },
    { name: "application", grepInvert: [animationTest, crossingsTest] },
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: [
    {
      command: "pnpm preview --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "python -m uvicorn app.main:app --app-dir ../../services/api --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: false,
      env: { SPTRANS_TOKEN: "", PATIO_AREA_FILE: "", PATIO_REPLAY_FILE: "" },
    },
  ],
});
