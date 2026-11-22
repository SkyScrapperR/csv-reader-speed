// Reads /input/cases.json, answers each case with run from solve.js, writes /output/answers.json (CommonJS: the
// quickest start). run's byte form reads each case straight from the file through a small window and writes its
// answer as bytes, case by case; on input it does not expect, answerPlain answers the whole file instead
// (JSON.parse, run on each {text, header}, JSON.stringify).
const v8 = require('node:v8');
// Type feedback from a function's first call, and no inlining: each measured on Node 22 in a 1-CPU Linux container.
v8.setFlagsFromString('--no-lazy-feedback-allocation');
v8.setFlagsFromString('--no-turbo-inlining');
const { openSync, readFileSync, writeFileSync } = require('node:fs');
const { run, openBytes, closeBytes, answerPlain } = require('./solve.js');

const env = process.env;
const inPath = (env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json';
const outPath = (env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json';
const d = openBytes(openSync(inPath, 'r'), openSync(outPath, 'w'));
if (d !== null) while (d.at >= 0) run(d); // every case, one call of run each
if (d === null || closeBytes(d) === null) writeFileSync(outPath, answerPlain(readFileSync(inPath)));
