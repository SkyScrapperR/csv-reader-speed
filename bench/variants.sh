# Builds variants of the repository's entry into $1 (one dir each) for bench/cgroup-run.sh: the entry as it is, and
# ablations of its main.ts (each a sed of it) or of fast.cjs (an earlier commit's).
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mkv() { # name, sed script applied to main.ts
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.cjs" "$d/"
  sed -e "$2" "$R/main.ts" > "$d/main.ts"
}
mkv cur ''
# the reader before the deopt-avoiding rewrites (commit 10e596d), with this main.ts
mkv prev ''
git -C "$R" show 10e596d:fast.cjs > "$V/prev/fast.cjs"
mkv tf3000 "/invocation-count-for-turbofan/d"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
# a probe: the entry's main.ts with its phases timed, printed as a PROBE line (lands in runs.txt)
mkv probe ''
cat > "$V/probe/main.ts" <<'EOT'
const t0 = performance.now();
const v8 = require('node:v8');
v8.setFlagsFromString('--no-lazy-feedback-allocation');
v8.setFlagsFromString('--no-turbo-inlining');
v8.setFlagsFromString('--invocation-count-for-turbofan=6000');
const { readFileSync, writeFileSync } = require('node:fs');
const { answers } = require('./fast.cjs');
const t1 = performance.now();
const env = process.env;
const input = readFileSync((env.MAKEFUN_INPUT_DIR || '/input') + '/cases.json');
const t2 = performance.now();
let out = answers(input);
const t3 = performance.now();
answers(input);
const t4 = performance.now();
writeFileSync((env.MAKEFUN_OUTPUT_DIR || '/output') + '/answers.json', out);
const t5 = performance.now();
console.log(`PROBE start ${t0.toFixed(1)} load ${(t1 - t0).toFixed(1)} read ${(t2 - t1).toFixed(1)} cold ${(t3 - t2).toFixed(1)} warm ${(t4 - t3).toFixed(1)} write ${(t5 - t4).toFixed(1)}`);
EOT
