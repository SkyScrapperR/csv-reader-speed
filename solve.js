// A fast reader with csv-reader 1.0.0's broken-row policy: run({text, header}) -> {columns, rows, errors}.
// One pass over the text by char code, fields taken as slices of the text, no per-character string building.
// The work is split into a per-record function so V8 optimizes it by ordinary calls, not by on-stack replacement.

// Reader state for the record being read (set by run, read and advanced by readRecord).
let gPos = 0;
let gLine = 1;
let gQuoted = false;
let gErrors = null;

function err(code, line, row) {
  return { code, line, row };
}

// Reads one record whose first character is at gPos (not a line break); returns its fields and advances gPos/gLine.
function readRecord(text, n, recLine, recRow) {
  const errors = gErrors;
  let pos = gPos;
  let line = gLine;
  const fields = [];
  let quoted = false;
  for (;;) {
    let value = '';
    let start = pos;
    let junkFrom = -1; // value length before junk; -1 when not after a closing quote
    quoted = pos < n && text.charCodeAt(pos) === 34;
    if (quoted) {
      const open = pos;
      const openLine = line;
      let i = pos + 1;
      let seg = i;
      let closed = false;
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c > 34) {
          i++;
        } else if (c === 34) {
          if (i + 1 < n && text.charCodeAt(i + 1) === 34) {
            value += text.slice(seg, i + 1);
            i += 2;
            seg = i;
          } else {
            closed = true;
            break;
          }
        } else if (c === 13) {
          value += text.slice(seg, i) + '\n';
          line++;
          i += i + 1 < n && text.charCodeAt(i + 1) === 10 ? 2 : 1;
          seg = i;
        } else {
          if (c === 10) line++;
          i++;
        }
      }
      if (closed) {
        value = value === '' ? text.slice(seg, i) : value + text.slice(seg, i);
        pos = i + 1;
        if (pos >= n) {
          fields.push(value);
          break;
        }
        const c = text.charCodeAt(pos);
        if (c === 44) {
          pos++;
          fields.push(value);
          continue;
        }
        if (c === 10) {
          pos++;
          line++;
          fields.push(value);
          break;
        }
        if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          pos += 2;
          line++;
          fields.push(value);
          break;
        }
        junkFrom = value.length;
        start = pos;
      } else {
        pos = open + 1;
        line = openLine;
        errors.push(err('unterminated_quote', recLine, recRow));
        value = '"';
        start = pos;
      }
    }

    // Unquoted text up to the next comma or line break; a CR not followed by LF is dropped (stray_cr).
    let i = start;
    let ended = 2; // 0 comma, 1 LF, 3 CRLF, 2 end of text
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c > 44) {
        i++;
      } else if (c === 44) {
        ended = 0;
        break;
      } else if (c === 10) {
        ended = 1;
        break;
      } else if (c === 13) {
        if (i + 1 < n && text.charCodeAt(i + 1) === 10) {
          ended = 3;
          break;
        }
        errors.push(err('stray_cr', recLine, recRow));
        value += text.slice(start, i);
        i++;
        start = i;
      } else {
        i++;
      }
    }
    value = value === '' ? text.slice(start, i) : value + text.slice(start, i);
    if (junkFrom >= 0 && value.length > junkFrom) errors.push(err('quote_junk', recLine, recRow));
    fields.push(value);
    if (ended === 0) {
      pos = i + 1;
      continue;
    }
    if (ended === 1) {
      pos = i + 1;
      line++;
    } else if (ended === 3) {
      pos = i + 2;
      line++;
    } else {
      pos = i;
    }
    break;
  }
  gPos = pos;
  gLine = line;
  gQuoted = quoted;
  return fields;
}

export function run(input) {
  const t = input.text;
  const text = typeof t === 'string' ? t : String(t);
  const header = input.header === true;
  const n = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let wantHeader = header;
  let pos = n > 0 && text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  gErrors = errors;

  for (;;) {
    // Blank lines (LF, CRLF) are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos++;
        line++;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line++;
      } else break;
    }
    if (pos >= n) break;

    const recLine = line;
    const recRow = wantHeader ? null : rows.length;
    gPos = pos;
    gLine = line;
    const fields = readRecord(text, n, recLine, recRow);
    pos = gPos;
    line = gLine;

    const count = fields.length;
    // A line that held only stray CRs is no record (its stray_cr errors stay).
    if (count === 1 && !gQuoted && fields[0] === '') continue;
    if (width < 0) width = count;
    if (wantHeader) {
      columns = fields;
      wantHeader = false;
      continue;
    }
    if (count < width) {
      errors.push({ code: 'short_row', line: recLine, row: recRow, fields: count });
      for (let k = count; k < width; k++) fields.push('');
    } else if (count > width) {
      errors.push({ code: 'long_row', line: recLine, row: recRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  gErrors = null;
  return { columns: header ? (columns === null ? [] : columns) : null, rows, errors };
}

/** The plain path for the bytes of a whole cases.json: JSON.parse, run on each case, JSON.stringify (main.ts takes it
 * when fast.js does not take the file). */
export function answerPlain(buf) {
  const cases = JSON.parse(buf.toString('utf8'));
  const out = [];
  for (let i = 0; i < cases.length; i++) out.push(run(cases[i].input));
  return Buffer.from(JSON.stringify(out), 'utf8');
}
