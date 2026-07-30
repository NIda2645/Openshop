import { defineConfig } from '@playwright/test';

// Chromium runs the whole suite. Firefox and WebKit run the flows tagged
// @cross-browser — open, edit, filter, save, recover, export, and the keyboard
// and dialog contracts — because the README claims full support there and a
// Chromium-only suite cannot back that claim up.
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
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 1000 }
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' }, grep: /@cross-browser/ },
    { name: 'webkit', use: { browserName: 'webkit' }, grep: /@cross-browser/ }
  ]
});
