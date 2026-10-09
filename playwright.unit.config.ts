import { defineConfig } from '@playwright/test';
import { common } from './playwright.shared';

export default defineConfig({ ...common, testDir: './tests/unit', outputDir: './test-results/unit', projects: [{ name: 'unit' }], reporter: 'list' });
