// End-to-end fuzzer for main.ts's path: random cases written as cases.json bytes (by JSON.stringify, and by hand
// with other spacing, key orders and escapes), answered by run's byte form on every case (else the plain path), and
// compared with csv-reader 1.0.0 case by case as JSON values. usage: node fuzz/e2e.mjs [batches=100] [casesPerBatch=5000] [seed=1] [kit dir]
import { isDeepStrictEqual } from 'node:util';
import { run, openBytes, closeBytes, answerPlain } from '../solve.js';

// main.ts's path: run's byte form on every case, else the plain path
function answers(buf) {
  const d = openBytes(buf);
  if (d === null) return null;
  while (d.at >= 0) run(d);
  return closeBytes(d);
}
const answerFile = (buf) => answers(buf) ?? answerPlain(buf);

const [B = 100, K = 5000, S = 1] = process.argv.slice(2, 5).map(Number);
const kit = process.argv[5] ?? 'C:/lomba/csv-reader-speed-01-run-20261121-kit';
const { readCsv } = await import(new URL('file:///' + kit + '/baselines/csv-reader/vendor/csv-reader/index.js').href);

let seed = S >>> 0;
let structuralOk = false; // this file may hold \u escapes of CSV characters (they send it down the plain path)
const rnd = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

const BS = '\\';
const ATOMS = [',', '"', '\n', '\r', '\r\n', 'a', 'b', 'é', '😀', ' ', '""', '\uFEFF', 'x"y', ',,', '"\r', '\r"',
  BS, BS + '"', BS + 'n', '\t', '\u0001', '\u001f', '\u2028', '\ud800', '\udfff', '/', '\b', '\f', '\u007f', 'u00', BS + 'u0022'];
const WORDS = ['a', 'bc', 'café', '東京', '😀x', '', ' ', 'longer text here', 'x'.repeat(30), '0', BS, 'tab\there', '\ud83d'];

function soup() {
  let s = rnd() < 0.15 ? '\uFEFF' : '';
  const len = ri(0, pick([4, 12, 40, 200]));
  const few = rnd() < 0.5;
  for (let i = 0; i < len; i++) s += few ? pick(ATOMS.slice(0, 8)) : pick(ATOMS);
  return s;
}

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
        if (rnd() < 0.2) v += pick(['kg', 'x"y', ' ', '\r', '\rz', '"', '""', BS, '\r\r']);
      } else if (y < 0.3) v = '"' + v;
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
    const p = ri(0, s.length);
    s = s.slice(0, p) + '"' + s.slice(p);
  }
  return s;
}

function tiny() {
  return pick(['', '\uFEFF', '\n', '\r', '\r\n', '\n\n', '\r\r', '\r\r\n', '"', '""', '"""', ',', ',\n', '\uFEFF\n', '\uFEFF"',
    'a', 'a\r', '\r\na', '"a"b"c', '"a\r\nb', ',"', BS, '"' + BS + '"', '\uFEFF\uFEFF', '"\r\n"', '"a""']) + (rnd() < 0.5 ? soup().slice(0, 4) : '');
}

// A JSON string for s, escaped another way now and then, as JSON allows: \/, \u00XX for ASCII, \uXXXX for others.
function jstr(s) {
  if (rnd() < 0.7) return JSON.stringify(s);
  let o = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ch === '"') o += !structuralOk || rnd() < 0.9 ? BS + '"' : BS + 'u0022';
    else if (ch === BS) o += BS + BS;
    else if (ch === '\n') o += !structuralOk || rnd() < 0.9 ? BS + 'n' : BS + 'u000a';
    else if (ch === '\r') o += !structuralOk || rnd() < 0.9 ? BS + 'r' : BS + 'u000D';
    else if (ch === ',') o += !structuralOk || rnd() < 0.9 ? ',' : BS + 'u002c';
    else if (ch === '/') o += rnd() < 0.5 ? BS + '/' : '/';
    else if (c < 0x20) o += BS + 'u' + c.toString(16).padStart(4, '0');
    else if (rnd() < 0.05) o += ch.split('').map((u) => BS + 'u' + u.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('');
    else o += JSON.stringify(ch).slice(1, -1);
  }
  return o + '"';
}

const sp = () => pick(['', '', '', ' ', '\n  ', '\t']);
function caseJson(id, text, header) {
  const kv = [`${sp()}"text"${sp()}:${sp()}${jstr(text)}`];
  if (header !== undefined) kv.push(`${sp()}"header"${sp()}:${sp()}${JSON.stringify(header)}`);
  if (rnd() < 0.3) kv.reverse();
  const outer = [`"id":${sp()}${JSON.stringify(id)}`, `"input":${sp()}{${kv.join(',')}${sp()}}`];
  if (rnd() < 0.3) outer.reverse();
  return `${sp()}{${outer.join(`,${sp()}`)}${sp()}}`;
}

const gens = [soup, structured, structured, tiny];
let bad = 0;
let fastFiles = 0;
for (let b = 0; b < B; b++) {
  const cases = [];
  const plain = rnd() < 0.5;
  structuralOk = rnd() < 0.15;
  for (let k = 0; k < K; k++) {
    const header = rnd() < 0.5 ? true : rnd() < 0.9 ? false : pick([1, 'true', null, undefined, 0]);
    cases.push({ id: 'c' + k, text: pick(gens)(), header });
  }
  const json = plain
    ? JSON.stringify(cases.map((c) => ({ id: c.id, input: { text: c.text, header: c.header } })))
    : `${sp()}[${cases.map((c) => caseJson(c.id, c.text, c.header)).join(',')}]${sp()}`;
  const parsed = JSON.parse(json);
  if (answers(Buffer.from(json, 'utf8')) !== null) fastFiles++;
  const got = JSON.parse(answerFile(Buffer.from(json, 'utf8')).toString('utf8'));
  if (got.length !== cases.length) {
    bad++;
    console.log('LENGTH', got.length);
    continue;
  }
  for (let k = 0; k < cases.length; k++) {
    const want = JSON.parse(JSON.stringify(readCsv(parsed[k].input)));
    if (!isDeepStrictEqual(want, got[k])) {
      bad++;
      if (bad <= 5) console.log('MISMATCH', JSON.stringify(parsed[k].input), '\nwant', JSON.stringify(want), '\ngot ', JSON.stringify(got[k]));
    }
  }
}
console.log(`e2e fuzz: ${B} files x ${K} cases (${fastFiles} files on the byte path), ${bad} mismatches`);
process.exit(bad ? 1 : 0);
