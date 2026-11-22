// Reads /input/cases.json, answers every case, writes /output/answers.json (CommonJS: the quickest start).
// fast.cjs reads each case's CSV straight from the JSON bytes and writes the answers' JSON bytes; on input it does
// not expect it returns null, and solve.js's plain path (JSON.parse, run on each case, JSON.stringify) answers.
const v8 = require('node:v8');
// Type feedback from a function's first call, and no inlining (the reader's caller compiles in a fraction): each
// measured on Node 22 in a 1-CPU Linux container.
v8.setFlagsFromString('--no-lazy-feedback-allocation');
v8.setFlagsFromString('--no-turbo-inlining');
const { readFileSync, writeFileSync } = require('node:fs');
const { answers } = require('./fast.cjs');

const env = process.env;
const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');
let out = answers(input);
if (out === null) out = require('./solve.js').answerPlain(input);
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);
