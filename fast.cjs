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

// Plain bytes, copied as they stand: every byte but the comma, the backslash and the raw quote (PLAIN), and inside a
// quoted field every byte but the backslash and the raw quote (QPLAIN). The loops copy runs of them 8 (or 4) bytes a
// step, unrolled by bench/unroll.cjs.
const PLAIN = new Uint8Array(256).fill(1);
PLAIN[44] = 0;
PLAIN[92] = 0;
PLAIN[34] = 0;
const QPLAIN = new Uint8Array(256).fill(1);
QPLAIN[92] = 0;
QPLAIN[34] = 0;
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

// The case's errors, kept as numbers until its header is known: code (an index of CODES), line, the ordinal of its
// record among the records read (the first is 0; its row follows from the header), and the short row's field count
// or the long row's index in EXTRAS. They are written as JSON when the case ends (writeErrors).
const CODES = [C_STRAY, C_JUNK, C_UNTERM, C_SHORT, C_LONG];
const STRAY = 0;
const JUNK = 1;
const UNTERM = 2;
const SHORT = 3;
const LONG = 4;
let ERRS = []; // 4 numbers an error
let EXTRAS = []; // a long row's cut fields, as their JSON bytes

function addErr(code) {
  ERRS.push(code, recLine, recRow, 0);
}

function writeErrors(header) {
  const errs = ERRS;
  for (let k = 0; k < errs.length; k += 4) {
    const code = errs[k];
    const rec = errs[k + 2];
    growE(96);
    if (ec > 0) E[ec++] = 44;
    putE(CODES[code]);
    putNumE(errs[k + 1]);
    putE(K_ROW);
    // the header record has no row; with a header every later record's row is one less than its ordinal
    if (header && rec === 0) putE(K_NULL);
    else putNumE(header ? rec - 1 : rec);
    if (code === SHORT) {
      putE(K_FIELDS);
      putNumE(errs[k + 3]);
    } else if (code === LONG) {
      const extra = EXTRAS[errs[k + 3]];
      growE(extra.length + 16);
      putE(K_EXTRA);
      putE(extra);
      E[ec++] = 93;
    }
    E[ec++] = 125;
  }
}

// Results of the two helpers below: the output cursor, how the field went on (-1 unquoted text follows, 0 comma,
// 1 line break, 2 end of text), and where junk after a closing quote began (-1: none to check).
let gO = 0;
let gEnd = 0;
let gJunk = -1;

// After a quoted field's scan, j past its closing quote (closed) or at the end of the text (not closed): returns
// where reading goes on.
function quotedEnd(closed, j, o, open, openLine, fstart) {
  const b = B;
  gJunk = -1;
  if (closed) {
    const c = b[j];
    gO = o;
    if (c === 34) {
      gEnd = 2;
      return j;
    }
    if (c === 44) {
      gEnd = 0;
      return j + 1;
    }
    if (c === 92 && b[j + 1] === 110) {
      line++;
      gEnd = 1;
      return j + 2;
    }
    if (c === 92 && b[j + 1] === 114 && b[j + 2] === 92 && b[j + 3] === 110) {
      line++;
      gEnd = 1;
      return j + 4;
    }
    // what follows the closing quote is appended as it stands (quote_junk, when the field ends)
    gEnd = -1;
    gJunk = o;
    return j;
  }
  // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
  o = fstart + 1;
  line = openLine;
  addErr(UNTERM);
  O[o++] = 92;
  O[o++] = 34;
  gO = o;
  gEnd = -1;
  return open + 2;
}

// An escape at i in unquoted text: LF or CRLF ends the record (gEnd 1), a CR not followed by LF is dropped
// (stray_cr), any other escape is copied as it stands. Returns where reading goes on.
function uEsc(i, o) {
  const b = B;
  const e = b[i + 1];
  gEnd = 0;
  gO = o;
  if (e === 110) {
    line++;
    gEnd = 1;
    return i + 2;
  }
  if (e === 114) {
    if (b[i + 2] === 92 && b[i + 3] === 110) {
      line++;
      gEnd = 1;
      return i + 4;
    }
    addErr(STRAY);
    return i + 2;
  }
  const out = O;
  out[o++] = 92;
  out[o++] = e;
  if (e === 117) {
    if (b[i + 2] === 48 && b[i + 3] === 48) checkEscape(i);
    out[o++] = b[i + 2];
    out[o++] = b[i + 3];
    out[o++] = b[i + 4];
    out[o++] = b[i + 5];
    gO = o;
    return i + 6;
  }
  gO = o;
  return i + 2;
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
        if (QPLAIN[c] === 1) {
          out[o++] = c;
          const c1 = b[j + 1];
          if (QPLAIN[c1] !== 1) {
            j += 1;
            continue;
          }
          out[o++] = c1;
          const c2 = b[j + 2];
          if (QPLAIN[c2] !== 1) {
            j += 2;
            continue;
          }
          out[o++] = c2;
          const c3 = b[j + 3];
          if (QPLAIN[c3] !== 1) {
            j += 3;
            continue;
          }
          out[o++] = c3;
          j += 4;
          continue;
        }
        if (c === 92) {
          const e = b[j + 1];
          const dbl = (e === 34) & (b[j + 2] === 92) & (b[j + 3] === 34);
          if (e === 34 && dbl === 0) {
            closed = true; // the closing quote
            j += 2;
            break;
          }
          // Every other escape takes one path, so the common "" pairs feed V8 for the rare CRs and LFs in quotes:
          // "" is one quote (\"), CR and CRLF are an LF (\n), LF stays, any other escape is copied as it stands.
          const nl = (e === 110) | (e === 114);
          const crlf = (e === 114) & (b[j + 2] === 92) & (b[j + 3] === 110);
          out[o++] = 92;
          out[o++] = nl === 1 ? 110 : e;
          line += nl;
          j += 2 + 2 * (dbl | crlf);
          if (e === 117) {
            // \uXXXX: its four hex digits follow
            if (b[j] === 48 && b[j + 1] === 48) checkEscape(j - 2);
            out[o++] = b[j];
            out[o++] = b[j + 1];
            out[o++] = b[j + 2];
            out[o++] = b[j + 3];
            j += 4;
          }
          continue;
        }
        break; // neither plain nor a backslash: the raw quote that ends the text (no compare to feed)
      }
      // What follows the field, in a function of its own (called after every quoted field, so its call is fed, and its
      // rare paths deopt only itself): a comma, a line break, the end, junk; or, the quote never closing, the reread.
      i = quotedEnd(closed, j, o, open, openLine, fstart);
      o = gO;
      end = gEnd;
      if (end >= 0) {
        out[o++] = 34;
        if (end === 0) continue;
        break;
      }
      junkFrom = gJunk;
    }

    // Unquoted text up to the next comma or line break; a CR not followed by LF is dropped (stray_cr).
    for (;;) {
      const c = b[i];
      if (PLAIN[c] === 1) {
        out[o++] = c;
        const c1 = b[i + 1];
        if (PLAIN[c1] !== 1) {
          i += 1;
          continue;
        }
        out[o++] = c1;
        const c2 = b[i + 2];
        if (PLAIN[c2] !== 1) {
          i += 2;
          continue;
        }
        out[o++] = c2;
        const c3 = b[i + 3];
        if (PLAIN[c3] !== 1) {
          i += 3;
          continue;
        }
        out[o++] = c3;
        const c4 = b[i + 4];
        if (PLAIN[c4] !== 1) {
          i += 4;
          continue;
        }
        out[o++] = c4;
        const c5 = b[i + 5];
        if (PLAIN[c5] !== 1) {
          i += 5;
          continue;
        }
        out[o++] = c5;
        const c6 = b[i + 6];
        if (PLAIN[c6] !== 1) {
          i += 6;
          continue;
        }
        out[o++] = c6;
        const c7 = b[i + 7];
        if (PLAIN[c7] !== 1) {
          i += 7;
          continue;
        }
        out[o++] = c7;
        i += 8;
        continue;
      }
      if (c === 44) {
        i++;
        end = 0;
        break;
      }
      if (c === 92) {
        // An escape, read by a function of its own: it is called at every record's end (an LF or CRLF), so its call
        // is fed, and its rare paths (a stray CR, other escapes) deopt only itself.
        i = uEsc(i, o);
        o = gO;
        if (gEnd === 1) {
          end = 1;
          break;
        }
        continue;
      }
      // neither plain, a comma nor a backslash: the raw quote that ends the text (no compare to feed)
      end = 2;
      break;
    }
    if (junkFrom >= 0 && o > junkFrom) addErr(JUNK);
    out[o++] = 34;
    if (end !== 0) break;
  }
  oc = o;
  gCount = count;
  gCut = cut;
  gEmpty = count === 1 && !quoted && o === fstart + 2;
  return i;
}

// One case's text, its opening quote at t: reads its records into O as the rows of {"rows":[ (the first record kept
// aside, since whether it is the header is told only by the "header" key, which may follow the text), keeps its
// errors as numbers, and returns where the reading stopped: the first raw quote after t, the text's end.
let FIRST = null; // the first record's fields JSON, or null
let rowsAt = 0; // where the rows begin in O
let rowCount = 0; // rows written to O (the records after the first)
function readCase(t) {
  const b = B;
  let p = t + 1;
  if (b[p] === 0xef && b[p + 1] === 0xbb && b[p + 2] === 0xbf) p += 3;
  else if (b[p] === 92 && b[p + 1] === 117 && (b[p + 2] | 32) === 102 && (b[p + 3] | 32) === 101 && (b[p + 4] | 32) === 102 && (b[p + 5] | 32) === 102) p += 6;
  line = 1;
  ERRS = [];
  EXTRAS = [];
  FIRST = null;
  let width = -1;
  let rows = 0;
  let records = 0; // records read so far, the first included
  // The rows take at most 4 bytes a byte of text (a field of n bytes is at most n + 3 bytes of JSON): room for all the
  // texts left; short rows' padding and the errors get room of their own.
  growO(K_ROWS.length + 4 * (B.length - p) + 64);
  O.set(K_ROWS, oc);
  oc += K_ROWS.length;
  rowsAt = oc;
  for (;;) {
    // Blank lines (LF, CRLF) are no records. The arithmetic runs at every record, blank line or not, so V8 has
    // feedback for it however late the first blank line comes.
    for (;;) {
      const bs = b[p] === 92;
      const lf = bs & (b[p + 1] === 110);
      const crlf = bs & (b[p + 1] === 114) & (b[p + 2] === 92) & (b[p + 3] === 110);
      line += lf | crlf;
      p += 2 * lf + 4 * crlf;
      if ((lf | crlf) === 0) break;
    }
    if (b[p] === 34) break; // the raw quote that ends the JSON string: the end of the text
    recLine = line;
    recRow = records;
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
    records++;
    if (width < 0) {
      // The first record: the header, or the first row (writeCase decides). Its width is the width.
      width = count;
      FIRST = Buffer.from(O.subarray(body, oc));
      oc = rowStart;
      continue;
    }
    if (count < width) {
      ERRS.push(SHORT, recLine, recRow, count);
      growO(3 * (width - count) + 64);
      const o = O;
      for (let k = count; k < width; k++) {
        o[oc++] = 44;
        o[oc++] = 34;
        o[oc++] = 34;
      }
    } else if (count > width) {
      ERRS.push(LONG, recLine, recRow, EXTRAS.length);
      EXTRAS.push(Buffer.from(O.subarray(gCut + 1, oc)));
      oc = gCut;
    }
    O[oc++] = 93;
    rows++;
  }
  rowCount = rows;
  return p;
}

// Ends the case readCase read, its header now known: the first record as the columns, or as the first row (the rows
// moved up to make room), then the errors and the columns.
function writeCase(header) {
  if (!header && FIRST !== null) {
    const room = FIRST.length + 2 + (rowCount > 0 ? 1 : 0);
    growO(room);
    O.copyWithin(rowsAt + room, rowsAt, oc);
    let o = rowsAt;
    O[o++] = 91;
    O.set(FIRST, o);
    o += FIRST.length;
    O[o++] = 93;
    if (rowCount > 0) O[o++] = 44;
    oc += room;
  }
  ec = 0;
  writeErrors(header);
  growO(ec + (FIRST === null ? 0 : FIRST.length) + 64);
  O.set(K_ERRORS, oc);
  oc += K_ERRORS.length;
  O.set(E.subarray(0, ec), oc);
  oc += ec;
  O.set(K_COLUMNS, oc);
  oc += K_COLUMNS.length;
  if (!header) {
    O.set(K_NULL, oc);
    oc += 4;
  } else if (FIRST === null) {
    O[oc++] = 91;
    O[oc++] = 93;
  } else {
    O[oc++] = 91;
    O.set(FIRST, oc);
    oc += FIRST.length;
    O[oc++] = 93;
  }
  O[oc++] = 125;
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

function keyIs(p, q, s) {
  if (q - p - 1 !== s.length) return false;
  for (let k = 0; k < s.length; k++) if (B[p + 1 + k] !== s.charCodeAt(k)) return false;
  return true;
}

// A \u00XX escape in a text at j, met by the reader as an escape: when it spells a comma, a quote, a CR or an LF
// (\u002c, \u0022, \u000d, \u000a), a CSV character this reader does not read as one, the pass gives up and
// the plain path answers. JSON.stringify never writes these.
let structural = false;
function checkEscape(j) {
  const h = B[j + 4];
  const l = B[j + 5] | 32;
  if ((h === 50 && (l === 50 || l === 99)) || (h === 48 && (l === 97 || l === 100))) structural = true;
}

// After a value at p: the position past a comma (next pair) as a positive number, -1 at the closing brace, else -2.
function next(p, close) {
  p = ws(p);
  if (B[p] === 44) return ws(p + 1);
  if (B[p] === close) return -1;
  return -2;
}

/** The bytes of answers.json for the bytes of cases.json, or null to take the plain path. */
function answers(buf) {
  B = buf;
  try {
    structural = false;
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
                // the text is read where it stands; the reading stops at its closing quote
                if (cases > 0) {
                  growO(1);
                  O[oc++] = 44;
                }
                t = w;
                p = readCase(w) + 1;
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
        if (structural) return null;
        writeCase(header);
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

module.exports = { answers };
