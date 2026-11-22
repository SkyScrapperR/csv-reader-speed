# Builds variants of the repository's entry into $1 (one dir each) for bench/cgroup-run.sh: the entry as it is, and
# ablations of its main.ts (each a sed of it) or of fast.cjs (an earlier commit's).
set -e
V="$1"; R="$(cd "$(dirname "$0")/.." && pwd)"; rm -rf "$V"; mkdir -p "$V"
mkv() { # name, sed script applied to main.ts
  d="$V/$1"; mkdir -p "$d"; cp "$R/solve.js" "$R/fast.cjs" "$d/"
  sed -e "$2" "$R/main.ts" > "$d/main.ts"
}
mkv cur ''
mkv inlonly "/no-lazy-feedback-allocation/d"
mkv plain "/setFlagsFromString('--no-/d"
# the reader before the class tables and unrolled loops (commit afbd185), with this main.ts
mkv oldfast ''
git -C "$R" show afbd185:fast.cjs | sed '/^\/\/ A small constant text holding/,$d' > "$V/oldfast/fast.cjs"; echo "module.exports = { answers };" >> "$V/oldfast/fast.cjs"
mkdir -p "$V/null"; echo "" > "$V/null/main.ts"
