import { defineConfig, devices } from '@playwright/test';
import { common, browsers } from './playwright.shared';

export default defineConfig({
  ...common,
  testDir: './tests/browser',
  outputDir: './test-results/browser',
  use: { ...common.use, baseURL: 'http://127.0.0.1:5177' },
  projects: [...browsers, {
    name: 'touch',
    testMatch: '**/touch.spec.ts',
    use: { ...devices['Pixel 7'] },
  }],
  webServer: {
    command: 'pnpm exec vite -c vite.test.config.ts --host 127.0.0.1 --port 5177 --strictPort',
    url: 'http://127.0.0.1:5177/tests/harness/index.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
