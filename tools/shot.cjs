// Takes a raw screenshot of the running page.
// usage: node tools/shot.mjs <out.png> [--wait ms] [--eval "js"] [--w 1440] [--h 900] [--scale 2] [--url http://localhost:5173]
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const out = args[0];
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
(async () => {
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(opt('w', 1440)), height: Number(opt('h', 900)) },
  deviceScaleFactor: Number(opt('scale', 2)),
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('console error:', m.text());
});
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(opt('url', 'http://localhost:5173'));
const js = opt('eval', '');
if (js) await page.evaluate(js);
await page.waitForTimeout(Number(opt('wait', 1500)));
const js2 = opt('eval2', '');
if (js2) {
  await page.evaluate(js2);
  await page.waitForTimeout(Number(opt('wait2', 500)));
}
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
})();
