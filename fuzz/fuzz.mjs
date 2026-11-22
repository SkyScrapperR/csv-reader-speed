// Differential fuzzer: solve.js against csv-reader 1.0.0 (the kit's vendored reference), compared as JSON values.
// usage: node fuzz/fuzz.mjs [cases=500000] [seed=1] [kit dir]
import { isDeepStrictEqual } from 'node:util';
import { run } from '../solve.js';

const N = Number(process.argv[2] ?? 500000);
let seed = Number(process.argv[3] ?? 1) >>> 0;
const kit = process.argv[4] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit';
const { readCsv } = await import(new URL('file:///' + kit + '/baselines/csv-reader/vendor/csv-reader/index.js').href);

// mulberry32
function rnd() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

const ATOMS = [',', '"', '\n', '\r', '\r\n', 'a', 'b', 'é', '😀', ' ', '""', '\uFEFF', 'x"y', ',,', '"\r', '\r"', '\\', '\t', '\u2028', '\ud800'];
const WORDS = ['a', 'bc', 'café', '東京', '😀x', '', ' ', 'longer text', 'x'.repeat(40), '0'];

// 1) a soup of special characters
function soup() {
  const len = ri(0, pick([4, 12, 40, 200]));
  let s = rnd() < 0.15 ? '\uFEFF' : '';
  const weights = rnd();
  for (let i = 0; i < len; i++) s += weights < 0.5 ? pick(ATOMS) : pick(ATOMS.slice(0, 8));
  return s;
}

// 2) a structured CSV with breakage
function structured() {
  const eol = pick(['\n', '\r\n', '\n', '\r\n', '\r']);
  const width = ri(1, 6);
  const recs = ri(0, pick([3, 10, 60]));
  let s = rnd() < 0.3 ? '\uFEFF' : '';
  for (let r = 0; r < recs; r++) {
    let w = width;
    const x = rnd();
    if (x < 0.15) w = ri(0, width);
    else if (x < 0.3) w = width + ri(1, 3);
    const parts = [];
    for (let f = 0; f < w; f++) {
      let v = pick(WORDS);
      const y = rnd();
      if (y < 0.25) {
        let inner = v;
        if (rnd() < 0.3) inner += '""' + pick(WORDS);
        if (rnd() < 0.2) inner += pick(['\n', '\r\n', '\r', ',']) + pick(WORDS);
        v = '"' + inner + '"';
        if (rnd() < 0.2) v += pick(['kg', 'x"y', ' ', '\r', '\rz', '"', '""']);
      } else if (y < 0.3) v = '"' + v; // maybe unterminated
      else if (y < 0.35) v = v + '\r' + pick(WORDS);
      else if (y < 0.38) v = v + '"' + pick(WORDS);
      parts.push(v);
    }
    s += parts.join(',');
    if (rnd() < 0.1) s += pick(['\r', '\r\r', '']);
    s += rnd() < 0.08 ? eol + eol : eol;
  }
  if (rnd() < 0.4) s = s.slice(0, Math.max(0, s.length - ri(0, 3)));
  if (rnd() < 0.1) {
    // an unterminated quote at a random position
    const p = ri(0, s.length);
    s = s.slice(0, p) + '"' + s.slice(p);
  }
  return s;
}

// 3) only line breaks / tiny edge texts
function tiny() {
  return pick(['', '\uFEFF', '\n', '\r', '\r\n', '\n\n', '\r\r', '\r\r\n', '"', '""', '"""', ',', ',\n', '\uFEFF\n', '\uFEFF"', 'a', 'a\r', '\r\na', '"a"b"c', '"a\r\nb', ',"']) + (rnd() < 0.5 ? soup().slice(0, 4) : '');
}

const gens = [soup, structured, structured, tiny];
let bad = 0;
const norm = (v) => JSON.parse(JSON.stringify(v));
for (let k = 0; k < N; k++) {
  const text = pick(gens)();
  const header = rnd() < 0.5 ? true : rnd() < 0.9 ? false : pick([1, 'true', null, undefined]);
  const input = { text, header };
  let want, got;
  try {
    want = norm(readCsv({ ...input }));
  } catch (e) {
    want = 'throw';
  }
  try {
    got = norm(run({ ...input }));
  } catch (e) {
    got = 'throw:' + e.message;
  }
  if (!isDeepStrictEqual(want, got)) {
    bad++;
    if (bad <= 5) console.log('MISMATCH', JSON.stringify(input), '\nwant', JSON.stringify(want), '\ngot ', JSON.stringify(got));
  }
}
console.log(`fuzz: ${N} cases, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
