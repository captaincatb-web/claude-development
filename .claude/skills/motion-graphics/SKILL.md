---
name: motion-graphics
description: 코드(HTML·CSS·SVG·Canvas·GSAP)로 모션그래픽 영상을 만들고 MP4로 렌더한다. 숏츠 인서트(1080×830), 세로 광고(1080×1920), 키네틱 타이포, 화면 데모, 전환, 개념 시뮬레이션, 로고 스팅, 루프 영상 요청에 사용. "모션그래픽 만들어줘", "이 문장을 움직이는 영상으로", "숏츠에 넣을 장면", "프롬프트로 영상", "HTML로 애니메이션 녹화" 같은 요청이면 이 스킬을 쓴다. 다른 AI에 붙여 넣을 모션 프롬프트를 써 달라는 요청에도 사용.
---

# Motion Graphics — 코드로 그리는 영상

촬영이 아니라 **코드로 그린 영상**. 한 HTML 파일에 장면을 짜고, 시간 t를 프레임마다 넘겨 캡처해 MP4로 만든다.
결과의 질은 코드보다 **비트 그리드 설계와 검수**에서 나온다.

## 파일

| 경로 | 용도 |
|---|---|
| `templates/scene.html` | 시작 템플릿. 모션 엔진(`M.*`: 이징·구간 진행도·키프레임·스프링·글자 분할·시드 랜덤) + 미리보기(스페이스/←→/스크러버) |
| `scripts/render.mjs` | Playwright 프레임 캡처 → ffmpeg MP4. `--beats` 비트 스틸+콘택트 시트, `--check-loop`, `--gif`, `--scale 2` |
| `examples/code-to-video.html` | 완성 예제 (키커 타이핑 → 마스크 리빌 → 화살표 드로우 → 스프링 스태거 → 형광펜 → 푸시 인 → 루프) |
| `references/motion-principles.md` | 모션 용어 21+조합 4, **숫자 기본값**(길이·이징·스태거) |
| `references/style-system.md` | 포맷·안전 영역·팔레트 프리셋·타이포 스케일 |
| `references/scene-recipes.md` | CHA Motion Kit 172 분석 — 카테고리별 레시피 |
| `references/prompt-patterns.md` | 원문 프롬프트 분석 + 붙여 넣기용 템플릿 |
| `references/gotchas.md` | 렌더 전 필수 점검 목록 |

## 워크플로

### 1. 입력 확인 (빠진 것만 묻기)
- **메시지**: 이 장면이 말해야 할 한 문장 (대사가 있으면 그대로)
- **용도·포맷**: 숏츠 인서트 1080×830(기본) / 세로 1080×1920 / 가로 1920×1080
- **길이**: 인서트 4–7.5초, 개념 시뮬 8–12초, 필름 13–16초
- **스타일**: 팔레트 프리셋(INK-LIME 기본 · INK-CORAL · PAPER · GLOW) 또는 참고 이미지
- **에셋**: 로고·스크린 녹화·이미지 (없으면 슬롯으로 비워 둠 — 실제 결과를 꾸며내지 않는다)
- 루프 여부, BPM(음악 싱크 시)

요청에 이미 충분하면 묻지 말고 합리적 기본값으로 진행하고 가정을 한 줄로 밝힌다.

### 2. 비트 그리드 + 상태 목록 (코드 쓰기 전에 보여 주기)
`references/scene-recipes.md`에서 가까운 레시피를 고르고, 초 단위 표로 설계한다:

```
t      상태                                 기법
0.00   빈 화면 + 모서리 라벨                 —
0.15   키커 타이핑 "$ 먼저 알아 둘 것"         타이핑 0.04s/자
0.70   "코드" 아래에서 마스크 리빌             outExpo 0.65s
1.35   화살표 예비동작 → 드로우               anticipation + stroke-dash
2.00   "영상" 글자별 스프링 착지              stagger 0.09s
2.90   서브 2줄 리빌 → 형광펜(강조 1곳)        overlap 0.08s
3.60   홀드 + 푸시 인 1→1.06 (읽는 시간)       inOutQuad
5.80   퇴장 → t=0과 동일 상태(루프)            inCubic
```

원칙: 한 순간 큰 동작 하나 · 원인 → 결과 · 결과가 보이는 순간을 가장 크게/오래 · 강조색 한 곳 · 정지 대신 미세 드리프트.
사용자가 대화 중이면 이 표를 먼저 보여 주고 확인받는다(자율 실행이면 바로 진행).

### 3. 빌드
`templates/scene.html`을 복사해 작업 파일을 만든다. 엔진 블록은 건드리지 않는다.
- `SCENE = { w, h, fps: 30, duration, beats: [{t, label}] }` — beats는 2단계의 표 그대로.
- 움직임은 둘 중 하나로:
  - **render(t)** 순수 함수: `M.p(t,a,b,ease)` 구간 진행도, `M.io()` 등장/퇴장, `M.kf()` 키프레임, `M.ease.spring`.
  - **GSAP**: `gsap.timeline({paused:true})`로 짜고 `SCENE.timeline = tl; M.boot(SCENE, null)`. CDN이 막혀도 렌더러가 로컬 사본으로 대체.
- 바뀌는 문구·숫자·색은 상단 `CONFIG`로 분리.
- 수치는 `references/motion-principles.md`, 색·글자는 `references/style-system.md`를 따른다.
- 결정론 필수: CSS transition/animation, setTimeout, Date.now, Math.random 금지 (`M.rand(seed)` 사용). 시뮬레이션은 입력을 고정하고 t까지 처음부터 재계산.

### 4. 비트 검수 (전체 렌더 전에 반드시)
```bash
node scripts/render.mjs work/scene.html --beats      # work/scene.beats/contact.png
```
`contact.png`를 **직접 이미지로 열어 본다**. 체크:
- 안전 영역(가로 80 / 세로 64px) 밖으로 나가거나 잘린 요소
- 겹침(텍스트끼리, 텍스트와 푸터), 등장 전인데 보이는 요소
- 읽기 어려운 크기·대비, 한 화면에 글자가 너무 많음
- 강조색이 두 곳 이상
- 전환 중간 프레임이 필요하면 `--at 1.2,1.4` 로 추가 확인

문제를 고치고 다시 `--beats`. 깨끗해질 때까지 반복한다. `references/gotchas.md`도 대조.

### 5. 렌더 & 전달
```bash
node scripts/render.mjs work/scene.html --check-loop   # 루프 장면일 때
node scripts/render.mjs work/scene.html --out out/scene.mp4 [--gif] [--scale 2]
```
- 기본: H.264 · yuv420p · CRF 16 · faststart · 무음 · 30fps.
- 전달물: `scene.html`(수정 가능한 원본) + `scene.mp4` + `contact.png`. 어디에 삽입하면 좋은지(대사 직후 등) 한 줄.
- 미리보기: HTML을 브라우저로 열면 재생된다 (`?debug` 시간·비트 표시, `?t=2.5` 특정 시점 고정).

## 프롬프트만 원할 때
다른 AI(Claude 앱 등)에 붙여 넣을 프롬프트를 요청하면 `references/prompt-patterns.md`의 템플릿으로 작성한다: 첫 문장(무엇·기술·캔버스·길이) → 스타일 한 줄 → 초 단위 비트 → 동작 질감 → 결정론/탐색 가능 → 꾸며내지 말 것. 긴 장면은 `<build>/<gotchas>/<start>` 블록까지.

## 품질 기준 (전달 전 자가 점검)
- [ ] 소리 없이 봐도 메시지가 3초 안에 읽힌다
- [ ] 모든 등장에 이징이 있고 `linear`는 회전·진행 바뿐
- [ ] 스태거·오버랩으로 요소가 한꺼번에 뜨지 않는다
- [ ] 핵심 결과에 0.8초 이상 홀드
- [ ] 강조색은 한 곳, 텍스트는 헤드라인 1 + 보조 1–2줄
- [ ] 비트 스틸 모두 그리드 안, 겹침 없음
- [ ] 루프 장면은 `LOOP OK`
- [ ] 로고·수치·앱 화면을 꾸며내지 않았다 (예시 값은 "예시 값" 라벨)

## 환경 메모
- 필요: Node 18+, Playwright(Chromium), ffmpeg. 렌더러는 전역 설치된 playwright도 찾는다.
- 폰트 CDN이 막힌 환경에선 시스템 폰트로 대체되어 렌더된다. 최종본은 Pretendard 로컬 woff2를 `@font-face`로 넣는 것을 권장.
