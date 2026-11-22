// A fast reader with csv-reader 1.0.0's broken-row policy: run({text, header}) -> {columns, rows, errors}.
// One pass over the text by char code, fields taken as slices of the text, no per-character string building.

function err(code, line, row) {
  return { code, line, row };
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
    const fields = [];
    let quoted = false;
    let more = true;

    while (more) {
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
            more = false;
            continue;
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
            more = false;
            continue;
          }
          if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line++;
            fields.push(value);
            more = false;
            continue;
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
      let ended = 2; // 0 comma, 1 line break, 2 end of text
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
      if (ended === 0) {
        pos = i + 1;
      } else if (ended === 1) {
        pos = i + 1;
        line++;
        more = false;
      } else if (ended === 3) {
        pos = i + 2;
        line++;
        more = false;
      } else {
        pos = i;
        more = false;
      }
      if (junkFrom >= 0 && value.length > junkFrom) errors.push(err('quote_junk', recLine, recRow));
      fields.push(value);
    }

    const count = fields.length;
    // A line that held only stray CRs is no record (its stray_cr errors stay).
    if (count === 1 && !quoted && fields[0] === '') continue;
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
  return { columns: header ? (columns === null ? [] : columns) : null, rows, errors };
}
