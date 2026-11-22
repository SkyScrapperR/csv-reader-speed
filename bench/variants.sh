# Builds variants of the repository's entry into $1 (one dir each) for bench/cgroup-run.sh: the entry as it is, and
# ablations of its main.ts (each a sed of it).
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mkv() { # name, sed script applied to main.ts
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.cjs" "$d/"
  sed -e "$2" "$R/main.ts" > "$d/main.ts"
}
# extra V8 flags after the entry's own
addf() { local s=""; for f in "$@"; do s="$s\nv8.setFlagsFromString('$f');"; done; echo "s/^v8.setFlagsFromString('--no-turbo-inlining');/v8.setFlagsFromString('--no-turbo-inlining');$s/"; }
mkv cur ''
mkv tf500 "$(addf --invocation-count-for-turbofan=500)"
mkv tf200 "$(addf --invocation-count-for-turbofan=200 --minimum-invocations-after-ic-update=20)"
mkv tf200o "$(addf --invocation-count-for-turbofan=200 --minimum-invocations-after-ic-update=20 --invocation-count-for-osr=100)"
mkv tf50 "$(addf --invocation-count-for-turbofan=50 --minimum-invocations-after-ic-update=10)"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
