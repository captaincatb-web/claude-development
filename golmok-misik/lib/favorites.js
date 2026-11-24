// 즐겨찾기는 ID와 함께 상호·주소 스냅숏을 저장한다.
// 데이터가 갱신돼 ID가 합쳐지거나(idAliases) 목록에서 빠져도(retired) 즐겨찾기는 지워지지 않는다.
export const FAV_KEY = 'golmok:favorites:v1';

export function loadFavorites(storage) {
  try {
    const raw = storage?.getItem(FAV_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export function saveFavorites(storage, favs) {
  try {
    storage?.setItem(FAV_KEY, JSON.stringify(favs));
    return true;
  } catch {
    return false;
  }
}

export function toggleFavorite(favs, r, now = new Date().toISOString()) {
  const next = { ...favs };
  if (next[r.id]) delete next[r.id];
  else next[r.id] = { name: r.name, branch: r.branch || null, address: r.roadAddress || r.jibunAddress || '', savedAt: now };
  return next;
}

// 저장된 즐겨찾기를 현재 데이터에 다시 연결한다. 합쳐진 ID는 새 ID로 옮겨 저장한다.
export function resolveFavorites(favs, data) {
  const active = new Map((data.restaurants || []).map((r) => [r.id, r]));
  const retired = new Map((data.retired || []).map((r) => [r.id, r]));
  const aliases = data.idAliases || {};
  const migrated = {};
  const items = [];
  for (const [id, snap] of Object.entries(favs)) {
    let cur = id;
    const seen = new Set();
    while (aliases[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = aliases[cur];
    }
    migrated[cur] = { ...snap, ...(migrated[cur] || {}) };
    if (active.has(cur)) items.push({ id: cur, state: 'active', restaurant: active.get(cur) });
    else if (retired.has(cur)) items.push({ id: cur, state: 'retired', restaurant: retired.get(cur), snapshot: snap });
    else items.push({ id: cur, state: 'missing', snapshot: snap });
  }
  return { favorites: migrated, items };
}
