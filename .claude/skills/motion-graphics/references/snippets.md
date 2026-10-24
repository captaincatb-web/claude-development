# 스니펫 — 자주 쓰는 동작의 결정론적 구현

모두 `render(t)` 안에서 t만 보고 계산한다. `M.*`는 `templates/scene.html` 엔진.
실제로 돌아가는 전체 코드는 `examples/`에 있다 (아래 각 항목에 표시).

## 목차
1. 마스크 리빌 · 2. 형광펜 · 3. 선 그리기 · 4. 타이핑+캐럿 · 5. 커서·클릭 · 6. 카운트업
7. 모프(FLIP: 작은 요소 → 큰 패널) · 8. 닫힌 식 스프링(토글·슬라이더·탭) · 9. 스미어+오니언 스킨
10. 손그림 마커 선 · 11. 3D 카드 던지기 · 12. 캔버스 시뮬레이션 · 13. Catmull-Rom 경로
14. 형광 빔 잔상 · 15. 망점(하프톤) · 16. WebGL 셰이더 뼈대 · 17. 녹화·이미지 슬롯 · 18. 장면 전환(하드컷·블러 스왑)

---

### 1. 마스크 리빌 — `examples/code-to-video.html`
```html
<div class="abs mask" id="h"><span class="inner" id="hIn">헤드라인</span></div>
```
```js
const k = M.io(t, 0.6, 1.3, 5.6, 6.1);             // 등장 outExpo, 퇴장 inCubic
M.css($('#hIn'), { transform: `translateY(${(1 - k) * 110}%)` });
```
여러 줄이면 줄마다 0.06–0.08s 오버랩.

### 2. 형광펜 (강조색 한 곳) — `examples/word-rise-gsap.html`
```css
.hl { position: relative; display: inline-block; }
.hl::before { content: ""; position: absolute; left: -6px; right: -6px; top: 6%; bottom: -4%; border-radius: 3px;
  background: var(--accent); transform-origin: 0 50%; transform: scaleX(var(--hl, 0)); }
.hl b { position: relative; }
```
```js
$('#hl').style.setProperty('--hl', M.p(t, 3.3, 3.6, 'outCubic'));
M.css($('#hlB'), { color: M.mixHex('#ffffff', '#0a0a0a', M.p(t, 3.4, 3.6)) }); // 밝은 띠 위 글자는 어둡게
```

### 3. 선 그리기 (SVG stroke)
```js
const len = path.getTotalLength();                  // 부팅 시 한 번
path.style.strokeDasharray = len;
path.style.strokeDashoffset = len * (1 - M.p(t, 1.4, 1.75, 'inOutCubic'));
```
화살표: 몸통 먼저, 머리는 0.1s 늦게 시작(오버랩).

### 4. 타이핑 + 캐럿 — `examples/command-palette.html`
```js
const typeQ = M.typer('새 캔버스', 9, 3);            // 초당 9자, 시드 3 지터, 공백·구두점 뒤 쉼
$('#typed').textContent = typeQ(t, 0.95);           // 0.95초부터
const typing = t > 0.95 && t < 0.95 + typeQ.duration + 0.1;
caret.style.opacity = typing || Math.floor(t / 0.5) % 2 === 0 ? 1 : 0;  // 입력 중엔 켜짐, 끝나면 0.5s 깜빡임
```

### 5. 커서 · 클릭 — `examples/command-palette.html`
```js
const KEYS = [[0, 1120, 900], [1.55, 1120, 900], [2.05, 640, 312], [2.2, 640, 312, 'click'], [3.6, 1180, 760]];
const c = M.cursor($('#cur'), t, KEYS);             // 살짝 휘는 경로 + inOutCubic + 클릭 눌림
// c.press(0→1→0)로 버튼 눌림도 동기화: btn.style.transform = `scale(${1 - 0.04 * c.press})`
```
원인 → 결과: 클릭 후 0.05–0.1s 안에 결과가 반응을 시작해야 인과가 읽힌다.

### 6. 카운트업
```js
$('#n').textContent = M.count(t, 1.0, 2.2, 0, 128);  // outExpo, 천 단위 콤마. 요소에 class="num"(tabular-nums)
```

### 7. 모프 (선택한 바로 그 요소가 화면이 된다) — `examples/command-palette.html`
```js
const A = { x: 202, y: 274, w: 676, h: 76, r: 12 }, B = { x: 80, y: 108, w: 920, h: 640, r: 22 };
const m = M.p(t, 3.5, 4.3, 'inOutExpo');
M.css(morph, { left: M.lerp(A.x, B.x, m) + 'px', top: M.lerp(A.y, B.y, m) + 'px',
  width: M.lerp(A.w, B.w, m) + 'px', height: M.lerp(A.h, B.h, m) + 'px', borderRadius: M.lerp(A.r, B.r, m) + 'px' });
// 안의 내용은 따로: 옛 문구 퇴장(3.3–3.5) → 모프 → 새 내용 등장(4.1–4.6). 겹치면 안 된다.
```
좌표 A는 원래 요소의 실제 위치와 같아야 한다(`--at`으로 확인).

### 8. 닫힌 식 스프링 — 목표가 여러 번 바뀌는 값
```js
// 토글 손잡이: 1.2s에 오른쪽으로, 3.0s에 왼쪽으로. 바뀔 때마다 스프링 하나씩 더함 → t만의 함수
const x = M.springTo(t, 0, [[1.2, 44], [3.0, 0]], 2.4, 0.7);
// 손잡이 앞쪽 끝은 더 빠른 스프링 → 늘어났다 돌아오는 느낌
const lead = M.springTo(t, 0, [[1.2, 44], [3.0, 0]], 4.0, 0.8);
knob.style.left = Math.min(x, lead) + 'px'; knob.style.width = 40 + Math.abs(lead - x) + 'px';
```
탭 선택 표시도 같은 방식으로 왼쪽 끝·오른쪽 끝을 다른 스프링에 태운다.

### 9. 스미어 + 오니언 스킨 (튀는 공)
```js
const pos = tt => ({ x: ..., y: ... });              // t의 함수(포물선 kf)
const v = { x: (pos(t + 1/60).x - pos(t - 1/60).x) * 30, y: (pos(t + 1/60).y - pos(t - 1/60).y) * 30 };
const sp = Math.hypot(v.x, v.y), ang = Math.atan2(v.y, v.x) * 180 / Math.PI;
ball.style.transform = `translate(${p.x}px,${p.y}px) rotate(${ang}deg) scale(${1 + Math.min(sp / 2400, .5)}, ${1 / (1 + Math.min(sp / 2400, .5))})`;
ghosts.forEach((g, i) => { const q = pos(t - (i + 1) * 0.025); g.style.transform = `translate(${q.x}px,${q.y}px)`; g.style.opacity = 0.25 * (1 - i / 4); });
// 착지 프레임: scaleY 0.7 / scaleX 1.3 → 0.12s outBack 복원. 도약 직전 0.1s 웅크림(scaleY 0.85).
```

### 10. 손그림 마커 선 (시드 고정 흔들림)
```js
const r = M.rand(42);
const pts = [[x0, y0], [x1, y1], [x2, y2]].map(([x, y]) => [x + (r() - .5) * 6, y + (r() - .5) * 6]);
path.setAttribute('d', `M${pts[0]} Q${pts[1]} ${pts[2]}`);   // 부팅 시 한 번 만들고 render에선 dashoffset만
```
stroke-linecap round, 굵기 6–8px, 두 번 긋는 밑줄은 두 번째 획을 0.15s 늦게.

### 11. 3D 카드 던지기
```css
#deck { perspective: 1600px; } .card { position: absolute; transform-style: preserve-3d; }
```
```js
const cam = M.p(t, 1.0, 2.8, 'outCubic');                       // 비스듬히 → 정면으로 펴짐
deck.style.transform = `rotateX(${M.lerp(38, 0, cam)}deg) rotateZ(${M.lerp(-14, 0, cam)}deg)`;
const th = M.p(t, 0.85, 1.25, 'inCubic');                        // 던질 때 가속
top.style.transform = `translate3d(${th * 1300}px, ${-th * 120}px, ${th * 200}px) rotateZ(${th * 28}deg)`;
const adv = M.springTo(t, 0, [[0.9, 1]], 2.6, 0.6);             // 뒤 카드가 한 칸 앞으로 튕기듯
cards.forEach((c, i) => { const d = i - adv; c.style.transform = `translate3d(0, ${-d * 28}px, ${-d * 60}px) scale(${1 - d * 0.05})`; c.style.filter = `brightness(${1 - d * 0.18})`; });
```

### 12. 캔버스 시뮬레이션 — `examples/ring-escape-sim.html`
```js
const sample = M.simulate(init, (s, dt) => nextState(s, dt), { hz: 480, duration: SCENE.duration, snapshot: s => ({ x: s.x, y: s.y, k: s.k }) });
function render(t) { const s = sample(t); /* 그리기만 */ }
```
- 사건(충돌·돌파 시각)은 시뮬 중에 배열에 기록 → 연출(파문, 조각, 문구 교체) 타이밍으로 재사용.
- **시드 탐색은 페이지와 똑같은 코드로** 해야 한다. 부동소수 누적 방식(`t += dt` vs `i*dt`)만 달라도 카오스 시스템은 다른 결과가 된다.
- 반응-확산처럼 무거운 격자: `every`로 저장 간격을 늘리거나, t에서 반복 횟수를 계산해 처음부터 재계산 + 마지막 결과 캐시.

### 13. Catmull-Rom 경로 (드래그·카메라 이동)
```js
const KEYS = [[1.0, 900, 700], [2.0, 420, 300], [3.4, 700, 420], [4.6, 300, 520], [6.3, 560, 380]];
const { x, y } = M.catmull(t, KEYS);                 // 키를 부드럽게 통과
```

### 14. 형광 빔 잔상 (오실로스코프·궤적)
```js
const TRAIL = 0.55, N = 120;
for (let i = N; i >= 0; i--) {
  const tt = t - TRAIL * i / N, a = Math.exp(-4 * i / N);          // 머리 밝게, 꼬리 지수 감쇠
  const p0 = beam(tt), p1 = beam(tt + TRAIL / N);
  [[14, .08], [5, .35], [1.6, 1]].forEach(([w, al]) => {            // 넓고 흐린 선 · 중간 · 가는 심
    g.strokeStyle = `rgba(212,245,39,${a * al})`; g.lineWidth = w;
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
  });
}
```
`globalCompositeOperation = 'lighter'`로 겹칠수록 밝게.

### 15. 망점(하프톤) 판
```js
// tone(x,y) ∈ [0,1] → 각도 θ 격자에서 점 반지름 = cell/2 * sqrt(tone)
for (let i = -n; i < n; i++) for (let j = -n; j < n; j++) {
  const x = cx + (i * Math.cos(th) - j * Math.sin(th)) * cell, y = cy + (i * Math.sin(th) + j * Math.cos(th)) * cell;
  const r = cell / 2 * Math.sqrt(tone(x, y)); if (r > .3) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
}
```
두 판은 `globalCompositeOperation = 'multiply'`, 판 어긋남은 translate/rotate를 t로 보간.

### 16. WebGL 셰이더 뼈대
```js
const gl = cv.getContext('webgl', { preserveDrawingBuffer: true });   // 캡처하려면 preserveDrawingBuffer 필수
// ... 셰이더 컴파일, 전체 화면 사각형
function render(t) { gl.uniform1f(uTime, t); gl.uniform2f(uA, ax(t), ay(t)); gl.drawArrays(gl.TRIANGLES, 0, 6); }
```
모든 유니폼은 t에서 계산. 셰이더 안에서 `fract(sin())` 노이즈는 결정론적이라 OK.
SDF 합체: `float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }`

### 17. 녹화·이미지 슬롯
```html
<video data-slot data-start="1.2" src="my-recording.mp4" muted playsinline></video>
<img data-slot src="result.png" alt="">
```
엔진이 `__seek`마다 `currentTime = t - start`로 맞추고 `seeked`까지 기다린다. 파일이 없으면 단색 + "녹화 자리" 라벨.

### 18. 장면 전환
- **하드 컷**: `const sceneB = t >= 7.4;` 로 display 전환 + B는 첫 프레임부터 이미 움직이는 중(정지 컷 금지).
- **블러 스왑**: 내용 교체 구간 0.18s 동안 `filter: blur(${8 * Math.sin(Math.PI * k)}px)`, 중간(k=0.5)에서 내용 바꾸기.
- **줌 스루 / 매치컷 / 아이리스**: `motion-principles.md` 수치 참조.
