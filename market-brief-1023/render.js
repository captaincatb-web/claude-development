// usage: node render.js <outDir> <workers> [frame,frame,...]
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const [outDir, workers = '2', list] = process.argv.slice(2);
const html = 'file://' + path.join(__dirname, 'scene.html');
const tl = JSON.parse(fs.readFileSync(path.join(__dirname, 'build/timeline.json')));
const frames = list ? list.split(',').map(Number) : [...Array(Math.ceil(tl.total * tl.fps)).keys()];
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--allow-file-access-from-files'] });
  const n = +workers, t0 = Date.now(); let done = 0;
  await Promise.all([...Array(n).keys()].map(async w => {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    page.on('pageerror', e => { console.error('pageerror', e.message); process.exit(1); });
    await page.goto(html); await page.evaluate(() => window.ready);
    for (let i = w; i < frames.length; i += n) {
      const f = frames[i];
      const url = await page.evaluate(k => window.renderFrame(k), f);
      fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      if (++done % 150 === 0) console.log(done, '/', frames.length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
    }
  }));
  await browser.close(); console.log('done', frames.length);
})();
