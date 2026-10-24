# claude-development

## Skills

### [`motion-graphics`](.claude/skills/motion-graphics/SKILL.md)
코드(HTML·Canvas·WebGL·GSAP)로 모션그래픽을 설계 → 비트 스틸 검수 → 결정론 점검 → MP4 렌더하는 스킬.

```bash
cd .claude/skills/motion-graphics
node scripts/new-scene.mjs work/hook.html --preset lime        # 새 장면
node scripts/render.mjs work/hook.html --beats                 # 비트별 스틸 + 콘택트 시트
node scripts/render.mjs work/hook.html --check                 # 린트·결정론·루프 점검
node scripts/render.mjs work/hook.html                         # MP4
```

예제(`examples/`): 키네틱 타이포 루프 · 명령 팔레트 UI 데모 · GSAP 128 BPM 타이포 · 결정론적 물리 시뮬레이션.
