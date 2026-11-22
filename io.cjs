// The I/O around run() for main.ts: cases(buf) splits the bytes of /input/cases.json into its cases without parsing
// the whole file, each case's text decoded on its own; serialize writes run()'s answers as the bytes of
// /output/answers.json, with no JSON.stringify. Anything it does not expect returns null, and main.ts then reads the
// file the plain way (JSON.parse, run, JSON.stringify).
//
// A text is decoded from a latin1 view of its JSON string (each byte one char: fast, and every string one-byte),
// unless the string holds a \u escape of a non-ASCII character (JSON.stringify writes one only for a lone surrogate):
// then from UTF-8. Every CSV character is ASCII and a UTF-8 sequence holds no ASCII byte, so run() reads the latin1
// view exactly as it reads the text, field for field; its strings hold the fields' UTF-8 bytes, which serialize
// writes back byte for byte. The one character-level rule is the leading U+FEFF: in the latin1 view it is the bytes
// EF BB BF, which cases() drops before run() sees the text (run would drop the U+FEFF; the answer is the same).

let B = null;

function ws(p) {
  const b = B;
  for (;;) {
    const c = b[p];
    if (c === 32 || c === 10 || c === 13 || c === 9) p++;
    else return p;
  }
}

// The closing quote of the JSON string whose opening quote is at p, or -1.
function strEnd(p) {
  const b = B;
  let j = p + 1;
  for (;;) {
    j = b.indexOf(34, j);
    if (j < 0) return -1;
    let k = j - 1;
    while (b[k] === 92) k--;
    if (((j - 1 - k) & 1) === 0) return j;
    j++;
  }
}

// The closing quote of a text whose opening quote is at p. Inside a JSON string a quote is always \", so the bytes
// `","header":` cannot occur in it: their first occurrence after p ends the text when the header key follows it, as
// JSON.stringify writes {text, header}. A wrong guess (no header key after this text) cannot parse: JSON.parse of
// the slice throws, and the plain path takes the file.
const HEADER_AFTER = Buffer.from('","header":', 'latin1');
let exact = false; // the second try: every string's end found exactly
function textEnd(p) {
  if (exact) return strEnd(p);
  const m = B.indexOf(HEADER_AFTER, p + 1);
  return m > p ? m : strEnd(p);
}

function keyIs(p, q, s) {
  if (q - p - 1 !== s.length) return false;
  for (let k = 0; k < s.length; k++) if (B[p + 1 + k] !== s.charCodeAt(k)) return false;
  return true;
}

// After a value at p: the position past a comma (next pair), -1 at the closing brace or bracket, else -2.
function next(p, close) {
  p = ws(p);
  if (B[p] === 44) return ws(p + 1);
  if (B[p] === close) return -1;
  return -2;
}

const BSU = Buffer.from([92, 117]); // the bytes of \u

// True when the JSON string from t to n holds a \u escape of a character past U+007F (a lone surrogate, as
// JSON.stringify writes them): its text is decoded from UTF-8, not read in the latin1 view.
function hasWideEscape(t, n) {
  const b = B.subarray(0, n); // search the text's own bytes, not the rest of the file
  let j = t;
  for (;;) {
    j = b.indexOf(BSU, j);
    if (j < 0) return false;
    let k = j - 1;
    while (b[k] === 92) k--;
    if (((j - k) & 1) === 1) {
      // a real escape: \u00XX with XX under 80 is ASCII
      if (!(b[j + 2] === 48 && b[j + 3] === 48 && b[j + 4] >= 48 && b[j + 4] <= 55)) return true;
    }
    j += 2;
  }
}

/**
 * The cases of the bytes of cases.json, in order, as where each text's JSON string lies (t, n: its quotes) and its
 * header (undefined: no header key), or null to take the plain path. inputOf decodes a case's text.
 */
function cases(buf) {
  B = buf;
  try {
    const out = [];
    let p = ws(0);
    if (B[p] !== 91) return null;
    p = ws(p + 1);
    if (B[p] === 93) return ws(p + 1) === buf.length ? out : null;
    for (;;) {
      if (B[p] !== 123) return null;
      p = ws(p + 1);
      let sawId = false;
      let input = null;
      for (;;) {
        if (B[p] !== 34) return null;
        const q = strEnd(p);
        if (q < 0) return null;
        let v = ws(q + 1);
        if (B[v] !== 58) return null;
        v = ws(v + 1);
        if (keyIs(p, q, 'id') && !sawId) {
          sawId = true;
          if (B[v] !== 34) return null;
          const e = strEnd(v);
          if (e < 0) return null;
          p = e + 1;
        } else if (keyIs(p, q, 'input') && input === null) {
          if (B[v] !== 123) return null;
          p = ws(v + 1);
          let t = -1;
          let n = -1;
          let header;
          let sawText = false;
          let sawHeader = false;
          for (;;) {
            if (B[p] !== 34) return null;
            const kq = strEnd(p);
            if (kq < 0) return null;
            let w = ws(kq + 1);
            if (B[w] !== 58) return null;
            w = ws(w + 1);
            if (keyIs(p, kq, 'text') && !sawText) {
              sawText = true;
              if (B[w] !== 34) return null;
              t = w;
              n = textEnd(w);
              if (n < 0) return null;
              p = n + 1;
            } else if (keyIs(p, kq, 'header') && !sawHeader) {
              sawHeader = true;
              // only the literal true is a header; any other primitive is read for what it is
              if (B[w] === 116 && B[w + 1] === 114 && B[w + 2] === 117 && B[w + 3] === 101) {
                header = true;
                p = w + 4;
              } else if (B[w] === 34) {
                const e = strEnd(w);
                if (e < 0) return null;
                header = JSON.parse(buf.utf8Slice(w, e + 1));
                p = e + 1;
              } else {
                // false, null or a number, read as JSON reads it
                let e = w;
                for (;;) {
                  const c = B[e];
                  if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46 || c === 69) e++;
                  else break;
                }
                if (e === w) return null;
                try {
                  header = JSON.parse(buf.latin1Slice(w, e));
                } catch {
                  return null;
                }
                p = e;
              }
            } else return null;
            const r = next(p, 125);
            if (r === -2) return null;
            if (r === -1) {
              p = ws(p) + 1;
              break;
            }
            p = r;
          }
          if (!sawText) return null;
          input = { t, n, header, sawHeader };
        } else return null;
        const r = next(p, 125);
        if (r === -2) return null;
        if (r === -1) {
          p = ws(p) + 1;
          break;
        }
        p = r;
      }
      if (input === null) return null;
      out.push(input);
      const r = next(p, 93);
      if (r === -2) return null;
      if (r === -1) {
        p = ws(p) + 1;
        break;
      }
      p = r;
    }
    return ws(p) === buf.length ? out : null;
  } finally {
    B = null;
  }
}

/**
 * The input of case c of cases(buf): {text, header}, and wide (the text was decoded from UTF-8, so its answer is
 * written as UTF-8). Throws when the slice is not a JSON string (a wrong guess of the text's end).
 */
function inputOf(buf, c) {
  B = buf;
  const wide = hasWideEscape(c.t, c.n);
  B = null;
  let text = JSON.parse(wide ? buf.utf8Slice(c.t, c.n + 1) : buf.latin1Slice(c.t, c.n + 1));
  // the leading U+FEFF, which run() drops: in the latin1 view, its UTF-8 bytes
  if (!wide && text.charCodeAt(0) === 0xef && text.charCodeAt(1) === 0xbb && text.charCodeAt(2) === 0xbf) text = text.slice(3);
  return { input: c.sawHeader ? { text, header: c.header } : { text }, wide };
}

// --- the answers' JSON ---

let O = null;
let oc = 0;

function grow(need) {
  if (O.length - oc >= need) return;
  const n = Buffer.allocUnsafe(Math.max(O.length * 2, oc + need + 65536));
  O.copy(n, 0, 0, oc);
  O = n;
}

const HEX = '0123456789abcdef';

// A string as JSON: one byte a char (the latin1 view; every char under 256), escaping what JSON must.
function strL(s) {
  const n = s.length;
  grow(6 * n + 2);
  const o = O;
  let k = oc;
  o[k++] = 34;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c >= 32 && c !== 34 && c !== 92) o[k++] = c;
    else k = esc(o, k, c);
  }
  o[k++] = 34;
  oc = k;
}

function esc(o, k, c) {
  o[k++] = 92;
  if (c === 34 || c === 92) o[k++] = c;
  else if (c === 10) o[k++] = 110;
  else if (c === 13) o[k++] = 114;
  else if (c === 9) o[k++] = 116;
  else if (c === 8) o[k++] = 98;
  else if (c === 12) o[k++] = 102;
  else {
    o[k++] = 117;
    o[k++] = HEX.charCodeAt((c >> 12) & 15);
    o[k++] = HEX.charCodeAt((c >> 8) & 15);
    o[k++] = HEX.charCodeAt((c >> 4) & 15);
    o[k++] = HEX.charCodeAt(c & 15);
  }
  return k;
}

// A string as JSON in UTF-8 (a text decoded from UTF-8): as JSON.stringify writes it, a lone surrogate escaped.
function strU(s) {
  const n = s.length;
  grow(6 * n + 2);
  const o = O;
  let k = oc;
  o[k++] = 34;
  for (let i = 0; i < n; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) {
      if (c >= 32 && c !== 34 && c !== 92) o[k++] = c;
      else k = esc(o, k, c);
    } else if (c < 0x800) {
      o[k++] = 0xc0 | (c >> 6);
      o[k++] = 0x80 | (c & 63);
    } else if (c >= 0xd800 && c <= 0xdfff) {
      const d = i + 1 < n ? s.charCodeAt(i + 1) : 0;
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        o[k++] = 0xf0 | (cp >> 18);
        o[k++] = 0x80 | ((cp >> 12) & 63);
        o[k++] = 0x80 | ((cp >> 6) & 63);
        o[k++] = 0x80 | (cp & 63);
        i++;
      } else k = esc(o, k, c);
    } else {
      o[k++] = 0xe0 | (c >> 12);
      o[k++] = 0x80 | ((c >> 6) & 63);
      o[k++] = 0x80 | (c & 63);
    }
  }
  o[k++] = 34;
  oc = k;
}

function num(v) {
  grow(24);
  if (v < 0) {
    O[oc++] = 45;
    v = -v;
  }
  const s = String(v);
  for (let i = 0; i < s.length; i++) O[oc++] = s.charCodeAt(i);
}

function lit(s) {
  grow(s.length);
  for (let i = 0; i < s.length; i++) O[oc++] = s.charCodeAt(i);
}

// What a char must be escaped as in JSON (under 256): 1 for controls, the quote and the backslash.
const ESC = new Uint8Array(256);
for (let c = 0; c < 32; c++) ESC[c] = 1;
ESC[34] = 1;
ESC[92] = 1;

// A row (an array of strings in the latin1 view) as a JSON array: one capacity check for the row (6 bytes a char
// at most), then each char copied as one byte unless JSON escapes it.
function rowL(a) {
  const n = a.length;
  let need = 2 + 3 * n;
  for (let f = 0; f < n; f++) need += 6 * a[f].length;
  grow(need);
  const o = O;
  let k = oc;
  o[k++] = 91;
  for (let f = 0; f < n; f++) {
    if (f > 0) o[k++] = 44;
    o[k++] = 34;
    const s = a[f];
    const m = s.length;
    for (let i = 0; i < m; i++) {
      const c = s.charCodeAt(i);
      if (ESC[c] === 0) o[k++] = c;
      else k = esc(o, k, c);
    }
    o[k++] = 34;
  }
  o[k++] = 93;
  oc = k;
}

function strs(a, wide) {
  if (!wide) {
    rowL(a);
    return;
  }
  grow(2);
  O[oc++] = 91;
  for (let i = 0; i < a.length; i++) {
    if (i > 0) {
      grow(1);
      O[oc++] = 44;
    }
    strU(a[i]);
  }
  grow(1);
  O[oc++] = 93;
}

function answer(a, wide) {
  lit('{"columns":');
  if (a.columns === null) lit('null');
  else strs(a.columns, wide);
  lit(',"rows":[');
  const rows = a.rows;
  for (let r = 0; r < rows.length; r++) {
    if (r > 0) {
      grow(1);
      O[oc++] = 44;
    }
    strs(rows[r], wide);
  }
  lit('],"errors":[');
  const errors = a.errors;
  for (let e = 0; e < errors.length; e++) {
    const x = errors[e];
    if (e > 0) lit(',');
    lit('{"code":"');
    lit(x.code);
    lit('","line":');
    num(x.line);
    lit(',"row":');
    if (x.row === null) lit('null');
    else num(x.row);
    if (x.fields !== undefined) {
      lit(',"fields":');
      num(x.fields);
    }
    if (x.extra !== undefined) {
      lit(',"extra":');
      strs(x.extra, wide);
    }
    lit('}');
  }
  lit(']}');
}

/** Starts the answers' bytes, sized for an input of `bytes` bytes. */
function begin(bytes) {
  O = Buffer.allocUnsafe(Math.floor(bytes * 1.25) + 65536);
  oc = 0;
  O[oc++] = 91;
}

/** Appends one case's answer (run's result; wide: its text was decoded from UTF-8). */
function add(a, wide, first) {
  if (!first) {
    grow(1);
    O[oc++] = 44;
  }
  answer(a, wide);
}

/** The answers' bytes. */
function end() {
  grow(1);
  O[oc++] = 93;
  const out = O.subarray(0, oc);
  O = null;
  return out;
}

/**
 * The bytes of answers.json for the bytes of cases.json, each case answered by run, or null to take the plain path.
 */
function answersWith(run, buf) {
  exact = false;
  const out = tryWith(run, buf);
  if (out !== null) return out;
  exact = true; // a text's end guessed wrongly (or another shape): split the file again, every end found exactly
  return tryWith(run, buf);
}

function tryWith(run, buf) {
  const cs = cases(buf);
  if (cs === null) return null;
  begin(buf.length);
  for (let i = 0; i < cs.length; i++) {
    let x;
    try {
      x = inputOf(buf, cs[i]);
    } catch {
      O = null;
      return null;
    }
    add(run(x.input), x.wide, i === 0);
  }
  return end();
}

module.exports = { answersWith };
