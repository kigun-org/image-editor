import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import isolateEditor from '../../scripts/isolate-editor-css.mjs';

test('retains separate demo and library commands', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  expect(manifest.scripts.dev).toBe('vite');
  expect(manifest.scripts.build).toBe('vite build -c vite.lib.config.ts');
  const buildConfig = await readFile('vite.lib.config.ts', 'utf8');
  expect(buildConfig).toContain('src/lib/ImageEditor.svelte');
  const directHarness = await readFile('tests/harness/main.ts', 'utf8');
  expect(directHarness).toContain('src/lib/ImageEditor.svelte');
  expect(directHarness).not.toMatch(/App\.svelte|src\/main/);
  const staticHost = await readFile('scripts/serve-test-dist.mjs', 'utf8');
  expect(staticHost).toContain('/vendor/nested/image-editor.js');
  expect(staticHost).not.toMatch(/App\.svelte|src\/lib\/ImageEditor/);
});

test('isolates framework selectors, variables, layers and keyframes', async () => {
  const input = '@layer theme, utilities; @layer theme { :root, :host { --color-primary: red } } @layer utilities { .btn, [data-theme=light] .input { color: var(--color-primary); animation: spin 1s; &:hover { color: blue } } } @keyframes spin { to { transform: rotate(1turn) } } @property --tw-color { syntax: "<color>"; inherits: false; initial-value: red }';
  const result = await postcss([isolateEditor()]).process(input, { from: `${process.cwd()}/src/lib/tailwind.css` });
  expect(result.css).not.toContain('@layer');
  expect(result.css).toContain('.image-editor .btn');
  expect(result.css).toContain('.image-editor [data-theme=light] .input');
  expect(result.css).toContain('--ie-color-primary');
  expect(result.css).toContain('@keyframes ie-spin');
  expect(result.css).toContain('animation: ie-spin 1s');
  expect(result.css).not.toContain('@property');
  expect(result.css).toContain('--ie-tw-color: red');
  expect(result.css).not.toContain('.image-editor to');
});


test('resets the root and pseudo-elements and accepts inline CSS imports', async () => {
  const result = await postcss([isolateEditor()]).process(
    '*, ::before, ::after { margin: 0; padding: 1.5rem } html, :host { line-height: 1.5 }',
    { from: `${process.cwd()}/src/lib/tailwind.css?inline` },
  );
  expect(result.css).toContain('.image-editor::before');
  expect(result.css).toContain('.image-editor::after');
  expect(result.css).toContain('padding: 24px');
  expect(result.css).not.toMatch(/(?:html|:host|rem)/);
});
