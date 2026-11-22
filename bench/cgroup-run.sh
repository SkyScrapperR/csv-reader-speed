# Inside a node:22 container: runs each /v/<variant>/main.ts ROUNDS times interleaved, reading the container cgroup's
# cpu.stat usage_usec around each run (the grader's own counter); prints a line per run. usage: cgroup-run.sh ROUNDS variants...
R=$1; shift
u() { sed -n 's/^usage_usec //p' /sys/fs/cgroup/cpu.stat; }
for r in $(seq 1 "$R"); do for v in "$@"; do
  a=$(u); s=$(date +%s%N); MAKEFUN_INPUT_DIR=/in MAKEFUN_OUTPUT_DIR=/tmp/out node /v/$v/main.ts || echo "FAIL $v"; e=$(date +%s%N); b=$(u)
  echo "$v $((b - a)) $(((e - s) / 1000))"
done; done
