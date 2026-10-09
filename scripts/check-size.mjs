import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const limits = { 'image-editor.js': 320 * 1024 };
assert.deepEqual((await readdir('dist')).sort(), Object.keys(limits).sort(), 'The library must contain exactly one JavaScript file with embedded styles.');
for (const [file, limit] of Object.entries(limits)) {
  const bytes = await readFile(`dist/${file}`);
  const compressed = gzipSync(bytes, { level: 9 }).length;
  console.log(`${file}: ${bytes.length} raw bytes; ${compressed}/${limit} gzip level 9 bytes`);
  assert.ok(compressed <= limit, `${file} exceeds its transfer-size budget.`);
}

const manifest = JSON.parse(await readFile('package.json', 'utf8'));
assert.equal(manifest.scripts.dev, 'vite', 'pnpm dev must still start the demo.');
assert.equal(manifest.scripts.build, 'vite build -c vite.lib.config.ts', 'pnpm build must still build the library.');
console.log('Library asset and command contracts passed.');
