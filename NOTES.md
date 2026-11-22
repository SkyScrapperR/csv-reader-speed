# NOTES: csv-reader-speed-01-run-20261121

## Phase 0: what the kit says (verified against the kit files and the harness source)

### Harness protocol
- The grader runs `node /bot/main.ts` (Node 22, `node:22-slim`; the grader uses 22.23.4, which strips TS types natively).
  **main.ts** is the whole program. The harness never imports solve.js. main.ts reads `/input/cases.json`, calls
  `run(input)` from solve.js for each case and writes `/output/answers.json`.
  Outside a container `MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` stand in for the two directories.
- `/input/cases.json` is `JSON.stringify([{id, input: {text, header}}, ...])`. That is 6 cases, each 1.4 to 2.0 M chars
  of CSV (about 11 MB of JSON in all). `/output/answers.json` is a JSON array with one `{columns, rows, errors}` per
  case, in order. The scorer compares canonical JSON (keys sorted), so key order does not matter. Each run's
  output must still be byte-identical across executions, because every entry runs twice.
- The rules text says main.ts "answers each with run", so I keep that contract: JSON.parse, then run(), then
  JSON.stringify. I won't use a byte-level shortcut that skips run().

### What is timed
- CPU time (user+sys) of the **whole container**, read from the cgroup's `cpu.stat usage_usec`
  (grader/sandbox/docker.ts). Every thread counts: V8 GC, compiler threads and node startup.
  The median of a do-nothing "null entry" (same runtime) is subtracted.
- So node startup, the TS type-strip (amaro), module load, readFileSync, JSON.parse, run(), JSON.stringify and
  writeFileSync are **all inside the measurement**. Only the null program's own cost is taken off.
- Dev board: 3 timed runs, each net of the null median, then the median of the 3. The clock tick can be 10 ms,
  which explains the 0 / 10,000 / 20,000 us buckets on the board.
- Final: staged. Entries are first ranked by their qualifying time from grading (up to 30 contenders). The heat is
  1 warm-up round plus 9 timed rounds. The trimmed mean drops 2 runs at each end. The paid places + 2 then run 30
  playoff rounds. A later entry passes an earlier one only at 95% one-sided confidence. A reward needs to beat
  the baseline at 95%.
- Limits: 1 CPU, 1024 MB, 10 s wall, 64 pids. Final set = drand round 34199652, 6 cases.

### Reference csv-reader 1.0.0 (vendor/csv-reader/index.js): every edge case it handles
1. `text = String(input.text)`, `header = input.header === true` (strict).
2. If `text[0]` is U+FEFF, start at index 1. Only the first character is checked.
3. Record start: skip LF and CRLF (each counts a line). A lone CR is NOT skipped here.
4. Unquoted field: ends at `,` (record continues), at LF or CRLF (line++, record ends) or at EOF.
   A CR not followed by LF is dropped. It logs `stray_cr` right away (at the current record's line/row) and does
   **not** count a line.
5. Quoted field (the first char of the field is `"`): `""` becomes `"`. CR and CRLF become LF. LF stays LF.
   Each one counts one line. At the closing quote:
   - EOF -> the field ends and the record ends;
   - `,` / LF / CRLF -> ends as usual;
   - anything else (a lone CR included) -> the rest is read as unquoted text appended to the value (stray CRs
     inside it log `stray_cr` first). `quote_junk` is logged after that, when the field ends, **only if at least
     one char was kept**. So `"a"\r,` gives stray_cr but no quote_junk.
6. A quote that never closes: rewind to just after it, reset line to the opening line, log `unterminated_quote`,
   then read the rest as an unquoted field whose value starts with `"`. Later fields that start with `"` are tried
   as quoted again. (The reference is O(n^2) on many unclosed quotes. The generator puts only one, near the end.)
7. A quote inside an unquoted field is literal. Nothing is trimmed or converted.
8. A record of exactly one empty, unquoted field (a line that held only stray CRs) is not a record, but its
   stray_cr errors stay. A quoted `""` line IS a record. If this happens on the would-be header, the header is
   still pending.
9. `width` is the first record's field count (header or not). The header is never padded or cut.
10. `short_row`: `{code,line,row,fields:<count>}`, then pad with `""`. `long_row`: `{code,line,row,extra:[cut fields]}`,
    then cut. Logged when the record ends.
11. `row` = rows.length at the record start, `null` for the header record. `line` = the 1-based line where the
    record starts.
12. Result: `{columns: header ? (columns ?? []) : null, rows, errors}`. With header=true and no records,
    columns = [].
- Error objects carry extra keys (`fields`, `extra`) beyond {code,line,row}. Per the brief, the reference wins.

### Generator facts (subject/csv-cases.mjs)
- 8 to 18 columns. LF or CRLF per file. BOM on 1/3 of files. header on index%3 != 2. About 1% short rows, 1% long
  rows, 0.4% stray CR, 0.4% quote junk, 0.3% blank lines. Half the files have one unterminated quote within the
  last 20 records, with no quotes after it. 1% of plain fields are quoted for no need. Phrases with `, ` or `"x"`
  are quoted. Notes span lines inside quotes (sometimes a lone CR). Non-ASCII words appear, so strings are
  two-byte.
- Every practice file has quotes and CRs (CRLF or stray), so a "no quote / no CR" fast path never fires on
  realistic data. The general scanner must be fast.

### Optimization target (updated with the second brief)
End-to-end process CPU, because the heat measures container CPU over the whole `node main.ts` run (startup,
parse, run, stringify, write, GC threads). The qualifying cut uses the graded run's time (the brief says wall).
Plan: a **byte pipeline** (fast.js). main.ts reads cases.json as a Buffer, walks the JSON itself, reads each CSV
straight from the JSON-escaped bytes and writes answers.json bytes directly. There is no JSON.parse, no
JSON.stringify and no per-field JS string. The scorer compares parsed JSON values, so copying each field's own
escaped bytes from the input is a valid encoding.
- solve.js `run(input)` stays the plain, string-based reader. It is the correctness reference and the
  fallback: fast.js returns null on anything unexpected, and main.ts then does JSON.parse + run + JSON.stringify.
  Unexpected means another JSON shape, an object/array header, or a real `\u00XX` escape of `,` `"` CR or LF.
- **Rule risk:** the rules text says main.ts "answers each with run". The byte pipeline does not call run(). It
  calls the same reading logic, re-implemented on bytes. I'll flag this to the user before submitting it.

### Measurements (Linux: GitHub Actions, Xeon 6975P, node:22-slim, `--cpus 1`, cgroup cpu.stat, 15 rounds)
Synthetic 11 MB set (bench/gen.mjs). CPU ms, median:

| variant | CPU | note |
|---|---|---|
| null (empty main.ts) | 54 | subtracted by the grader |
| u8: utf8 JSON.parse + run + stringify | 457 | first entry's design |
| l1: latin1 read/write (one-byte strings) | 384 | |
| l1g: + single-threaded GC flags | 357 | |
| l1gm: + no TurboFan (Maglev only) | 492 | Maglev-only is bad on Linux (it looked good on Windows) |
| wkgc: worker, 256 MB semi-space, GC flags | 323 | a worker costs about 38 ms of CPU |

- On a single core, V8's concurrent OSR left the hot loop in slow tiers, and inner-loop OSR kept deopting.
  Fix: a per-record function (readRecord) that tiers up by normal calls.
- `--single-threaded-gc` is an implication flag: at runtime it does nothing. The individual flags
  (`--no-parallel-scavenge --no-concurrent-marking --no-parallel-marking --no-parallel-compaction
  --no-parallel-pointer-update --no-concurrent-sweeping`) do take effect.
- Semi-space flags do nothing at runtime for the main isolate, but they apply to a Worker created afterwards.
- Windows timings (15.6 ms ticks, slow laptop core) mislead on JIT/GC choices. Linux CI decides.

### Correctness record
- string run(): fuzz/fuzz.mjs 200k + 100k random, fuzz/big.mjs (45 kit-generator files + long/tiny/astral), the
  6 practice cases. 0 mismatches.
- byte pipeline: fuzz/e2e.mjs 100 files x 5000 cases = 500k (other escapes, spacing, key orders, odd headers,
  backslashes, control chars, lone surrogates; 97 files took the byte path), plus the 6 practice cases. 0 mismatches.

## Submissions
| # | date (UTC) | commit | submission id | result |
|---|------------|--------|---------------|--------|
| 1 | 2026-11-22 10:04 | 2a22b97 | 01a202b6-a030-7609-b963-992e2312c6b9 | safety entry: string run(), utf8 JSON; checks passed |
