# Builds main.ts variants of the current solve.js into $1 (one dir each): I/O mode x V8 flags x worker or not.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mk() { # name, flags, worker(0/1), enc(latin1|utf8)
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/package.json" "$d/"
  if [ "$4" = utf8 ]; then STRIP=""; else STRIP="if (typeof x === 'string' && x.startsWith('\u00ef\u00bb\u00bf')) x = x.slice(3);"; fi
  cat > "$d/work.js" <<EOT
import { readFileSync, writeFileSync } from 'node:fs';
import { run } from './solve.js';
const env = process.env;
const cases = JSON.parse(readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json', '$4'));
const answers = [];
for (let i = 0; i < cases.length; i++) { const inp = cases[i].input; let x = inp.text; $STRIP answers.push(run({ text: x, header: inp.header })); }
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', JSON.stringify(answers), '$4');
EOT
  { echo "import { setFlagsFromString } from 'node:v8';"; for f in $2; do echo "setFlagsFromString('$f');"; done
    if [ "$3" = 1 ]; then echo "import { Worker } from 'node:worker_threads';"; echo "new Worker(new URL('./work.js', import.meta.url));"; else echo "await import('./work.js');"; fi; } > "$d/main.ts"
}
G="--no-parallel-scavenge --no-concurrent-marking --no-parallel-marking --no-parallel-compaction --no-parallel-pointer-update --no-concurrent-sweeping"
S="--min-semi-space-size=256 --max-semi-space-size=256"
S64="--min-semi-space-size=64 --max-semi-space-size=64"
mk u8 "--no-incremental-marking" 0 utf8
mk l1 "--no-incremental-marking" 0 latin1
mk l1g "--no-incremental-marking $G" 0 latin1
# mk l1c "--no-incremental-marking --no-concurrent-recompilation" 0 latin1
# mk l1gc "--no-incremental-marking $G --no-concurrent-recompilation" 0 latin1
# mk l1gm "--no-incremental-marking $G --no-concurrent-recompilation --no-turbofan" 0 latin1
# mk l1m "--no-incremental-marking --no-turbofan" 0 latin1
mk wk "--no-incremental-marking $S" 1 latin1
# mk wkgm "--no-incremental-marking $S $G --no-concurrent-recompilation --no-turbofan" 1 latin1
# mk wk64gm "--no-incremental-marking $S64 $G --no-concurrent-recompilation --no-turbofan" 1 latin1
mk wkgc "--no-incremental-marking $S $G --no-concurrent-recompilation" 1 latin1
mkdir -p "$V/null"; cp "$R/package.json" "$V/null/"; echo "" > "$V/null/main.ts"
mkdir -p "$V/nullwk"; cp "$R/package.json" "$V/nullwk/"; echo "" > "$V/nullwk/work.js"; printf "import { Worker } from 'node:worker_threads';\nnew Worker(new URL('./work.js', import.meta.url));\n" > "$V/nullwk/main.ts"
# byte pipeline variants (fast.js): name, flags, worker(0/1)
mkb() {
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.js" "$R/package.json" "$d/"
  printf "import { readFileSync, writeFileSync } from 'node:fs';\nimport { answerFile } from './fast.js';\nconst env = process.env;\nwriteFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', answerFile(readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json')));\n" > "$d/work.js"
  { echo "import { setFlagsFromString } from 'node:v8';"; for f in $2; do echo "setFlagsFromString('$f');"; done
    if [ "$3" = 1 ]; then echo "import { Worker } from 'node:worker_threads';"; echo "new Worker(new URL('./work.js', import.meta.url));"; else echo "await import('./work.js');"; fi; } > "$d/main.ts"
}
mkb b "--no-incremental-marking" 0
mkb bg "--no-incremental-marking $G" 0
mkb bc "--no-incremental-marking --no-concurrent-recompilation" 0
mkb bgc "--no-incremental-marking $G --no-concurrent-recompilation" 0
mkb bn "" 0
