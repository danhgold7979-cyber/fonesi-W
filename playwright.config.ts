import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/ui',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1600, height: 1000 },
    timezoneId: 'Asia/Ho_Chi_Minh',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['json', { outputFile: 'test-results/ui-report.json' }]],
  webServer: {
    command: 'node tools/start-ui-test-host.mjs',
    url: 'http://127.0.0.1:4175/health',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
