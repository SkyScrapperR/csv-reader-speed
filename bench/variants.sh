# Builds main.ts variants of the current solve.js/fast.js into $1 (one dir each) for bench/cgroup-run.sh.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
G="--no-parallel-scavenge --no-concurrent-marking --no-parallel-marking --no-parallel-compaction --no-parallel-pointer-update --no-concurrent-sweeping"

# string path: latin1 I/O, JSON.parse + run + JSON.stringify; name, flags
mk() {
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/package.json" "$d/"
  cat > "$d/work.js" <<'EOT'
import { readFileSync, writeFileSync } from 'node:fs';
import { run } from './solve.js';
const env = process.env;
const cases = JSON.parse(readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json', 'latin1'));
const answers = [];
for (let i = 0; i < cases.length; i++) { const inp = cases[i].input; let x = inp.text; if (typeof x === 'string' && x.charCodeAt(0) === 0xef && x.charCodeAt(1) === 0xbb && x.charCodeAt(2) === 0xbf) x = x.slice(3); answers.push(run({ text: x, header: inp.header })); }
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', JSON.stringify(answers), 'latin1');
EOT
  { echo "import { setFlagsFromString } from 'node:v8';"; for f in $2; do echo "setFlagsFromString('$f');"; done; echo "await import('./work.js');"; } > "$d/main.ts"
}
mk l1g "--no-incremental-marking $G"

# byte path, ESM: the repository's own main.ts, and with process.exit(0) after the write
d="$V/b"; mkdir -p "$d"; cp "$R/main.ts" "$R/solve.js" "$R/fast.js" "$R/package.json" "$d/"
d="$V/bx"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.js" "$R/package.json" "$d/"; { cat "$R/main.ts"; echo "process.exit(0);"; } > "$d/main.ts"

# byte path, CommonJS: no package.json type, main.ts one require of a .cjs holding fast.js and the driver
mkcjs() {
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$d/"
  { sed 's/^export function answers/function answers/' "$R/fast.js"
    echo "const { readFileSync, writeFileSync } = require('node:fs');"
    echo "const env = process.env;"
    echo "const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');"
    echo "let out = answers(input);"
    echo "if (out === null) out = require('./solve.js').answerPlain(input);"
    echo "writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);"
    [ "$2" = x ] && echo "process.exit(0);"
  } > "$d/w.cjs"
  echo "require('./w.cjs');" > "$d/main.ts"
}
mkcjs cj
mkcjs cjx x

mkdir -p "$V/null"; cp "$R/package.json" "$V/null/"; echo "" > "$V/null/main.ts"
mkdir -p "$V/nullcj"; echo "" > "$V/nullcj/main.ts"
