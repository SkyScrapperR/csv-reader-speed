// Runs `node <main.ts>` pinned to one CPU (Windows), passing stderr through. usage: node bench/pin.mjs <main.ts> [inputDir]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const env = { ...process.env, MAKEFUN_INPUT_DIR: process.argv[3] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit/practice/input', MAKEFUN_OUTPUT_DIR: process.env.TEMP };
const p = spawnSync('cmd.exe', ['/c', 'start', '""', '/b', '/wait', '/affinity', '1', process.execPath, resolve(process.argv[2])], { env, encoding: 'utf8', timeout: 60000 });
process.stdout.write(p.stdout + p.stderr);
