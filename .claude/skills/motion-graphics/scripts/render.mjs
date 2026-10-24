#!/usr/bin/env node
// 결정론적 프레임 렌더러: scene.html의 window.__seek(t)를 프레임마다 호출해 캡처 → ffmpeg로 MP4.
//
//   node render.mjs scene.html                 전체 렌더 → scene.mp4
//   node render.mjs scene.html --beats         비트별 스틸 + contact.png (검수용, 전체 렌더 전에 필수)
//   node render.mjs scene.html --at 1.2,2.5    특정 시점 스틸
//   node render.mjs scene.html --check         린트 + 결정론(같은 t → 같은 화면) + 루프(SCENE.loop일 때) 검사
//   옵션: --out x.mp4  --scale 2  --from 0 --to 3  --crf 16  --jobs 4  --audio music.mp3  --gif
//
// 오프라인 대응: cdn.jsdelivr.net/npm/<pkg>@<ver>/<path> 요청은 ~/.cache/motion-graphics에 npm으로 받아 둔 사본으로 대체
// (폰트 pretendard·geist, gsap 등). cdnjs의 gsap도 같은 사본으로 대체.
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CACHE = path.join(os.homedir(), '.cache/motion-graphics');

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  try { return req(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } catch {}
  console.error('playwright를 찾을 수 없습니다: npm i -g playwright (브라우저는 npx playwright install chromium)');
  process.exit(1);
}

function npmLocal(pkg, ver, file) {
  const dir = path.join(CACHE, 'node_modules', pkg);
  const target = path.join(dir, file);
  const have = fs.existsSync(path.join(dir, 'package.json')) && JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).version;
  if (!fs.existsSync(target) || (ver && have && !have.startsWith(ver))) {
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      execSync(`npm i --silent --no-audit --no-fund ${pkg}@${ver || 'latest'}`, { cwd: CACHE, stdio: 'ignore' });
    } catch { return null; }
  }
  return fs.existsSync(target) ? target : null;
}

const MIME = { js: 'text/javascript', css: 'text/css', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json' };
async function mirror(page) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/|cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\//, async route => {
    const url = route.request().url().split('?')[0];
    let m = url.match(/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)(?:@([^/]+))?\/(.+)$/);
    let local = null;
    if (m) local = npmLocal(m[1], m[2], m[3]);
    else if ((m = url.match(/libs\/gsap\/([\d.]+)\/(.+)$/))) local = npmLocal('gsap', m[1], 'dist/' + m[2]);
    if (local) return route.fulfill({ path: local, contentType: MIME[local.split('.').pop()] || 'application/octet-stream' });
    return route.continue();
  });
}

// 결정론을 깨는 패턴 경고 (엔진 블록 제외)
function lint(html) {
  const body = html.replace(/\/\* ===== MOTION ENGINE[\s\S]*?<\/script>/, '');
  const rules = [
    [/\btransition\s*:/, 'CSS transition — render(t)로 계산하세요'],
    [/\banimation\s*:|@keyframes/, 'CSS animation — render(t) 또는 GSAP 타임라인으로'],
    [/setTimeout|setInterval|requestAnimationFrame/, '타이머 — 시간은 t로만'],
    [/Math\.random/, 'Math.random — M.rand(seed) 사용'],
    [/Date\.now|performance\.now|new Date\(/, '실시간 시계 — t만 사용'],
    [/will-change/, 'will-change — 스케일되는 텍스트가 흐려짐'],
    [/backdrop-filter/, 'backdrop-filter — 헤드리스 렌더 불안정, 반투명 배경으로 대체 권장'],
    [/gsap\.(to|from|fromTo)\(/, 'gsap 단독 트윈 — 하나의 paused timeline에 넣으세요'],
  ];
  const warns = [];
  for (const [re, msg] of rules) {
    body.split('\n').forEach((line, i) => { if (re.test(line) && !/lint-ok/.test(line)) warns.push(`  L${i + 1}: ${msg}\n        ${line.trim().slice(0, 100)}`); });
  }
  return warns;
}

const args = process.argv.slice(2);
const input = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!input) { console.error('usage: node render.mjs scene.html [--beats|--at t1,t2|--check] [--out x.mp4] [--jobs N]'); process.exit(1); }
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i < 0 ? dflt : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const htmlPath = path.resolve(input);
const base = htmlPath.replace(/\.html?$/, '');
const scale = +opt('scale', 1);

const warns = lint(fs.readFileSync(htmlPath, 'utf8'));
if (warns.length) console.warn(`[lint] 결정론·선명도 경고 ${warns.length}건 (의도적이면 줄 끝에 // lint-ok)\n${warns.join('\n')}`);

const { chromium } = loadPlaywright();
const exe = ['/opt/pw-browsers/chromium'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
const launchArgs = ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--font-render-hinting=none'];
const browser = await chromium.launch({ args: launchArgs, ...(exe ? { executablePath: exe } : {}) });

let errors = 0;
async function openPage() {
  const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1920, height: 1920 } });
  page.on('pageerror', e => { errors++; console.error('[page error]', e.message); });
  page.on('console', m => m.type() === 'error' && !/ERR_TUNNEL|ERR_PROXY|net::ERR/.test(m.text()) && console.error('[console]', m.text()));
  await mirror(page);
  await page.goto(pathToFileURL(htmlPath).href + '?render=1');
  await page.waitForFunction(() => window.__scene && window.__seek, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  const S = await page.evaluate(() => window.__scene);
  await page.setViewportSize({ width: S.w, height: S.h });
  const clip = { x: 0, y: 0, width: S.w, height: S.h };
  const shot = async t => { await page.evaluate(t => window.__seek(t), t); return page.screenshot({ clip, type: 'png' }); };
  return { page, S, shot };
}

const first = await openPage();
const S = first.S;
// 쓰인 폰트 중 로드에 실패한 것만 경고 (선언만 되고 안 쓰인 폰트는 무시)
const missing = await first.page.evaluate(async () => { await document.fonts.ready; return [...new Set([...document.fonts].filter(f => f.status === 'error').map(f => f.family))]; });
if (missing.length) console.warn(`[font] 로드 실패 → 대체 폰트로 렌더됨: ${missing.join(', ')}`);

if (opt('beats') || opt('at')) {
  const dir = base + '.beats'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const times = opt('at') ? String(opt('at')).split(',').map(Number).map(t => ({ t, label: '' }))
    : (S.beats.length ? S.beats : [0, .25, .5, .75].map(k => ({ t: k * S.duration, label: '' })));
  for (const [i, b] of times.entries()) {
    const t = Math.min(b.t, S.duration - 1 / S.fps);
    const f = path.join(dir, `${String(i).padStart(2, '0')}_${t.toFixed(2)}s.png`);
    fs.writeFileSync(f, await first.shot(t));
    console.log(`beat ${String(i).padStart(2)}  t=${t.toFixed(2)}s  ${b.label || ''}`);
  }
  // 콘택트 시트: 각 칸 아래에 시간·라벨
  const cols = Math.min(3, times.length), rows = Math.ceil(times.length / cols);
  const contact = path.join(dir, 'contact.png');
  execSync(`ffmpeg -y -loglevel error -pattern_type glob -i '${dir}/[0-9]*.png' -vf "scale=${Math.round(S.w / 2)}:-1,tile=${cols}x${rows}:padding=10:color=0x3a3a3a" -frames:v 1 '${contact}'`);
  console.log('contact sheet →', contact);
} else if (opt('check')) {
  let ok = true;
  // 결정론: 같은 t를 다른 순서로 두 번 찍어 비교
  const probe = [0.37, 0.61, 0.83].map(k => +(k * S.duration).toFixed(3));
  const a = []; for (const t of probe) a.push(await first.shot(t));
  const b = []; for (const t of [...probe].reverse()) b.unshift(await first.shot(t));
  const det = probe.filter((t, i) => !a[i].equals(b[i]));
  console.log(det.length ? `DETERMINISM FAIL: t=${det.join(', ')} 에서 탐색 순서에 따라 화면이 다름 (상태 누적·타이머 확인)` : 'DETERMINISM OK');
  ok &&= !det.length;
  if (S.loop) {
    const f0 = await first.shot(0), f1 = await first.shot(S.duration);
    const same = f0.equals(f1);
    console.log(same ? 'LOOP OK: t=0 == t=duration' : 'LOOP FAIL: 첫 프레임과 t=duration이 다름 → 루프 시 튐');
    if (!same) { fs.writeFileSync(base + '.loop-first.png', f0); fs.writeFileSync(base + '.loop-last.png', f1); }
    ok &&= same;
  } else console.log('LOOP skip (SCENE.loop=false)');
  console.log(warns.length ? `LINT ${warns.length} warnings` : 'LINT OK');
  console.log(errors ? `PAGE ERRORS ${errors}` : 'PAGE ERRORS 0');
  process.exitCode = ok && !errors ? 0 : 1;
} else {
  const out = path.resolve(opt('out', base + '.mp4'));
  const from = +opt('from', 0), to = +opt('to', S.duration);
  const n = Math.round((to - from) * S.fps);
  const jobs = Math.max(1, Math.min(+opt('jobs', Math.min(4, os.cpus().length)), Math.ceil(n / 30)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-'));
  const t0 = Date.now();
  const workers = [first, ...await Promise.all(Array.from({ length: jobs - 1 }, openPage))];
  let done = 0;
  await Promise.all(workers.map(async (w, j) => {
    for (let i = j; i < n; i += jobs) {
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(6, '0')}.png`), await w.shot(from + i / S.fps));
      if (++done % S.fps === 0) process.stdout.write(`\rframe ${done}/${n}`);
    }
  }));
  const audio = opt('audio');
  const ff = ['-y', '-loglevel', 'error', '-framerate', String(S.fps), '-i', path.join(tmp, 'f%06d.png')];
  if (audio) ff.push('-ss', String(from), '-i', path.resolve(audio));
  ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(opt('crf', 16)), '-preset', 'medium', '-movflags', '+faststart');
  if (audio) ff.push('-c:a', 'aac', '-b:a', '192k', '-shortest'); else ff.push('-an');
  ff.push(out);
  await new Promise((res, rej) => spawn('ffmpeg', ff, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\r${n} frames @${S.fps}fps ${S.w * scale}×${S.h * scale} ×${jobs} jobs → ${out}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (opt('gif')) {
    const gif = out.replace(/\.mp4$/, '.gif');
    execSync(`ffmpeg -y -loglevel error -i '${out}' -vf "fps=15,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" '${gif}'`);
    console.log('gif →', gif);
  }
}
await browser.close();
