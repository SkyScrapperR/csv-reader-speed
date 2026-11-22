# usage: bash bench/flags.sh "<flagset1>" "<flagset2>" ... ; pinned to 1 CPU, 5 reps, prints median total CPU of the process
for f in "$@"; do
  vals=""
  for r in 1 2 3 4 5; do
    v=$(RTFLAGS="$f" cmd.exe //c "start /b /wait /affinity 1 node --import ./bench/cpu-hook.mjs bench/ph2.mjs" 2>&1 | grep -o '"cpu":[0-9]*' | cut -d: -f2)
    vals="$vals $v"
  done
  med=$(echo $vals | tr ' ' '\n' | sort -n | sed -n 3p)
  echo "median $med  [$vals ]  $f"
done
