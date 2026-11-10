import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/firefox",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  // The 308-test suite can exceed 14 minutes on slower CI runners. Keep a
  // bounded suite deadline while leaving setup/report time in the 22-minute job.
  globalTimeout: process.env.CI ? 18 * 60_000 : undefined,
  expect: { timeout: 7_500 },
  outputDir: "firefox-test-results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "firefox-playwright-report" }],
    ["junit", { outputFile: "firefox-test-results/junit.xml" }]
  ],
  projects: [
    { name: "firefox", testIgnore: "**/live/**" },
    { name: "firefox-live", testMatch: "**/live/**/*.spec.ts", timeout: 90_000 }
  ]
});
