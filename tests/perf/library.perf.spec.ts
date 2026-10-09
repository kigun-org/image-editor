import { test, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { platform, arch, release } from 'node:os';
import type { EditorHarness } from '../harness/controller';

interface Sample { cold: number; preview: number; adjust: number; export: number; }
interface Summary { median: number; p95: number; }
const summarize = (values: number[]): Summary => {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: (sorted[9] + sorted[10]) / 2, p95: sorted[18] };
};

test('twenty fixed-environment samples measure built-library loading, preview, and export', async ({ browser }) => {
  const fixtures = [{ name: 'small', width: 400, height: 300 }, { name: '12mp', width: 4000, height: 3000 }];
  const results: Record<string, { samples: Sample[]; summary: Record<keyof Sample, Summary> }> = {};
  const fixtureHashes: Record<string, string> = {};
  let gpu = '';
  for (const fixture of fixtures) {
    const samples: Sample[] = [];
    for (let index = 0; index < 23; index++) {
      const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
      const page = await context.newPage();
      const coldStart = performance.now();
      await page.goto('/library-host/');
      await page.waitForFunction(() => !!window.editorHarness);
      const cold = performance.now() - coldStart;
      if (!gpu) gpu = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const renderer = info ? String(gl?.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown';
        gl?.getExtension('WEBGL_lose_context')?.loseContext(); return renderer;
      });
      const prepared = await page.evaluate(async ({ width, height }) => {
        const fixture = document.createElement('canvas'); fixture.width = width; fixture.height = height;
        const context = fixture.getContext('2d')!;
        context.fillStyle = '#164c84'; context.fillRect(0, 0, width, height);
        context.fillStyle = '#e7ad34'; context.fillRect(0, 0, Math.floor(width / 3), Math.floor(height / 2));
        const imageBlob = await new Promise<Blob>(resolve => fixture.toBlob(value => resolve(value!), 'image/png'));
        fixture.width = 0; fixture.height = 0;
        const digest = await crypto.subtle.digest('SHA-256', await imageBlob.arrayBuffer());
        const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        const start = performance.now(); window.editorHarness.mount('first', { imageBlob }); return { start, hash };
      }, fixture);
      if (fixtureHashes[fixture.name]) expect(prepared.hash).toBe(fixtureHashes[fixture.name]);
      fixtureHashes[fixture.name] = prepared.hash;
      // This observable readiness condition works for the reviewed baseline and
      // the new library. It does not inspect Fabric or Pixi instances.
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-editor-host="first"] [data-image-editor-host]')!.shadowRoot;
        const canvases = root?.querySelectorAll('canvas');
        const save = [...root!.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Save image');
        return canvases?.length === 3 && [...canvases].every(canvas => canvas.width > 1) && save && !save.disabled;
      });
      const preview = await page.evaluate(start => performance.now() - start, prepared.start);
      const adjust = await page.evaluate(async () => {
        const range = document.querySelector('[data-editor-host="first"] [data-image-editor-host]')!.shadowRoot!.querySelectorAll<HTMLInputElement>('input[type="range"]')[1];
        if (!range) throw new Error('The brightness control is missing.');
        const start = performance.now(); range.value = '1.1'; range.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return performance.now() - start;
      });
      const exported = await page.evaluate(async () => {
        const harness: EditorHarness = window.editorHarness;
        const start = performance.now();
        const root = document.querySelector('[data-editor-host="first"] [data-image-editor-host]')!.shadowRoot!;
        [...root.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Save image')!.click();
        await new Promise<void>((resolve, reject) => {
          const deadline = performance.now() + 30_000;
          const poll = () => {
            if (harness.saved().length) resolve();
            else if (performance.now() > deadline) reject(new Error('Benchmark export did not complete.'));
            else requestAnimationFrame(poll);
          }; poll();
        });
        const elapsed = performance.now() - start;
        if (!(harness.saved()[0] instanceof Blob)) throw new Error('Benchmark export was not a Blob.');
        return elapsed;
      });
      if (index >= 3) samples.push({ cold, preview, adjust, export: exported });
      await context.close();
    }
    results[fixture.name] = { samples, summary: {
      cold: summarize(samples.map(sample => sample.cold)),
      preview: summarize(samples.map(sample => sample.preview)),
      adjust: summarize(samples.map(sample => sample.adjust)),
      export: summarize(samples.map(sample => sample.export)),
    } };
  }
  const environment = { browser: browser.version(), node: process.version, platform: platform(), arch: arch(), release: release(), gpu,
    viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1, fixtureHashes };
  const revision = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), assets: {} as Record<string, string> };
  for (const file of ['image-editor.js']) {
    revision.assets[file] = createHash('sha256').update(await readFile(resolve(process.env.EDITOR_DIST_DIR || 'dist', file))).digest('hex');
  }
  const report = { date: new Date().toISOString(), environment, revision, results };
  await mkdir('.reports/performance', { recursive: true });
  const reportPath = process.env.EDITOR_PERF_REPORT || '.reports/performance/current.json';
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ environment, summaries: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.summary])) }, null, 2));
  if (process.env.EDITOR_PERF_BASELINE) {
    const baseline = JSON.parse(await readFile(process.env.EDITOR_PERF_BASELINE, 'utf8')) as typeof report;
    expect(environment, 'Benchmark environments must match.').toEqual(baseline.environment);
    for (const fixture of fixtures) for (const metric of ['cold', 'preview', 'adjust', 'export'] as const) {
      for (const statistic of ['median', 'p95'] as const) {
        expect.soft(results[fixture.name].summary[metric][statistic], `${fixture.name} ${metric} ${statistic} regression`).toBeLessThanOrEqual(baseline.results[fixture.name].summary[metric][statistic] * 1.10);
      }
    }
  }
});

test('dedicated large inputs preserve the accepted limits and remain recoverable', async ({ page }) => {
  test.skip(process.env.EDITOR_PERF_LARGE !== '1', 'Run with EDITOR_PERF_LARGE=1 on the dedicated high-memory runner.');
  for (const fixture of [{ width: 8192, height: 4096, bytes: 0 }, { width: 10000, height: 8000, bytes: 0 }, { width: 400, height: 300, bytes: 50 * 1024 * 1024 }]) {
    await page.goto('/library-host/'); await page.waitForFunction(() => !!window.editorHarness);
    await page.evaluate(async ({ width, height, bytes }) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d')!; context.fillStyle = '#164c84'; context.fillRect(0, 0, width, height);
      const original = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
      canvas.width = 0; canvas.height = 0;
      const imageBlob = bytes ? new Blob([original, new Uint8Array(bytes - original.size)], { type: 'image/png' }) : original;
      window.editorHarness.mount('first', { imageBlob });
    }, fixture);
    await expect(page.getByRole('button', { name: 'Save image', exact: true })).toBeEnabled({ timeout: 120_000 });
    await page.getByRole('button', { name: 'Save image', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls()), { timeout: 120_000 }).toBe(1);
    expect(await page.evaluate(async () => {
      const image = await createImageBitmap(window.editorHarness.saved()[0]);
      const edge = Math.max(image.width, image.height); image.close(); return edge;
    })).toBeLessThanOrEqual(8192);
    await page.evaluate(() => window.editorHarness.clear());
  }
});
