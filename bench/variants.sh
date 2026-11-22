# Builds variants of the repository's entry into $1 (one dir each) for bench/cgroup-run.sh: the entry as it is, and
# ablations of its main.ts (each a sed of it) or of fast.cjs (an earlier commit's).
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mkv() { # name, sed script applied to main.ts
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.cjs" "$d/"
  sed -e "$2" "$R/main.ts" > "$d/main.ts"
}
# extra V8 flags after the entry's own
addf() { local s=""; for f in "$@"; do s="$s\nv8.setFlagsFromString('$f');"; done; echo "s/^v8.setFlagsFromString('--no-turbo-inlining');/v8.setFlagsFromString('--no-turbo-inlining');$s/"; }
mkv cur ''
mkv prev ''
git -C "$R" show 58b9b81:fast.cjs > "$V/prev/fast.cjs"
mkv spark "$(addf --always-sparkplug)"
mkv maglev "$(addf --maglev)"
mkv tf6000 "$(addf --invocation-count-for-turbofan=6000)"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
