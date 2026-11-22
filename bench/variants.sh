# Builds the candidate entries into $1 (one dir each) for bench/host-run.sh and bench/cgroup-run.sh.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
# the candidate (bench/cand: the input read through a window, answers written case by case)
mkdir -p "$V/win"; cp "$R/bench/cand/main.ts" "$R/bench/cand/solve.js" "$V/win/"
# submission 2 (commit 2335b2c, graded 330,000 us): whole file in memory
mkdir -p "$V/whole"; git -C "$R" archive 2335b2c main.ts solve.js | tar -x -C "$V/whole"
# the safety entry (commit 2a22b97, graded 1,780,000 us)
mkdir -p "$V/safety"; git -C "$R" archive 2a22b97 main.ts solve.js package.json | tar -x -C "$V/safety"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
