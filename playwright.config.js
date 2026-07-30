import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.e2e\.spec\.js/,
  timeout: 30000,
  workers: 1,
  expect: {
    timeout: 5000
  },
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true
  },
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 }
  }
});
