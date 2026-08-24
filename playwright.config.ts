import { defineConfig } from "@playwright/test";

const inCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: inCI,
  retries: inCI ? 1 : 0,
  workers: inCI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 7_500
  },
  outputDir: "test-results",
  reporter: inCI
    ? [
        ["line"],
        ["html", { open: "never" }],
        ["junit", { outputFile: "test-results/junit.xml" }]
      ]
    : [
        ["list"],
        ["html", { open: "never" }]
      ],
  use: {
    actionTimeout: 7_500,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "extension",
      testIgnore: "**/live/**"
    },
    {
      name: "live-youtube",
      testMatch: "**/live/**/*.spec.ts"
    }
  ]
});

