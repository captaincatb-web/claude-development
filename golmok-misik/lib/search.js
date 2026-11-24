import { GUIDES } from './guides.js';

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

export function haystack(r) {
  return norm([
    r.name, r.branch, ...(r.menu || []), r.sido, r.sigungu, r.gu, r.dong, r.roadAddress, r.jibunAddress,
    ...(r.badges || []).map((b) => GUIDES[b.guide]?.label),
  ].filter(Boolean).join(' '));
}

// filters: { sido, sigungu, q, guides: Set|[], favoritesOnly, favorites: Set }
// 가이드는 여러 개 고르면 "하나라도 해당"(OR)으로 거른다.
export function filterRestaurants(list, f = {}) {
  const guides = new Set(f.guides || []);
  const terms = String(f.q || '').trim().split(/\s+/).filter(Boolean).map(norm);
  return list.filter((r) => {
    if (f.sido && r.sido !== f.sido) return false;
    if (f.sigungu && r.sigungu !== f.sigungu) return false;
    if (guides.size && !(r.badges || []).some((b) => guides.has(b.guide))) return false;
    if (f.favoritesOnly && !f.favorites?.has(r.id)) return false;
    if (terms.length) {
      const h = r._hay || haystack(r);
      if (!terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });
}

export function sortRestaurants(list) {
  const rank = (r) => -((r.badges || []).length * 10 + (r.lat != null ? 1 : 0));
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko'));
}
