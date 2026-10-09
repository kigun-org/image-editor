import { defineConfig } from '@playwright/test';
import { common } from './playwright.shared';

export default defineConfig({
  ...common,
  testDir: './tests/perf',
  outputDir: './test-results/perf',
  timeout: 600_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5179', trace: 'off', screenshot: 'off' },
  projects: [{ name: 'chromium-perf', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node scripts/serve-test-dist.mjs',
    env: { EDITOR_TEST_PORT: '5179' },
    url: 'http://127.0.0.1:5179/library-host/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
