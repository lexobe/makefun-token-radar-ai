import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

const MAX_TEXT_BYTES = 65536;
const SHOT_CAPS = { max: 4, max_bytes: 524288 };
const VALID_IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function getArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

const inputPath = getArg('input', '/input');
const snapshotFile = inputPath.endsWith('.json') ? inputPath : join(inputPath, 'snapshot.json');
if (!existsSync(snapshotFile)) {
  process.stderr.write(`Error: Snapshot not found at ${snapshotFile}\n`);
  process.exit(2);
}
const outputDir = getArg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const rawData = readFileSync(snapshotFile, 'utf8');
const snapshot = parseSnapshot(rawData);
const { board, radar } = buildRadar(snapshot);
const validationIssue = boardIssue(board, snapshot);
if (validationIssue !== null) {
  process.stderr.write(`Validation failed: ${validationIssue}\n`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

function copyDirFiles(src: string, dest: string): string[] {
  if (!existsSync(src)) return [];
  mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  for (const filename of readdirSync(src)) {
    if (filename.startsWith('.')) continue;
    const fullPath = join(src, filename);
    if (!statSync(fullPath).isFile()) continue;
    copyFileSync(fullPath, join(dest, filename));
    copied.push(filename);
  }
  return copied;
}

copyDirFiles(join(currentDir, 'dashboard'), join(outputDir, 'dashboard'));
const copiedShots = copyDirFiles(join(currentDir, 'screenshots'), join(outputDir, 'screenshots'));
if (copiedShots.length < 3) {
  process.stderr.write(`Need at least 3 screenshots.\n`);
  process.exit(1);
}
for (const s of copiedShots) {
  if (!VALID_IMAGE_NAME.test(s)) {
    process.stderr.write(`Invalid screenshot name: ${s}\n`);
    process.exit(1);
  }
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, { text_max_bytes: MAX_TEXT_BYTES, screenshots: SHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(`Caishen AI Token Radar completed successfully.\n`);
