// 여러 출처의 레코드를 "같은 지점" 단위로 합치고, 기존 ID를 최대한 유지한다.
import { parseAddress, splitBranch, normName } from './address.js';
import { SOURCE_PRIORITY } from './guides.js';
import { distanceKm } from './regions.js';

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const ch of str) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// 지번↔도로명 대응표(같은 건물임이 출처에서 확인된 것만)로 주소 키를 하나로 맞춘다.
export function canonicalKey(parsedRoad, parsedJibun, aliases = {}) {
  if (parsedRoad?.kind === 'road') return parsedRoad.key;
  const j = parsedJibun?.kind === 'jibun' ? parsedJibun : parsedRoad?.kind === 'jibun' ? parsedRoad : null;
  if (j) return aliases[j.key] || j.key;
  return null;
}

function prio(source) {
  const i = SOURCE_PRIORITY.indexOf(source);
  return i === -1 ? 99 : i;
}

export function prepareRecord(rec, aliases) {
  const pRoad = parseAddress(rec.address);
  const pJibun = rec.jibunAddress ? parseAddress(rec.jibunAddress) : null;
  const main = pRoad?.sigungu ? pRoad : pJibun;
  if (!main?.sido || !main?.sigungu) return { rec, error: 'region' };
  const addrKey = canonicalKey(pRoad, pJibun, aliases);
  if (!addrKey) return { rec, error: 'address' };
  const { base, branch } = splitBranch(rec.name);
  const nk = normName(rec.name);
  if (!nk) return { rec, error: 'name' };
  return {
    rec,
    pRoad,
    pJibun,
    sido: main.sido,
    sigungu: main.sigungu,
    gu: main.gu || null,
    addrKey,
    entityKey: `${nk}@${addrKey}`,
    base,
    branch,
  };
}

export function mergeRecords(records, previous = null, { aliases = {}, today } = {}) {
  const report = { excluded: [], added: [], updated: [], addressChanged: [], retired: [], revived: [], merged: [], review: [] };
  const groups = new Map();
  for (const rec of records) {
    const p = prepareRecord(rec, aliases);
    if (p.error) {
      report.excluded.push({ source: rec.source, sourceKey: rec.sourceKey, name: rec.name, address: rec.address, reason: p.error });
      continue;
    }
    if (!groups.has(p.entityKey)) groups.set(p.entityKey, []);
    groups.get(p.entityKey).push(p);
  }

  const prevList = previous?.restaurants || [];
  const prevRetired = previous?.retired || [];
  const prevAliases = { ...(previous?.idAliases || {}) };
  const bySourceKey = new Map();
  const byEntity = new Map();
  const prevById = new Map();
  for (const r of [...prevList, ...prevRetired]) {
    prevById.set(r.id, r);
    if (r.entityKey) byEntity.set(r.entityKey, r.id);
    for (const b of r.badges || r.lastBadges || []) if (b.sourceKey) bySourceKey.set(b.sourceKey, r.id);
  }

  const used = new Set();
  const out = [];
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [entityKey, items] of sortedGroups) {
    items.sort((a, b) => prio(a.rec.source) - prio(b.rec.source) || String(a.rec.sourceKey).localeCompare(String(b.rec.sourceKey)));
    // 1) 출처 키로 이전 ID 찾기 2) 상호+주소 키로 찾기 3) 새 ID
    const candidates = [...new Set(items.map((p) => bySourceKey.get(p.rec.sourceKey)).filter((id) => id && !used.has(id)))].sort();
    let id = null;
    if (candidates.length) {
      id = candidates[0];
      for (const other of candidates.slice(1)) {
        prevAliases[other] = id;
        report.merged.push({ from: other, into: id });
      }
    } else if (byEntity.has(entityKey) && !used.has(byEntity.get(entityKey))) {
      id = byEntity.get(entityKey);
    } else {
      id = `gm-${fnv1a(entityKey)}`;
      let n = 1;
      while (used.has(id) || (prevById.has(id) && prevById.get(id).entityKey !== entityKey)) id = `gm-${fnv1a(entityKey + '#' + n++)}`;
    }
    used.add(id);

    const head = items[0];
    const badges = [];
    const seenBadge = new Set();
    for (const p of items) {
      const k = `${p.rec.source}|${p.rec.sourceKey}`;
      if (seenBadge.has(k)) continue;
      seenBadge.add(k);
      badges.push({ guide: p.rec.source, sourceKey: p.rec.sourceKey, ...p.rec.badge });
    }
    badges.sort((a, b) => prio(a.guide) - prio(b.guide) || String(a.sourceKey).localeCompare(String(b.sourceKey)));

    // 좌표: 출처가 좌표를 준 경우만 사용. 서로 150m 이상 다르면 검토 대상으로 남긴다.
    const withCoord = items.filter((p) => typeof p.rec.lat === 'number' && typeof p.rec.lng === 'number');
    let lat = null;
    let lng = null;
    let coordSource = null;
    if (withCoord.length) {
      lat = withCoord[0].rec.lat;
      lng = withCoord[0].rec.lng;
      coordSource = withCoord[0].rec.coordSource || withCoord[0].rec.source;
      for (const p of withCoord.slice(1)) {
        const d = distanceKm(lat, lng, p.rec.lat, p.rec.lng);
        if (d > 0.15) report.review.push({ type: 'coord-mismatch', id, name: head.base, distanceM: Math.round(d * 1000) });
      }
    }

    const menu = [...new Set(items.flatMap((p) => p.rec.menu || []).filter(Boolean))];
    const road = items.find((p) => p.pRoad?.kind === 'road')?.pRoad || null;
    const jibun = items.map((p) => (p.pJibun?.kind === 'jibun' ? p.pJibun : p.pRoad?.kind === 'jibun' ? p.pRoad : null)).find(Boolean) || null;
    const detail = items.map((p) => p.pRoad?.detail).find(Boolean) || '';
    const dong = items.map((p) => p.pRoad?.dong || p.pJibun?.dong).find(Boolean) || null;
    const prev = prevById.get(id);
    const restaurant = {
      id,
      name: head.base,
      branch: items.map((p) => p.branch).find(Boolean) || null,
      menu,
      sido: head.sido,
      sigungu: head.sigungu,
      gu: head.gu,
      dong,
      roadAddress: road ? road.display + (detail ? ` ${detail}` : '') : null,
      jibunAddress: jibun ? jibun.display : null,
      entityKey,
      lat,
      lng,
      coordSource,
      badges,
      firstSeen: prev?.firstSeen || today,
    };
    if (prev?.addressHistory) restaurant.addressHistory = [...prev.addressHistory];
    if (prev && prev.entityKey && prev.entityKey !== entityKey) {
      const oldAddr = prev.roadAddress || prev.jibunAddress;
      const newAddr = restaurant.roadAddress || restaurant.jibunAddress;
      if (prev.entityKey.split('@')[1] !== entityKey.split('@')[1]) {
        restaurant.addressHistory = [...(restaurant.addressHistory || []), { address: oldAddr, until: today }];
        report.addressChanged.push({ id, name: restaurant.name, from: oldAddr, to: newAddr });
      }
    }
    if (!prev) report.added.push({ id, name: restaurant.name, sigungu: restaurant.sigungu });
    else if (prevRetired.some((r) => r.id === id)) report.revived.push({ id, name: restaurant.name });
    else if (JSON.stringify(stripVolatile(prev)) !== JSON.stringify(stripVolatile(restaurant))) report.updated.push({ id, name: restaurant.name });
    out.push(restaurant);
  }

  // 이번 자료에 없는 이전 지점은 지우지 않고 retired로 옮긴다(즐겨찾기 보존).
  const retired = [];
  const activeIds = new Set(out.map((r) => r.id));
  for (const r of prevRetired) if (!activeIds.has(r.id) && !prevAliases[r.id]) retired.push(r);
  for (const r of prevList) {
    if (activeIds.has(r.id) || prevAliases[r.id]) continue;
    retired.push({
      id: r.id,
      name: r.name,
      branch: r.branch || null,
      sido: r.sido,
      sigungu: r.sigungu,
      roadAddress: r.roadAddress,
      jibunAddress: r.jibunAddress,
      entityKey: r.entityKey,
      lastBadges: r.badges,
      retiredAt: today,
    });
    report.retired.push({ id: r.id, name: r.name });
  }
  retired.sort((a, b) => a.id.localeCompare(b.id));

  // 검토 목록: 같은 상호·같은 시군구인데 한쪽은 지번, 한쪽은 도로명이라 자동 대조가 안 된 경우
  const byName = new Map();
  for (const r of out) {
    const k = `${r.entityKey.split('@')[0]}|${r.sido}|${r.sigungu}`;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  for (const list of byName.values()) {
    if (list.length < 2) continue;
    const kinds = new Set(list.map((r) => (r.roadAddress ? 'road' : 'jibun')));
    if (kinds.size > 1) report.review.push({ type: 'road-vs-jibun', ids: list.map((r) => r.id), name: list[0].name, note: '도로명/지번 표기가 달라 같은 지점인지 확인 필요(자동 병합 안 함)' });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return { restaurants: out, retired, idAliases: sortObj(prevAliases), report };
}

function stripVolatile(r) {
  const { firstSeen, addressHistory, ...rest } = r;
  return { ...rest, badges: (r.badges || []).map(({ checkedAt, ...b }) => b) };
}

function sortObj(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
