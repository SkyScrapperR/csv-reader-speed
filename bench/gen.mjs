// Writes a cases.json like the contest's (6 cases, 1.4-2.0 M chars each, 8-18 columns, LF or CRLF, BOM, header,
// quoted phrases, multi-line notes, short/long rows, stray CRs, quote junk, blank lines, an unterminated tail quote).
// Written from the contest's public description; usage: node bench/gen.mjs <outDir> [seed]
import { mkdirSync, writeFileSync } from 'node:fs';
let s = Number(process.argv[3] ?? 42) >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const W = 'amber bridge cobalt delta echo field garden harbor ivory jade kilo lima market north onyx papa river stone tango valley Zürich café naïve Kraków 東京 Москва Δέλτα #42 50% n/a TBD x_1 A&B O\'Brien'.split(' ');
const kinds = ['int', 'dec', 'date', 'code', 'word', 'phrase', 'phrase', 'note', 'maybe'];
function val(k, eol) {
  switch (k) {
    case 'int': return String(ri(0, 9999999));
    case 'dec': return `${ri(0, 99999)}.${ri(10, 99)}`;
    case 'date': return `${ri(1990, 2030)}-0${ri(1, 9)}-${ri(10, 28)}`;
    case 'code': return `AB-${ri(100, 99999)}`;
    case 'word': return pick(W);
    case 'maybe': return rnd() < 0.4 ? '' : pick(W);
    case 'phrase': { let v = pick(W); for (let i = ri(1, 5); i > 0; i--) v += (rnd() < 0.1 ? ', ' : ' ') + pick(W); return rnd() < 0.12 ? `"${v}" ${pick(W)}` : v; }
    default: { if (rnd() < 0.85) return rnd() < 0.3 ? '' : pick(W); let v = pick(W); for (let i = ri(1, 3); i > 0; i--) v += (rnd() < 0.1 ? '\r' : eol) + pick(W); return v; }
  }
}
const cell = (v) => (/[,"\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : rnd() < 0.01 && v ? `"${v}"` : v);
const cases = [];
for (let c = 0; c < 6; c++) {
  const eol = rnd() < 0.5 ? '\r\n' : '\n', width = ri(8, 18), ks = Array.from({ length: width }, () => pick(kinds));
  const target = ri(1400000, 2000000), header = c % 3 !== 2;
  let t = rnd() < 1 / 3 ? '\uFEFF' : '';
  if (header) t += ks.map((k, i) => k + i).join(',') + eol;
  while (t.length < target) {
    let f = ks.map((k) => cell(val(k, eol)));
    const x = rnd();
    if (x < 0.01) f.length = width - ri(1, 3); else if (x < 0.02) f.push('x', 'y');
    else if (x < 0.024) f[ri(0, f.length - 1)] = 'ab\rcd'; else if (x < 0.028) f[0] = '"q"kg'; else if (x < 0.031) t += eol;
    t += f.join(',') + eol;
  }
  if (rnd() < 0.5) t += '"' + 'tail,rec' + eol + 'more,rows' + eol;
  cases.push({ id: `g-000${c + 1}`, input: { text: t, header } });
}
mkdirSync(process.argv[2], { recursive: true });
writeFileSync(process.argv[2] + '/cases.json', JSON.stringify(cases));
