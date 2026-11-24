import { GUIDES } from './guides.js';
import { isKnownRegion, coordFitsRegion } from './regions.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isHttpsUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' || x.protocol === 'http:';
  } catch {
    return false;
  }
}

// 배포 전에 데이터 전체를 검사한다. errors가 하나라도 있으면 반영하지 않는다.
export function validateDataset(data, previous = null) {
  const errors = [];
  const warnings = [];
  const list = data?.restaurants;
  if (!Array.isArray(list)) return { ok: false, errors: ['restaurants 배열 없음'], warnings };
  const ids = new Set();
  const entities = new Set();
  const badgeKeys = new Map();
  for (const r of list) {
    const tag = `${r.id || '?'}(${r.name || '?'})`;
    if (!/^gm-[0-9a-f]{8}$/.test(r.id || '')) errors.push(`${tag}: ID 형식 오류`);
    if (ids.has(r.id)) errors.push(`${tag}: ID 중복`);
    ids.add(r.id);
    if (!r.name) errors.push(`${tag}: 상호 없음`);
    if (!isKnownRegion(r.sido, r.sigungu)) errors.push(`${tag}: 서울·경기 범위 밖이거나 시군구 불명 (${r.sido} ${r.sigungu})`);
    if (!r.roadAddress && !r.jibunAddress) errors.push(`${tag}: 주소 없음`);
    if (entities.has(r.entityKey)) errors.push(`${tag}: 같은 상호·주소 중복`);
    entities.add(r.entityKey);
    const hasLat = r.lat !== null && r.lat !== undefined;
    const hasLng = r.lng !== null && r.lng !== undefined;
    if (hasLat !== hasLng) errors.push(`${tag}: 위도·경도 중 하나만 있음`);
    if (hasLat && hasLng && !coordFitsRegion(r.sido, r.sigungu, r.lat, r.lng)) errors.push(`${tag}: 좌표가 ${r.sido} ${r.sigungu} 범위 밖 (${r.lat}, ${r.lng})`);
    if (hasLat && !r.coordSource) errors.push(`${tag}: 좌표 출처 없음`);
    if (!Array.isArray(r.badges) || !r.badges.length) errors.push(`${tag}: 가이드 배지 없음`);
    for (const b of r.badges || []) {
      if (!GUIDES[b.guide]) errors.push(`${tag}: 알 수 없는 가이드 ${b.guide}`);
      if (!isHttpsUrl(b.sourceUrl)) errors.push(`${tag}: ${b.guide} 출처 URL 오류`);
      if (!DATE_RE.test(b.checkedAt || '')) errors.push(`${tag}: ${b.guide} 확인일 오류`);
      const bk = `${b.guide}|${b.sourceKey}`;
      if (badgeKeys.has(bk)) errors.push(`${tag}: 같은 출처 항목(${bk})이 ${badgeKeys.get(bk)}에도 붙어 있음`);
      badgeKeys.set(bk, r.id);
    }
  }
  // 기존 ID 보존: 이전 데이터의 모든 ID는 활성/retired/idAliases 중 하나에 남아 있어야 한다.
  if (previous) {
    const retired = new Set((data.retired || []).map((r) => r.id));
    const aliases = data.idAliases || {};
    for (const r of [...(previous.restaurants || []), ...(previous.retired || [])]) {
      if (!ids.has(r.id) && !retired.has(r.id) && !aliases[r.id]) errors.push(`${r.id}(${r.name}): 기존 ID가 사라짐`);
    }
    const prevCount = (previous.restaurants || []).length;
    if (prevCount >= 20 && list.length < prevCount * 0.7) errors.push(`활성 식당 수 급감 ${prevCount} → ${list.length} (불완전 응답 의심)`);
  }
  if (!list.length) errors.push('식당이 0곳');
  return { ok: errors.length === 0, errors, warnings };
}
