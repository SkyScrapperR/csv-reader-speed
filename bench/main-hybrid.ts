// Reads /input/cases.json, answers each case with run from solve.js, writes /output/answers.json (CommonJS: the
// quickest start). io.cjs splits the input into its cases and decodes each text on its own (no JSON.parse of the
// whole file), and writes run's answers as bytes (no JSON.stringify); on input it does not expect, solve.js's plain
// path (JSON.parse, run on each case, JSON.stringify) answers.
const v8 = require('node:v8');
// GC on the main thread only (its helper threads cost more CPU than they save on one core)
v8.setFlagsFromString('--no-parallel-scavenge');
v8.setFlagsFromString('--no-concurrent-marking');
v8.setFlagsFromString('--no-parallel-marking');
v8.setFlagsFromString('--no-parallel-compaction');
v8.setFlagsFromString('--no-parallel-pointer-update');
v8.setFlagsFromString('--no-concurrent-sweeping');
v8.setFlagsFromString('--no-incremental-marking');
const { readFileSync, writeFileSync } = require('node:fs');
const { run, answerPlain } = require('./solve.js');
const { answersWith } = require('./io.cjs');

const env = process.env;
const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');
let out = answersWith(run, input);
if (out === null) out = answerPlain(input);
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);
