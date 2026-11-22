# Times each variant as the grader does: one fresh container per run (RUNTIME: runsc for gVisor, or runc), 1 CPU,
# 1024 MB, reading the host cgroup parent's cpu.stat usage_usec around each run (container start-up included, as for
# the null entry). usage: host-run.sh ROUNDS RUNTIME VDIR INDIR variants...
R=$1; RT=$2; V=$3; IN=$4; shift 4
P=/sys/fs/cgroup/bench.slice
u() { if [ -f $P/cpu.stat ]; then sed -n 's/^usage_usec //p' $P/cpu.stat; else echo 0; fi; }
for r in $(seq 1 "$R"); do for v in "$@"; do
  a=$(u); s=$(date +%s%N)
  docker run --rm --runtime=$RT --cpus 1 --memory 1024m --memory-swap 1024m --network none --cgroup-parent=bench.slice \
    -v $V/$v:/bot:ro -v $IN:/input:ro --tmpfs /output node:22-slim node /bot/main.ts >/dev/null 2>&1 || echo "FAIL $v" >&2
  e=$(date +%s%N); b=$(u)
  echo "$v $((b - a)) $(((e - s) / 1000))"
done; done
