#!/usr/bin/env node
// 결정론적 프레임 렌더러: scene.html의 window.__seek(t)를 프레임마다 호출해 캡처 → ffmpeg로 MP4.
//
//   node render.mjs scene.html                    # scene.mp4 (전체 렌더)
//   node render.mjs scene.html --beats            # scene.beats/ 비트별 PNG + contact.png (검수용)
//   node render.mjs scene.html --at 1.2,2.5       # 특정 시점 스틸
//   node render.mjs scene.html --check-loop       # 첫 프레임과 마지막(t=duration) 비교
//   옵션: --out file.mp4  --scale 2 (고해상도)  --from 0 --to 3  --crf 16  --gif
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const root = execSync('npm root -g').toString().trim();
  return req(path.join(root, 'playwright'));
}

function localGsap(name) {
  const dir = path.join(process.env.HOME || '/tmp', '.cache/motion-graphics');
  const file = path.join(dir, 'node_modules/gsap/dist', name + '.min.js');
  if (!fs.existsSync(file)) {
    try { fs.mkdirSync(dir, { recursive: true }); execSync('npm i --silent --no-audit --no-fund gsap@3', { cwd: dir, stdio: 'ignore' }); } catch { return null; }
  }
  return fs.existsSync(file) ? file : null;
}

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--') && !/^[\d.,]+$/.test(a));
if (!input) { console.error('usage: node render.mjs scene.html [--beats|--at t1,t2|--check-loop] [--out x.mp4]'); process.exit(1); }
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i < 0 ? dflt : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const htmlPath = path.resolve(input);
const base = htmlPath.replace(/\.html?$/, '');
const scale = +opt('scale', 1);

const { chromium } = loadPlaywright();
const exe = fs.existsSync('/opt/pw-browsers/chromium') && !process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1920, height: 1920 } });
page.on('pageerror', e => console.error('[page error]', e.message));
// CDN이 막힌 환경: gsap 요청을 로컬 사본으로 대체 (~/.cache/motion-graphics에 npm 설치)
await page.route(/gsap(@[\d.]+)?\/(dist\/)?(\w+)\.min\.js|gsap\/[\d.]+\/(\w+)\.min\.js/, async route => {
  const name = route.request().url().match(/(\w+)\.min\.js/)[1];
  const local = localGsap(name);
  if (local) return route.fulfill({ path: local, contentType: 'text/javascript' });
  return route.continue();
});
page.on('console', m => m.type() === 'error' && console.error('[console]', m.text()));
await page.goto(pathToFileURL(htmlPath).href + '?render=1');
await page.waitForFunction(() => window.__scene && window.__seek, null, { timeout: 15000 });
await page.evaluate(async () => { await document.fonts.ready; });
const S = await page.evaluate(() => window.__scene);
await page.setViewportSize({ width: S.w, height: S.h });
const clip = { x: 0, y: 0, width: S.w, height: S.h };
const shot = async t => { await page.evaluate(t => window.__seek(t), t); return page.screenshot({ clip, type: 'png' }); };

if (opt('beats') || opt('at')) {
  const dir = base + '.beats'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const times = opt('at') ? String(opt('at')).split(',').map(Number).map(t => ({ t, label: '' }))
    : (S.beats.length ? S.beats : [0, .25, .5, .75].map(k => ({ t: k * S.duration, label: '' })));
  const files = [];
  for (const [i, b] of times.entries()) {
    // 비트 순간 + 0.05초 뒤(전환 중간이 아닌 '도착 상태' 확인용)
    const t = Math.min(b.t, S.duration - 1 / S.fps);
    const f = path.join(dir, `${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`);
    fs.writeFileSync(f, await shot(t)); files.push(f);
    console.log(`beat ${i}  t=${t.toFixed(2)}s  ${b.label || ''}  → ${path.basename(f)}`);
  }
  const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
  const contact = path.join(dir, 'contact.png');
  execSync(`ffmpeg -y -loglevel error -pattern_type glob -i '${dir}/[0-9]*.png' -vf "scale=${Math.round(S.w / 2)}:-1,tile=${cols}x${rows}:padding=8:color=0x333333" -frames:v 1 '${contact}'`);
  console.log('contact sheet →', contact);
} else if (opt('check-loop')) {
  const a = await shot(0), b = await shot(S.duration);
  console.log(a.equals(b) ? 'LOOP OK: 첫 프레임 == t=duration 프레임' : 'LOOP MISMATCH: 첫 프레임과 마지막 상태가 다릅니다 (루프 시 튐)');
  fs.writeFileSync(base + '.loop-first.png', a); fs.writeFileSync(base + '.loop-last.png', b);
} else {
  const out = opt('out', base + '.mp4');
  const from = +opt('from', 0), to = +opt('to', S.duration);
  const n = Math.round((to - from) * S.fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(S.fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(opt('crf', 16)), '-preset', 'medium', '-movflags', '+faststart', '-an', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await shot(from + i / S.fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % S.fps === 0) process.stdout.write(`\rframe ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\r${n} frames @${S.fps}fps ${S.w * scale}×${S.h * scale} → ${out}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (opt('gif')) {
    const gif = out.replace(/\.mp4$/, '.gif');
    execSync(`ffmpeg -y -loglevel error -i '${out}' -vf "fps=15,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" '${gif}'`);
    console.log('gif →', gif);
  }
}
await browser.close();
