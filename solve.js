// A fast reader with csv-reader 1.0.0's broken-row policy: run({text, header}) -> {columns, rows, errors}.
// One pass over the text by char code, fields taken as slices of the text, no per-character string building.
// The work is split into a per-record function so V8 optimizes it by ordinary calls, not by on-stack replacement.

// Reader state for the record being read (set by run, read and advanced by readRecord and readQuoted).
let gPos = 0;
let gLine = 1;
let gQuoted = false;
let gErrors = null;
let gRecLine = 1;
let gRecRow = null;
// readQuoted's results: the field's value, how it went on (0 comma, 1 line break, 2 end of text, -1 unquoted text
// follows: junk after the closing quote, or the reread after a quote that never closes), and for junk the value's
// length before it (-1: no junk to check).
let gValue = '';
let gEnd = 0;
let gJunkFrom = -1;

function err(code, line, row) {
  return { code, line, row };
}

// A quoted field whose opening quote is at pos: its own function, called for every quoted field, so its rare paths
// (a CR inside the quotes, a quote that never closes) deopt only itself. Returns where reading goes on.
function readQuoted(text, n, pos) {
  const open = pos;
  const openLine = gLine;
  let line = gLine;
  let value = '';
  let i = pos + 1;
  let seg = i;
  for (;;) {
    const c = text.charCodeAt(i);
    if (c > 34) {
      i++;
      continue;
    }
    if (c === 34) {
      if (text.charCodeAt(i + 1) === 34) {
        // "" is one quote
        value += text.slice(seg, i + 1);
        i += 2;
        seg = i;
        continue;
      }
      break; // the closing quote
    }
    if (c === 13) {
      // CRLF and a lone CR inside quotes are each one LF
      value += text.slice(seg, i) + '\n';
      line++;
      i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
      seg = i;
      continue;
    }
    if (c === 10) line++;
    else if (i >= n) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      gLine = openLine;
      gErrors.push(err('unterminated_quote', gRecLine, gRecRow));
      gValue = '"';
      gEnd = -1;
      gJunkFrom = -1;
      return open + 1;
    }
    i++;
  }
  value = value === '' ? text.slice(seg, i) : value + text.slice(seg, i);
  gValue = value;
  gJunkFrom = -1;
  pos = i + 1;
  const c = text.charCodeAt(pos);
  if (c === 44) {
    gEnd = 0;
    pos++;
  } else if (c === 10) {
    gEnd = 1;
    pos++;
    line++;
  } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
    gEnd = 1;
    pos += 2;
    line++;
  } else if (pos >= n) {
    gEnd = 2;
  } else {
    // what follows the closing quote is appended as it stands (quote_junk, when the field ends)
    gEnd = -1;
    gJunkFrom = value.length;
  }
  gLine = line;
  return pos;
}

// Reads one record whose first character is at gPos (not a line break); returns its fields and advances gPos/gLine.
function readRecord(text, n, recLine, recRow) {
  const errors = gErrors;
  let pos = gPos;
  const fields = [];
  let quoted = false;
  gRecLine = recLine;
  gRecRow = recRow;
  for (;;) {
    let value = '';
    let junkFrom = -1;
    quoted = text.charCodeAt(pos) === 34;
    if (quoted) {
      pos = readQuoted(text, n, pos);
      const end = gEnd;
      if (end >= 0) {
        fields.push(gValue);
        if (end === 0) continue;
        break;
      }
      value = gValue;
      junkFrom = gJunkFrom;
    }

    // Unquoted text up to the next comma or line break; a CR not followed by LF is dropped (stray_cr). One compare
    // a char on the common path: past the end charCodeAt is NaN, which only the last test (i >= n) takes.
    let start = pos;
    let i = pos;
    let ended = 2; // 0 comma, 1 LF, 3 CRLF, 2 end of text
    for (;;) {
      const c = text.charCodeAt(i);
      if (c > 44) {
        i++;
        continue;
      }
      if (c === 44) {
        ended = 0;
        break;
      }
      if (c === 10) {
        ended = 1;
        break;
      }
      if (c === 13) {
        if (text.charCodeAt(i + 1) === 10) {
          ended = 3;
          break;
        }
        errors.push(err('stray_cr', recLine, recRow));
        value += text.slice(start, i);
        i++;
        start = i;
        continue;
      }
      if (i >= n) break;
      i++;
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
      gLine++;
    } else if (ended === 3) {
      pos = i + 2;
      gLine++;
    } else {
      pos = i;
    }
    break;
  }
  gPos = pos;
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
