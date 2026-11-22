// Reads /input/cases.json, answers each case with run() from solve.js, writes /output/answers.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { run } from './solve.js';

setFlagsFromString('--no-incremental-marking');

const env = process.env;
const inDir = env.MAKEFUN_INPUT_DIR || '/input';
const outDir = env.MAKEFUN_OUTPUT_DIR || '/output';
const cases = JSON.parse(readFileSync(inDir + '/cases.json', 'utf8'));
const answers = [];
for (let i = 0; i < cases.length; i++) answers.push(run(cases[i].input));
writeFileSync(outDir + '/answers.json', JSON.stringify(answers));
