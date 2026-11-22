// Preloaded with --import: prints the whole process's CPU (all threads) and wall at exit, as JSON on stderr.
const t0 = performance.timeOrigin;
import { isMainThread } from "node:worker_threads";
if (isMainThread)
process.on('exit', () => {
  const u = process.cpuUsage();
  process.stderr.write(JSON.stringify({ cpu: (u.user + u.system) / 1000, wall: Date.now() - t0 }) + '\n');
});
