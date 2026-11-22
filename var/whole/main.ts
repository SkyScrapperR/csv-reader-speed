// Reads /input/cases.json, answers each case with run from solve.js, writes /output/answers.json (CommonJS: the
// quickest start). run's byte form reads each case straight from the file's bytes and writes its answer as bytes;
// on input it does not expect, answerPlain answers (JSON.parse, run on each {text, header}, JSON.stringify).
const v8 = require('node:v8');
// Type feedback from a function's first call, and no inlining: each measured on Node 22 in a 1-CPU Linux container.
v8.setFlagsFromString('--no-lazy-feedback-allocation');
v8.setFlagsFromString('--no-turbo-inlining');
const { readFileSync, writeFileSync } = require('node:fs');
const { run, openBytes, closeBytes, answerPlain } = require('./solve.js');

const env = process.env;
const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');
const d = openBytes(input);
if (d !== null) while (d.at >= 0) run(d); // every case, one call of run each
let out = d === null ? null : closeBytes(d);
if (out === null) out = answerPlain(input);
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);
