#!/usr/bin/env node
// 템플릿에서 새 장면 파일 만들기
//   node new-scene.mjs work/hook.html [--size 1080x1920] [--preset lime|coral|paper|glow] [--gsap] [--duration 6] [--title "Hook"]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
if (!out) { console.error('usage: node new-scene.mjs out.html [--size WxH] [--preset lime|coral|paper|glow] [--gsap] [--duration N] [--title T]'); process.exit(1); }
if (fs.existsSync(out) && !opt('force')) { console.error(`${out} 이(가) 이미 있습니다 (--force로 덮어쓰기)`); process.exit(1); }

const PRESETS = {
  lime: null,
  coral: '--bg: #111111; --surface: #1b1b1b; --line: #2c2c2c; --ink: #f2ede4; --muted: #8a857c; --accent: #ff5a36;',
  paper: '--bg: #f4f1ea; --surface: #ffffff; --line: #d9d4c9; --ink: #151515; --muted: #6f6a61; --accent: #c6ff3d;',
  glow: '--bg: #07080b; --surface: #10131a; --line: #1f2430; --ink: #eef1ff; --muted: #7d859c; --accent: #7c8cff;',
};
let s = fs.readFileSync(path.join(here, '../templates/scene.html'), 'utf8');
const [w, h] = String(opt('size', '1080x830')).split('x').map(Number);
const preset = String(opt('preset', 'lime'));
if (!(preset in PRESETS)) { console.error('preset: ' + Object.keys(PRESETS).join(' | ')); process.exit(1); }

s = s.replace('<title>Scene</title>', `<title>${opt('title', path.basename(out, '.html'))}</title>`);
s = s.replace(/width: 1080px; height: 830px;/, `width: ${w}px; height: ${h}px;`);
s = s.replace(/w: 1080, h: 830, fps: 30, duration: 4,/, `w: ${w}, h: ${h}, fps: 30, duration: ${+opt('duration', 4)},`);
if (PRESETS[preset]) s = s.replace('  /* ===== SCENE STYLES ===== */', `  /* ===== SCENE STYLES ===== */\n  /* 프리셋 ${preset.toUpperCase()} */\n  :root { ${PRESETS[preset]} }`);
if (opt('gsap')) s = s.replace(/<!-- GSAP을 쓸 때만[^\n]*\n(<script src=[^\n]*><\/script>) -->/, '$1');
if (h > w) s = s.replace('  /* ===== SCENE STYLES ===== */', '  /* ===== SCENE STYLES ===== */\n  /* 세로 포맷: 위 220px · 아래 360px · 오른쪽 140px은 플랫폼 UI 영역 — 핵심 요소 금지 */');

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, s);
console.log(`created ${out}  ${w}×${h}  preset=${preset}${opt('gsap') ? '  +gsap' : ''}`);
console.log(`next: 비트 표 작성 → SCENE.beats 채우기 → node ${path.relative(process.cwd(), path.join(here, 'render.mjs'))} ${out} --beats`);
