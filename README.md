# csv-reader-speed

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/SkyScrapperR/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0. It gives the same `{columns, rows, errors}` for every input,
including stray CRs, quote junk, unterminated quotes, short rows and long rows.

How it works: `solve.js` reads the text once, from left to right, by char code. A field is a slice of the input
string. Strings are only built up for the rare cases: `""` escapes, CRs inside quotes, and dropped stray CRs.
Line numbers are counted inline, and rows are padded or cut as each record ends. `main.ts` reads
`/input/cases.json`, answers every case with `run`, and writes `/output/answers.json`.

`fuzz/` checks solve.js against the reference, both on random inputs and on the kit's generator. `bench/` measures it.

## Run it

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=edq55gj8&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
