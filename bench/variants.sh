# Builds the candidate entries into $1 (one dir each) for bench/cgroup-run.sh.
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
# the entry as it is: run() per case, the byte reader inside solve.js
mkdir -p "$V/tweak"; cp "$R/main.ts" "$R/solve.js" "$V/tweak/"
# commit 482ee5e: main.ts + fast.cjs (byte reader outside run)
mkdir -p "$V/prev482"; git -C "$R" archive 482ee5e main.ts fast.cjs solve.js | tar -x -C "$V/prev482"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
