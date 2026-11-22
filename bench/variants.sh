# Builds the candidate entries into $1 (one dir each) for bench/host-run.sh and bench/cgroup-run.sh.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
# the entry as it is
mkdir -p "$V/cur"; cp "$R/main.ts" "$R/solve.js" "$V/cur/"
# the safety entry (commit 2a22b97, graded 1,780,000 us)
mkdir -p "$V/safety"; git -C "$R" archive 2a22b97 main.ts solve.js package.json | tar -x -C "$V/safety"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
