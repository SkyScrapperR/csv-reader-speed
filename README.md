# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0. It gives the same `{columns, rows, errors}` for every input,
including stray CRs, quote junk, unterminated quotes, short rows and long rows.

How it works:

- `main.ts` reads `/input/cases.json` as bytes. `fast.cjs` walks the JSON and reads each case's CSV straight from its
  JSON-escaped bytes: `,`, `\"`, `\n` and `\r` are the CSV characters, and the raw `"` ends the text. It writes
  `answers.json` bytes directly, each field as its own escaped bytes. There is no JSON.parse, no JSON.stringify and
  no JS string per field. Line numbers, errors and row padding or cutting are done inline in the same pass.
- On input it doesn't expect (another JSON shape, or a `\u` escape of a comma, quote, CR or LF), it hands the file
  to the plain path: JSON.parse, then `run` from `solve.js` on each case, then JSON.stringify.
- `solve.js` exports `run(input)`, a plain string-based reader of the same policy. It is the fallback and the
  reference that the byte path is fuzzed against.
- Before reading the input, the reader runs once on a small constant text holding every rare construct, so V8
  optimizes it with full type feedback, without later deopts.

`fuzz/` checks both paths against the reference: random inputs, generator-like files and whole cases.json files
written with other escapes and spacing. `bench/` measures whole-process CPU, including a 1-CPU Linux container run in CI.

## Run it

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=edq55gj8&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
