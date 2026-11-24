export const GUIDES = {
  michelin: { label: '미쉐린', long: '미쉐린 가이드', color: '#c8102e' },
  bluer: { label: '블루리본', long: '블루리본 서베이', color: '#1f5fbf' },
  lifemaster: { label: '생활의 달인', long: 'SBS 생활의 달인', color: '#e07b00' },
  baeknyeon: { label: '백년가게', long: '백년가게(중기부·소진공)', color: '#7a5a2f' },
};
export const GUIDE_ORDER = ['michelin', 'bluer', 'lifemaster', 'baeknyeon'];
// 같은 지점에서 좌표·대표 상호를 고를 때의 우선순위
export const SOURCE_PRIORITY = ['michelin', 'baeknyeon', 'bluer', 'lifemaster'];

export function badgeText(b) {
  if (b.guide === 'michelin') {
    const d = { '3star': '3스타', '2star': '2스타', '1star': '1스타', bib: '빕 구르망', selected: '선정' }[b.distinction] || '';
    return `미쉐린 ${d}${b.year ? ` ${b.year}` : ''}`.trim();
  }
  if (b.guide === 'lifemaster') return `생활의 달인${b.episode ? ` ${b.episode}회` : ''}`;
  if (b.guide === 'baeknyeon') return `백년가게${b.year ? ` ${b.year}` : ''}`;
  if (b.guide === 'bluer') return `블루리본${b.ribbons ? ` ${b.ribbons}개` : ''}${b.year ? ` ${b.year}` : ''}`;
  return b.guide;
}
