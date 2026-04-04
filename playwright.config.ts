import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "https://buildai-dlc.vercel.app",
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    headless: false,
    slowMo: 300,
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-iphone",
      use: { ...devices["iPhone 14"], hasTouch: true },
    },
  ],
});
