// Lets a life run in the browser and takes raw screenshots at given simulated times.
// usage: node tools/shot-series.cjs <prefix> <t1,t2,...(sim seconds)> [url] [speed]
const { chromium } = require('playwright');
(async () => {
  const [prefix, times, url = 'http://localhost:5173/?fresh', speed = '0'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.visto && window.visto.frame());
  await page.evaluate((s) => {
    window.visto.send({ type: 'speed', speed: Number(s) });
    document.querySelectorAll('#speedSeg button').forEach((b) => b.classList.toggle('on', b.dataset.speed === s));
  }, speed);
  let k = 1;
  for (const t of times.split(',').map(Number)) {
    await page.waitForFunction((tt) => window.visto.frame().time >= tt, t, { timeout: 0, polling: 500 });
    const info = await page.evaluate(() => {
      const f = window.visto.frame();
      return { time: f.time, falls: f.life.falls, best: f.life.bestAttempt, tone: Array.from(f.tone).map((v) => +v.toFixed(2)), speed: f.speed };
    });
    const file = `${prefix}-${String(k++).padStart(2, '0')}-${Math.round(t / 60)}min.png`;
    await page.screenshot({ path: file });
    console.log(file, JSON.stringify(info));
  }
  await browser.close();
})();
