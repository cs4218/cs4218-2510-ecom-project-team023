import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",

  testMatch: ["**/*.spec.{ts,js}"],

  testIgnore: [
    "**/*.test.*", // ignore all *.test.* (Jest)
    "client/**", // (optional) ignore client app tests
    "controllers/**", // (optional) backend Jest tests
    "models/**",
    "routes/**",
    "helpers/**",
    "middlewares/**",
    "config/**",
    // add more app/test folders if needed
  ],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Run browsers
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Base browser context settings
  use: {
    baseURL: "http://localhost:3000",
    headless: false,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    timeout: 180_000,           // wait up to 3 mins
    reuseExistingServer: true,  // don’t restart if already running
  },
});
