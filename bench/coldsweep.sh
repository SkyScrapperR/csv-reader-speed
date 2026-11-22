# Cold answers() wall (ms, median of 7 fresh pinned processes) for each RTFLAGS set given as an argument.
for f in "$@"; do
  vals=""
  for r in 1 2 3 4 5 6 7; do
    v=$(RTFLAGS="$f" node bench/pin.mjs bench/bphases.mjs | sed -n 's/.*answers \([0-9]*\)\/.*/\1/p')
    vals="$vals $v"
  done
  echo "median $(echo $vals | tr ' ' '\n' | sort -n | sed -n 4p)  [$vals ]  $f"
done
