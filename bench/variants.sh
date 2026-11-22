# Builds variants of the repository's entry into $1 (one dir each) for bench/cgroup-run.sh: the entry as it is, and
# ablations of its main.ts (each a sed of it).
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mkv() { # name, sed script applied to main.ts
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.cjs" "$d/"
  sed -e "$2" "$R/main.ts" > "$d/main.ts"
}
mkv cur ''
mkv nowarm 's/^warmUp();//'
mkv nowarm_lfa "s/^warmUp();//; /no-turbo-inlining/d"
mkv plain "/setFlagsFromString('--no-/d; s/^warmUp();//"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
