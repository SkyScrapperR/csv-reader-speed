// The byte pipeline main.ts uses: answers(buf) reads the bytes of /input/cases.json and returns the bytes of
// /output/answers.json, reading every case's CSV straight from its JSON-escaped text and writing each answer
// as JSON, with no JS string per field and no object tree. It reads by csv-reader 1.0.0's policy (as solve.js's
// run does) and gives the same answers as a JSON value. Input it does not expect (a JSON shape other than
// [{"id", "input": {"text": "...", "header": ...}}], or a \u escape of a comma, quote, CR or LF in a text)
// returns null, and main.ts then takes the plain path: JSON.parse, run, JSON.stringify.
//
// In the JSON bytes a text's CSV characters are: "," itself, \" (a quote), \n (LF), \r (CR); the text ends at the
// first raw '"' byte, which no JSON string holds inside it. Every other byte or escape is copied as it stands, so
// a field's JSON is its own escaped bytes from the input, a field cut only at those ASCII tokens.

let B = null; // input bytes
let O = null; // output bytes
let oc = 0; // output cursor
let E = null; // the current case's errors JSON
let ec = 0;
let line = 1; // line of the next character
let recLine = 1; // the record being read: its line and its row (-1: the header)
let recRow = -1;
let gCount = 0; // readRecord's results: field count, where field #width began, the last field empty and unquoted
let gCut = -1;
let gEmpty = false;

const enc = (s) => Buffer.from(s, 'latin1');
const C_STRAY = enc('{"code":"stray_cr","line":');
const C_JUNK = enc('{"code":"quote_junk","line":');
const C_UNTERM = enc('{"code":"unterminated_quote","line":');
const C_SHORT = enc('{"code":"short_row","line":');
const C_LONG = enc('{"code":"long_row","line":');
const K_ROW = enc(',"row":');
const K_NULL = enc('null');
const K_FIELDS = enc(',"fields":');
const K_EXTRA = enc(',"extra":[');
const K_ROWS = enc('{"rows":[');
const K_ERRORS = enc('],"errors":[');
const K_COLUMNS = enc('],"columns":');

function growO(need) {
  if (O.length - oc >= need) return;
  const n = Buffer.allocUnsafe(Math.max(O.length * 2, oc + need + 1024));
  O.copy(n, 0, 0, oc);
  O = n;
}

function growE(need) {
  if (E.length - ec >= need) return;
  const n = Buffer.allocUnsafe(Math.max(E.length * 2, ec + need + 1024));
  E.copy(n, 0, 0, ec);
  E = n;
}

function putE(bytes) {
  E.set(bytes, ec);
  ec += bytes.length;
}

function putNumE(v) {
  if (v >= 10) putNumE((v / 10) | 0);
  E[ec++] = 48 + (v % 10);
}

// An error's head: {"code":...,"line":L,"row":R (the caller closes it).
function errHead(code) {
  growE(96);
  if (ec > 0) E[ec++] = 44;
  putE(code);
  putNumE(recLine);
  putE(K_ROW);
  if (recRow < 0) putE(K_NULL);
  else putNumE(recRow);
}

function addErr(code) {
  errHead(code);
  E[ec++] = 125;
}

// Reads one record from p (not at a blank line nor the end) into O as "f1","f2",..., returns the next position.
function readRecord(p, width) {
  const b = B;
  const out = O;
  let i = p;
  let o = oc;
  let count = 0;
  let cut = -1;
  let quoted = false;
  let fstart = o;
  for (;;) {
    if (count === width) cut = o;
    if (count > 0) out[o++] = 44;
    fstart = o;
    out[o++] = 34;
    count++;
    let end = 0; // 0 comma, 1 line break, 2 end of text
    let junkFrom = -1;
    quoted = b[i] === 92 && b[i + 1] === 34;
    if (quoted) {
      const open = i;
      const openLine = line;
      let j = i + 2;
      let closed = false;
      for (;;) {
        const c = b[j];
        if (c > 92) {
          // lowercase letters and UTF-8 bytes: the common case first
          out[o++] = c;
          j++;
          continue;
        }
        if (c === 92) {
          const e = b[j + 1];
          if (e === 34) {
            if (b[j + 2] === 92 && b[j + 3] === 34) {
              out[o++] = 92;
              out[o++] = 34;
              j += 4;
              continue;
            }
            closed = true;
            j += 2;
            break;
          }
          if (e === 114) {
            out[o++] = 92;
            out[o++] = 110;
            line++;
            j += b[j + 2] === 92 && b[j + 3] === 110 ? 4 : 2;
            continue;
          }
          if (e === 110) line++;
          else if (e === 117) {
            out[o++] = 92;
            out[o++] = 117;
            out[o++] = b[j + 2];
            out[o++] = b[j + 3];
            out[o++] = b[j + 4];
            out[o++] = b[j + 5];
            j += 6;
            continue;
          }
          out[o++] = 92;
          out[o++] = e;
          j += 2;
          continue;
        }
        if (c === 34) break;
        out[o++] = c;
        j++;
      }
      if (closed) {
        const c = b[j];
        if (c === 34) {
          i = j;
          end = 2;
        } else if (c === 44) {
          i = j + 1;
        } else if (c === 92 && b[j + 1] === 110) {
          i = j + 2;
          line++;
          end = 1;
        } else if (c === 92 && b[j + 1] === 114 && b[j + 2] === 92 && b[j + 3] === 110) {
          i = j + 4;
          line++;
          end = 1;
        } else {
          i = j;
          end = -1;
          junkFrom = o;
        }
        if (end >= 0) {
          out[o++] = 34;
          if (end === 0) continue;
          break;
        }
      } else {
        // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
        o = fstart + 1;
        line = openLine;
        addErr(C_UNTERM);
        out[o++] = 92;
        out[o++] = 34;
        i = open + 2;
      }
    }

    // Unquoted text up to the next comma or line break; a CR not followed by LF is dropped (stray_cr).
    for (;;) {
      const c = b[i];
      if (c > 92) {
        out[o++] = c;
        i++;
        continue;
      }
      if (c === 44) {
        i++;
        end = 0;
        break;
      }
      if (c === 92) {
        const e = b[i + 1];
        if (e === 110) {
          i += 2;
          line++;
          end = 1;
          break;
        }
        if (e === 114) {
          if (b[i + 2] === 92 && b[i + 3] === 110) {
            i += 4;
            line++;
            end = 1;
            break;
          }
          addErr(C_STRAY);
          i += 2;
          continue;
        }
        if (e === 117) {
          out[o++] = 92;
          out[o++] = 117;
          out[o++] = b[i + 2];
          out[o++] = b[i + 3];
          out[o++] = b[i + 4];
          out[o++] = b[i + 5];
          i += 6;
          continue;
        }
        out[o++] = 92;
        out[o++] = e;
        i += 2;
        continue;
      }
      if (c === 34) {
        end = 2;
        break;
      }
      out[o++] = c;
      i++;
    }
    if (junkFrom >= 0 && o > junkFrom) addErr(C_JUNK);
    out[o++] = 34;
    if (end !== 0) break;
  }
  oc = o;
  gCount = count;
  gCut = cut;
  gEmpty = count === 1 && !quoted && o === fstart + 2;
  return i;
}

// One case's text, its opening quote at t and its closing quote at n: writes the answer's JSON into O and returns
// where its reading stopped, the first raw quote after t (n, unless n was found wrongly).
function readCase(t, n, header) {
  const b = B;
  let p = t + 1;
  if (b[p] === 0xef && b[p + 1] === 0xbb && b[p + 2] === 0xbf) p += 3;
  else if (b[p] === 92 && b[p + 1] === 117 && (b[p + 2] | 32) === 102 && (b[p + 3] | 32) === 101 && (b[p + 4] | 32) === 102 && (b[p + 5] | 32) === 102) p += 6;
  ec = 0;
  line = 1;
  let width = -1;
  let wantHeader = header;
  let columns = null;
  let rows = 0;
  growO(K_ROWS.length + 4 * (n - p) + 64);
  O.set(K_ROWS, oc);
  oc += K_ROWS.length;
  for (;;) {
    // Blank lines (LF, CRLF) are no records.
    while (b[p] === 92) {
      if (b[p + 1] === 110) {
        p += 2;
        line++;
      } else if (b[p + 1] === 114 && b[p + 2] === 92 && b[p + 3] === 110) {
        p += 4;
        line++;
      } else break;
    }
    if (b[p] === 34) break; // the raw quote that ends the JSON string: the end of the text
    recLine = line;
    recRow = wantHeader ? -1 : rows;
    const rowStart = oc;
    if (rows > 0) O[oc++] = 44;
    O[oc++] = 91;
    const body = oc;
    p = readRecord(p, width);
    const count = gCount;
    // A line that held only stray CRs is no record (its stray_cr errors stay).
    if (gEmpty) {
      oc = rowStart;
      continue;
    }
    if (width < 0) width = count;
    if (wantHeader) {
      columns = Buffer.from(O.subarray(body, oc));
      oc = rowStart;
      wantHeader = false;
      continue;
    }
    if (count < width) {
      errHead(C_SHORT);
      putE(K_FIELDS);
      putNumE(count);
      E[ec++] = 125;
      growO(3 * (width - count) + 64);
      const o = O;
      for (let k = count; k < width; k++) {
        o[oc++] = 44;
        o[oc++] = 34;
        o[oc++] = 34;
      }
    } else if (count > width) {
      const extra = O.subarray(gCut + 1, oc);
      errHead(C_LONG);
      growE(extra.length + 8);
      putE(K_EXTRA);
      putE(extra);
      E[ec++] = 93;
      E[ec++] = 125;
      oc = gCut;
    }
    O[oc++] = 93;
    rows++;
  }
  growO(ec + (columns === null ? 0 : columns.length) + 64);
  O.set(K_ERRORS, oc);
  oc += K_ERRORS.length;
  O.set(E.subarray(0, ec), oc);
  oc += ec;
  O.set(K_COLUMNS, oc);
  oc += K_COLUMNS.length;
  if (!header) {
    O.set(K_NULL, oc);
    oc += 4;
  } else if (columns === null) {
    O[oc++] = 91;
    O[oc++] = 93;
  } else {
    O[oc++] = 91;
    O.set(columns, oc);
    oc += columns.length;
    O[oc++] = 93;
  }
  O[oc++] = 125;
  return p;
}

// --- the JSON around the texts ---

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

// The closing quote of the text whose opening quote is at p. Inside a JSON string a quote is always \", so the
// bytes `","header":` (a raw quote, a comma, a raw quote) cannot occur in it: their first occurrence after p ends
// the text when the header key follows it, as JSON.stringify writes {text, header}. Otherwise strEnd. readCase
// checks the result (it stops at the first raw quote).
const HEADER_AFTER = Buffer.from('","header":', 'latin1');
let exactEnds = false; // true on the second pass, after textEnd guessed a text's end wrongly
let missedEnd = false;
function textEnd(p) {
  if (exactEnds) return strEnd(p);
  const m = B.indexOf(HEADER_AFTER, p + 1);
  return m > p ? m : strEnd(p);
}

function keyIs(p, q, s) {
  if (q - p - 1 !== s.length) return false;
  for (let k = 0; k < s.length; k++) if (B[p + 1 + k] !== s.charCodeAt(k)) return false;
  return true;
}

const U00 = Buffer.from([92, 117, 48, 48]); // the bytes of a \u00 escape

// True when a \u00XX escape in the file spells a comma, a quote, a CR or an LF (\u002c, \u0022, \u000d, \u000a), a
// CSV character this reader would not see as one. JSON.stringify never writes these.
function hasStructuralEscape() {
  const b = B;
  let j = 0;
  for (;;) {
    j = b.indexOf(U00, j);
    if (j < 0) return false;
    const h = b[j + 4];
    const l = b[j + 5] | 32;
    if ((h === 50 && (l === 50 || l === 99)) || (h === 48 && (l === 97 || l === 100))) {
      // an escape only when the run of backslashes ending at j is odd (\\u0022 is a backslash, then u0022)
      let k = j - 1;
      while (k >= 0 && b[k] === 92) k--;
      if (((j - k) & 1) === 1) return true;
    }
    j += 4;
  }
}

// After a value at p: the position past a comma (next pair) as a positive number, -1 at the closing brace, else -2.
function next(p, close) {
  p = ws(p);
  if (B[p] === 44) return ws(p + 1);
  if (B[p] === close) return -1;
  return -2;
}

/** The bytes of answers.json for the bytes of cases.json, or null to take the plain path. */
export function answers(buf) {
  exactEnds = false;
  missedEnd = false;
  const out = pass(buf);
  if (out !== null || !missedEnd) return out;
  exactEnds = true; // a case with no header key after its text: read the file again, every string end found exactly
  return pass(buf);
}

function pass(buf) {
  B = buf;
  try {
    if (hasStructuralEscape()) return null;
    O = Buffer.allocUnsafe(4 * buf.length + 4096);
    E = Buffer.allocUnsafe(65536);
    oc = 0;
    let p = ws(0);
    if (B[p] !== 91) return null;
    O[oc++] = 91;
    p = ws(p + 1);
    let cases = 0;
    if (B[p] === 93) p++;
    else {
      for (;;) {
        // {"id": "...", "input": {"text": "...", "header": true|false}} with its keys in any order
        if (B[p] !== 123) return null;
        p = ws(p + 1);
        let sawId = false;
        let t = -1;
        let n = -1;
        let header = false;
        let sawInput = false;
        let sawHeader = false;
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
          } else if (keyIs(p, q, 'input') && !sawInput) {
            sawInput = true;
            if (B[v] !== 123) return null;
            p = ws(v + 1);
            for (;;) {
              if (B[p] !== 34) return null;
              const kq = strEnd(p);
              if (kq < 0) return null;
              let w = ws(kq + 1);
              if (B[w] !== 58) return null;
              w = ws(w + 1);
              if (keyIs(p, kq, 'text') && t < 0) {
                if (B[w] !== 34) return null;
                t = w;
                n = textEnd(w);
                if (n < 0) return null;
                p = n + 1;
              } else if (keyIs(p, kq, 'header') && !sawHeader) {
                sawHeader = true;
                // header === true: only the literal true; any other primitive (false, null, a number, a string) is false.
                if (B[w] === 116 && B[w + 1] === 114 && B[w + 2] === 117 && B[w + 3] === 101) {
                  header = true;
                  p = w + 4;
                } else if (B[w] === 34) {
                  p = strEnd(w);
                  if (p < 0) return null;
                  p++;
                } else {
                  p = w;
                  for (;;) {
                    const c = B[p];
                    // the letters of false and null, and the characters of a number
                    if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46 || c === 69) p++;
                    else break;
                  }
                  if (p === w) return null;
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
            if (t < 0) return null;
          } else return null;
          const r = next(p, 125);
          if (r === -2) return null;
          if (r === -1) {
            p = ws(p) + 1;
            break;
          }
          p = r;
        }
        if (!sawInput) return null;
        if (cases > 0) {
          growO(1);
          O[oc++] = 44;
        }
        // The reading must stop at the text's own closing quote, else textEnd guessed wrong: take the plain path.
        if (readCase(t, n, header) !== n) {
          missedEnd = true;
          return null;
        }
        cases++;
        const r = next(p, 93);
        if (r === -2) return null;
        if (r === -1) {
          p = ws(p) + 1;
          break;
        }
        p = r;
      }
    }
    if (ws(p) !== buf.length) return null;
    growO(1);
    O[oc++] = 93;
    return O.subarray(0, oc);
  } finally {
    B = null;
    E = null;
  }
}

