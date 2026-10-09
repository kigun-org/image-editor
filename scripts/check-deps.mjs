import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('.reports/audit', { recursive: true });
let failures = 0;
for (const production of [false, true]) {
  const name = production ? 'production' : 'full';
  const command = spawnSync('pnpm', ['audit', '--json', ...(production ? ['--prod'] : [])], { encoding: 'utf8' });
  let report;
  try { report = JSON.parse(command.stdout); } catch {
    console.error(`${name} dependency audit is inconclusive.`, command.stderr || command.stdout);
    process.exitCode = 1;
    continue;
  }
  await writeFile(`.reports/audit/${name}.json`, JSON.stringify(report, null, 2));
  if (!report.metadata?.vulnerabilities || report.error || command.error) {
    console.error(`${name} dependency audit is inconclusive.`, report.error || command.error);
    process.exitCode = 1;
    continue;
  }
  console.log(`${name}: ${JSON.stringify(report.metadata.vulnerabilities)}`);
  // No reachability exceptions are accepted in this release. Do not infer
  // safety from a development-only package label: it may contribute runtime code.
  for (const advisory of Object.values(report.advisories ?? {})) {
    if (['high', 'critical'].includes(advisory.severity)) {
      failures++;
      console.error(`${advisory.github_advisory_id}: ${advisory.module_name}: ${advisory.url}`);
    }
  }
}
if (failures) process.exitCode = 1;
