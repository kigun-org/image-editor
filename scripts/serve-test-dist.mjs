import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import ts from 'typescript';

const dist = resolve(process.env.EDITOR_DIST_DIR || 'dist');
const port = Number(process.env.EDITOR_TEST_PORT || 5178);
// Only the test controller is transpiled. The distributed library is served byte
// for byte from dist. There is deliberately no source or development fallback.
const controller = ts.transpileModule(await readFile('tests/harness/controller.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Built image editor library host</title></head><body><main><h1>Built image editor library host</h1><div id="harness"></div></main><script type="module">import Editor from '/vendor/nested/image-editor.js';import {installHarness} from '/test-controller.js';installHarness(Editor);</script></body></html>`;

http.createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  try {
    if (path === '/library-host/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return;
    }
    if (path === '/test-controller.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(controller); return;
    }
    if (path === '/vendor/nested/image-editor.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(join(dist, path.split('/').at(-1)))); return;
    }
    if (path === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    response.writeHead(404); response.end('Not found');
  } catch (error) {
    response.writeHead(500); response.end('Missing built library asset. Run pnpm build.');
    console.error(error);
  }
}).listen(port, '127.0.0.1', () => console.log(`Library test host: http://127.0.0.1:${port}/library-host/`));
