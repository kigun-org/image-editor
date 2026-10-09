import { defineConfig } from '@playwright/test';
import { common, browsers } from './playwright.shared';

export default defineConfig({
  ...common,
  testDir: './tests/dist',
  outputDir: './test-results/dist',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/dist' }]],
  use: { ...common.use, baseURL: 'http://127.0.0.1:5178' },
  projects: browsers,
  webServer: {
    command: 'node scripts/serve-test-dist.mjs',
    url: 'http://127.0.0.1:5178/library-host/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
