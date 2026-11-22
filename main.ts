// Reads /input/cases.json, answers every case, writes /output/answers.json. fast.js reads each case's CSV straight
// from the JSON bytes and writes the answers' JSON bytes; on input it does not expect it returns null, and solve.js's
// plain path (JSON.parse, run on each case, JSON.stringify) answers instead.
import { readFileSync, writeFileSync } from 'node:fs';
import { answers } from './fast.js';

const env = process.env;
const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');
let out = answers(input);
if (out === null) out = (await import('./solve.js')).answerPlain(input);
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);
