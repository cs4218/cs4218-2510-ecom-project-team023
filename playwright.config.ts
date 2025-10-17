import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',

  testMatch: ['**/*.spec.{ts,js}'],

  testIgnore: [
    '**/*.test.*',          // ignore all *.test.* (Jest)
    'client/**',            // (optional) ignore client app tests
    'controllers/**',       // (optional) backend Jest tests
    'models/**',
    'routes/**',
    'helpers/**',
    'middlewares/**',
    'config/**',
    // add more app/test folders if needed
  ],

  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Run browsers
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Base browser context settings
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,                   
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
