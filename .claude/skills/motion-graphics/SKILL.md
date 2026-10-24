---
name: motion-graphics
description: 코드(HTML·CSS·SVG·Canvas·WebGL·GSAP)로 모션그래픽 영상을 설계·검수하고 MP4로 렌더한다. 숏츠 인서트(1080×830), 세로 광고(1080×1920), 키네틱 타이포, 화면 데모(UI 재연·커서·타이핑), 장면 전환, 개념 시뮬레이션(물리·데이터), 제너레이티브, 로고 스팅, 루프 영상에 사용. "모션그래픽 만들어줘", "이 문장을 움직이는 영상으로", "숏츠에 넣을 장면", "코드로 영상", "HTML 애니메이션 녹화", "GSAP으로" 같은 요청이면 이 스킬을 쓴다. 다른 AI에 붙여 넣을 모션 프롬프트를 써 달라는 요청에도 사용.
---

# Motion Graphics — 코드로 그리는 영상

촬영이 아니라 **코드로 그린 영상**이다. HTML 파일 하나에 장면을 짜고, 프레임마다 시간 t를 넘겨 캡처해 MP4로 만든다.
결과의 질은 코드보다 **설계(비트 그리드)**와 **검수(비트 스틸)**에서 나온다. 이 순서를 건너뛰지 않는다.

## 파일 지도

| 경로 | 언제 읽나 |
|---|---|
| `templates/scene.html` | **항상** — 복사해서 시작. 폰트·토큰·엔진(`M.*`)·미리보기 포함 |
| `scripts/new-scene.mjs` | 새 장면 파일 생성 (크기·프리셋·GSAP) |
| `scripts/render.mjs` | 검수·렌더 (`--beats` / `--check` / 전체 렌더) |
| `references/motion-principles.md` | 타이밍·이징·스태거 숫자가 필요할 때 (거의 항상) |
| `references/style-system.md` | 포맷·안전 영역·팔레트·타이포 스케일 |
| `references/snippets.md` | 마스크 리빌·형광펜·커서·모프·스프링·스미어·시뮬레이션·셰이더 구현 |
| `references/scene-recipes.md` | 어떤 장면 구조를 쓸지 고를 때 (CHA Motion Kit 172 분석) |
| `references/prompt-library.md` | 원문 프롬프트 — 같은 종류 장면의 **밀도 기준점** |
| `references/prompt-patterns.md` | 다른 AI용 프롬프트를 쓸 때 / 원문 규칙 요약 |
| `references/gotchas.md` | 렌더 전 점검, 문제가 생겼을 때 |
| `examples/` | 실제로 돌아가는 완성본 4개 (아래) |

### 예제 (모두 `--check` 통과, MP4·콘택트 시트 포함)
| 파일 | 보여 주는 것 |
|---|---|
| `code-to-video.html` | 키네틱 타이포 조합: 타이핑 키커 → 마스크 리빌 → 화살표 드로우(예비동작) → 글자 스프링 스태거 → 형광펜 → 푸시 인 → **완벽 루프**. INK-CORAL |
| `command-palette.html` | 화면 속 작업: ⌘K 키캡 → 팔레트 → 사람 같은 타이핑 → 커서 클릭 → **선택한 그 행이 캔버스로 모프** → CANVAS READY 홀드 |
| `word-rise-gsap.html` | **GSAP paused timeline** 방식, 128 BPM 비트 싱크, 밑줄이 단어 폭을 따라감, 형광펜 |
| `ring-escape-sim.html` | Canvas + `M.simulate` 480Hz **결정론적 물리**, 사건 기록으로 연출 동기화, 현재 대상만 밝게 |

## 워크플로

### 1. 입력 확인 — 빠진 것만 묻는다
- **메시지**: 이 장면이 말할 한 문장 (대사가 있으면 그대로)
- **포맷**: 숏츠 인서트 1080×830(기본) · 세로 1080×1920 · 가로 1920×1080
- **길이**: 인서트 4–7.5초 · 개념/시뮬 8–12초 · 필름 13–16초
- **스타일**: INK-LIME(기본) · INK-CORAL · PAPER · GLOW, 또는 참고 이미지
- **에셋**: 로고·녹화·이미지 → 없으면 슬롯으로 비운다. 실제 결과·수치·로고를 꾸며내지 않는다
- 루프 여부, BPM

요청에 충분한 정보가 있으면 묻지 말고 기본값으로 진행하며 가정을 한 줄로 밝힌다.

### 2. 설계 — 비트 그리드 + 상태 목록 (코드 전에)
1. `scene-recipes.md`에서 가장 가까운 레시피, `prompt-library.md`에서 가장 가까운 원문을 고른다.
2. 초 단위 표를 쓴다. 각 줄 = 상태가 **도착하는** 순간 + 기법 + 수치:
```
t      상태                                   기법·수치
0.00   목록 화면                               푸시 인 1→1.035 (끝까지)
0.35   ⌘K → 팔레트 열림                        outExpo 0.27s, scale .96→1
0.95   "새 캔버스" 타이핑                       9자/s, 시드 지터
2.20   커서가 첫 결과 클릭                      휘는 경로 + 클릭 눌림
3.50   선택한 행 → 전체 캔버스                  모프 inOutExpo 0.8s (안 문구는 3.3에 먼저 퇴장)
4.65   CANVAS READY (라임 1곳)                 outBack, 1.8s 홀드
```
3. 원칙 확인: 한 순간 큰 동작 하나 · 원인 → 결과 · 결과가 보이는 순간을 가장 크게/오래(≥0.8s) · 강조색 한 곳 · 정지 대신 미세 드리프트.
4. 사용자와 대화 중이면 표를 먼저 보여 주고 확인받는다(자율 실행이면 바로 진행).

### 3. 빌드
```bash
node scripts/new-scene.mjs work/scene.html [--size 1080x1920] [--preset lime|coral|paper|glow] [--gsap] [--duration 6]
```
(템플릿 복사 + 크기·프리셋·GSAP 설정). **엔진 블록은 수정하지 않는다.**
- `SCENE = { w, h, fps: 30, duration, loop, beats: [{t, label}] }` — beats는 2단계 표 그대로.
- 바뀌는 문구·숫자·색은 `CONFIG`로 분리.
- 움직임은 둘 중 하나:
  - **render(t)** 순수 함수 (기본): `M.p` `M.io` `M.kf` `M.springTo` `M.cursor` `M.typer` …
  - **GSAP**: head의 gsap 스크립트 주석 해제 → `gsap.timeline({paused:true})` → `SCENE.timeline = tl; M.boot(SCENE, null)` (`render`를 함께 넘기면 seek 후 호출).
- Canvas/WebGL: 시간은 `render(t)`에서만 받는다. 시뮬레이션은 `M.simulate`로 미리 계산.
- 구현 패턴은 `snippets.md`, 수치는 `motion-principles.md`, 색·글자는 `style-system.md`.

#### 엔진 API (`M`)
| 함수 | 용도 |
|---|---|
| `p(t,a,b,ease)` / `io(t,inA,inB,outA,outB)` | 구간 진행도 / 등장→퇴장 |
| `kf(t,[[t,v,ease],…])` | 키프레임 보간 |
| `ease.*` | linear, in/out/inOut Quad·Cubic·Expo, outQuart, in/outBack, spring |
| `springTo(t,v0,[[t,target],…],freq,zeta)` / `springStep` | 닫힌 식 스프링(목표가 여러 번 바뀌어도 t만의 함수) |
| `stagger(i,n,gap,maxSpan)` | 스태거 시작 시각 |
| `catmull(t,keys)` | 키를 부드럽게 통과하는 경로 |
| `simulate(init,step,{hz,duration,snapshot})` | 고정 간격 사전 계산 → `sample(t)` |
| `typer(text,cps,seed)` | 사람 같은 타이핑 문자열 |
| `cursor(el,t,keys)` / `cursorAt` | 휘는 커서 경로 + 클릭 눌림 |
| `count(t,a,b,from,to)` | 카운트업 문자열 |
| `drift(t,amp,period)` · `beat(bpm,n)` · `rand(seed)` · `mixHex(a,b,k)` · `split(el)` | 보조 |

### 4. 검수 — 전체 렌더 전에 반드시
```bash
node scripts/render.mjs work/scene.html --beats   # → work/scene.beats/contact.png
```
`contact.png`를 **이미지로 직접 열어 본다.** 체크:
- 안전 영역(가로 80 / 세로 64px) 이탈, 잘림, 겹침(텍스트끼리·푸터와)
- 등장 전인데 보이는 요소, 이전/다음 문구 겹침
- 읽기 어려운 크기·대비(밝은 강조 띠 위 흰 글자 등), 한 화면 글자 과다
- 강조색 두 곳 이상
- 전환 중간이 의심되면 `--at 2.9,3.4` 로 추가 스틸

고치고 다시 `--beats`. 깨끗해질 때까지 반복. 막히면 `gotchas.md`.

### 5. 자동 점검 → 렌더 → 전달
```bash
node scripts/render.mjs work/scene.html --check   # 린트 + 결정론 + (loop면) 루프 + 페이지 오류
node scripts/render.mjs work/scene.html [--out out.mp4] [--scale 2] [--audio music.mp3] [--gif]
```
- `--check`가 FAIL이면 렌더하지 않고 고친다.
- 기본 출력: H.264 · yuv420p · CRF 16 · faststart · 30fps · 무음, 병렬 4 jobs.
- 전달물: 수정 가능한 `.html` + `.mp4` + `contact.png`, 그리고 "대사 ○○ 직후 삽입" 같은 사용 위치 한 줄.
- 미리보기: HTML을 브라우저로 열면 재생 (space 재생/정지, ←→ 비트, `,` `.` 프레임, `?debug` 시간·안전 영역, `?t=2.5` 고정).

## 프롬프트만 원할 때
다른 AI에 붙여 넣을 프롬프트를 요청하면 `prompt-patterns.md` 템플릿 + `prompt-library.md`의 가까운 원문 밀도로 쓴다:
첫 문장(무엇·기술·캔버스·길이) → 스타일 한 줄(배경·폰트·라벨·강조색 1곳) → 초 단위 비트 → 동작 질감(expo.out 등) → 결정론(paused timeline, t로 재계산) → 꾸며내지 말 것.

## 품질 기준 (전달 전 자가 점검)
- [ ] 소리 없이 3초 안에 메시지가 읽힌다
- [ ] 모든 등장에 이징, `linear`는 회전·진행 바·드리프트뿐
- [ ] 스태거·오버랩으로 요소가 한꺼번에 뜨지 않는다
- [ ] 원인 → 결과가 보이고, 결과에 0.8초 이상 홀드
- [ ] 강조색 한 곳, 텍스트는 헤드라인 1 + 보조 1–2줄
- [ ] 정지 프레임 없음(푸시 인·드리프트)
- [ ] 비트 스틸 전부 그리드 안, 겹침 없음
- [ ] `--check` 전부 OK
- [ ] 로고·수치·앱 결과를 꾸며내지 않았다 (예시는 "예시 값"/"재연 화면" 라벨)

## 환경
- 필요: Node 18+, Playwright(Chromium), ffmpeg. 렌더러는 전역 설치된 playwright도 찾는다.
- 오프라인/CDN 차단: `cdn.jsdelivr.net/npm/…` 요청(Pretendard·Geist·GSAP 등)을 `~/.cache/motion-graphics`에 npm으로 받은 사본으로 자동 대체한다. npm 레지스트리만 열려 있으면 폰트·GSAP가 정상 렌더된다.
