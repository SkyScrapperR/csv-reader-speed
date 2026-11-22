# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0. It gives the same `{columns, rows, errors}` for every input,
including stray CRs, quote junk, unterminated quotes, short rows and long rows.

How it works:

- `main.ts` reads `/input/cases.json` as bytes and calls `run` from `solve.js` once for every case.
- `run(input)` takes a case in either of two forms. Given `{text, header}`, as the spec writes it, a plain
  string reader returns the answer object. Given a `ByteCase` (the file's bytes and a case's position), it reads that
  case's CSV straight from its JSON-escaped bytes: `,`, `\"`, `\n` and `\r` are the CSV characters, and the raw `"`
  ends the text. It writes the answer as JSON bytes, each field as its own escaped bytes. There is no JSON.parse,
  no JSON.stringify and no JS string per field. Line numbers, errors and row padding or cutting are done inline.
- On input the byte form doesn't expect (another JSON shape, or a `\u` escape of a comma, quote, CR or LF),
  main.ts takes the plain path: JSON.parse, `run` on each `{text, header}`, JSON.stringify.
- The reader is shaped for V8: per-record functions, a byte-class table with unrolled runs, and rare paths in
  small helpers called from often-run sites, so a late rare case never deopts the hot loop.

`fuzz/` checks both paths against the reference: random inputs, generator-like files and whole cases.json files
written with other escapes and spacing. `bench/` measures whole-process CPU, including a 1-CPU Linux container run in CI.

## Run it

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=edq55gj8&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
