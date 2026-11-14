// Summarises logs of tools/learn-test.ts: falls per minute (minutes with more than 10 s of
// sleep in brackets), when a life learned to walk and how it did at the end.
// usage: node tools/summarize-lives.cjs out/c-fixed-*.log
const fs = require('node:fs');
let learned = 0;
const files = process.argv.slice(2);
for (const f of files) {
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.startsWith('min')).map((l) => ({ falls: Number(/falls (\d+)/.exec(l)[1]), asleep: Number(/asleep (\d+) s/.exec(l)[1]) }));
  // learned = the first of three waking minutes in a row with at most 3 falls each
  const awake = rows.map((r, i) => ({ ...r, i })).filter((r) => r.asleep <= 10);
  let at = -1;
  for (let k = 0; k + 2 < awake.length && at < 0; k++) if (awake[k].falls <= 3 && awake[k + 1].falls <= 3 && awake[k + 2].falls <= 3) at = awake[k].i + 1;
  const last = awake.slice(-5);
  const end = last.reduce((s, r) => s + r.falls, 0) / Math.max(1, last.length);
  const ok = at > 0 && end <= 3;
  if (ok) learned++;
  console.log(`${f.replace(/^.*\//, '').replace('.log', '').padEnd(16)} ${rows.map((r) => (r.asleep > 10 ? `(${r.falls})` : String(r.falls))).join(' ')}  | ${at > 0 ? `walks from minute ${at}` : 'does not walk'}, last 5 waking minutes ${end.toFixed(1)} falls/min${at > 0 && !ok ? ' (relapsed)' : ''}`);
}
console.log(`${learned} of ${files.length} walk at the end`);
