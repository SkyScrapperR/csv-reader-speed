# Builds the candidate entries into $1 (one dir each) for bench/cgroup-run.sh.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
# byte pipeline: main.ts + fast.cjs as committed on main (ddf7864)
mkdir -p "$V/bytes"; cp "$R/main.ts" "$R/fast.cjs" "$R/solve.js" "$V/bytes/"
# hybrid: run() from solve.js on every case, io.cjs around it
mkdir -p "$V/hybrid"; cp "$R/solve.js" "$R/io.cjs" "$V/hybrid/"; cp "$R/bench/main-hybrid.ts" "$V/hybrid/main.ts"
# the safety entry as submitted (commit 2a22b97)
mkdir -p "$V/safety"; git -C "$R" archive 2a22b97 main.ts solve.js package.json | tar -x -C "$V/safety"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
