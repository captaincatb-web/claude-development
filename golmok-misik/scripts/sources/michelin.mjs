// 미쉐린 가이드 공식 사이트(서울 셀렉션)에서 스타·빕 구르망 레스토랑을 읽는다.
// 미쉐린 가이드 한국판은 서울·부산만 다루므로 경기도는 수록 대상이 아니다.
import { decodeEntities, mapLimit } from './util.mjs';

const BASE = 'https://guide.michelin.com/kr/ko/seoul-capital-area/kr-seoul/restaurants';
const LISTS = { '3star': '3-stars-michelin', '2star': '2-stars-michelin', '1star': '1-star-michelin', bib: 'bib-gourmand' };
const RANK = { '3star': 0, '2star': 1, '1star': 2, bib: 3 };

export function parseListing(html) {
  const slugs = new Set();
  for (const m of html.matchAll(/\/kr\/ko\/seoul-capital-area\/kr-seoul\/restaurant\/([a-z0-9-]+)/g)) slugs.add(m[1]);
  const hasNext = /\/page\/\d+["']/.test(html) && /pagination/.test(html);
  return { slugs: [...slugs], hasNext };
}

export function parseDetail(html, slug) {
  let name = null, address = null, lat = null, lng = null, cuisine = null;
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const arr = Array.isArray(j) ? j : [j];
      for (const o of arr) {
        if (/Restaurant/i.test(o['@type'] || '')) {
          name = name || o.name;
          const a = o.address || {};
          address = address || [a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean).join(' ') || null;
          if (o.streetAddress) address = address || o.streetAddress;
          lat = lat ?? (Number(o.latitude ?? o.geo?.latitude) || null);
          lng = lng ?? (Number(o.longitude ?? o.geo?.longitude) || null);
          cuisine = cuisine || (Array.isArray(o.servesCuisine) ? o.servesCuisine.join(', ') : o.servesCuisine) || null;
        }
      }
    } catch { /* JSON-LD가 깨져 있으면 아래 정규식으로 대체 */ }
  }
  const text = decodeEntities(html.replace(/<[^>]+>/g, '\n'));
  if (!name) name = (text.match(/\n\s*([^\n]+?)\s*–\s*Seoul/) || [])[1] || null;
  if (!address) address = (text.match(/\n\s*([^\n]*?,\s*Seoul,\s*\d{5},\s*한국)/) || [])[1] || null;
  if (lat == null || lng == null) {
    const ll = html.match(/restaurants\?lat=([\d.]+)&(?:amp;)?lon=([\d.]+)/);
    if (ll) { lat = Number(ll[1]); lng = Number(ll[2]); }
  }
  return { slug, name: name && decodeEntities(name).trim(), address: address && address.trim(), lat, lng, cuisine };
}

export default {
  id: 'michelin',
  minCount: 60,
  scope: '서울(미쉐린 가이드 서울 & 부산). 경기도는 미쉐린 가이드 발간 지역이 아님',
  async fetch({ fetchText, log, today, prev, env = {} }) {
    // 서울 에디션은 매년 2~3월 발표. 등급이 그대로면 이전 연도를 유지하고, 새로 바뀐 경우만 에디션 연도를 쓴다.
    const prevByKey = new Map((prev?.records || []).map((r) => [r.sourceKey, r]));
    const y = Number(today.slice(0, 4));
    const edition = Number(env.MICHELIN_EDITION) || (Number(today.slice(5, 7)) >= 3 ? y : y - 1);
    const distinctionOf = new Map();
    for (const [dist, path] of Object.entries(LISTS)) {
      for (let page = 1; page <= 6; page++) {
        const url = `${BASE}/${path}${page > 1 ? `/page/${page}` : ''}`;
        const html = await fetchText(url);
        const { slugs, hasNext } = parseListing(html);
        for (const s of slugs) if (!distinctionOf.has(s) || RANK[dist] < RANK[distinctionOf.get(s)]) distinctionOf.set(s, dist);
        log(`michelin ${dist} p${page}: ${slugs.length}`);
        if (!hasNext || !slugs.length) break;
      }
    }
    const slugs = [...distinctionOf.keys()];
    const details = await mapLimit(slugs, 3, async (slug) => {
      try {
        return parseDetail(await fetchText(`${BASE.replace('/restaurants', '')}/restaurant/${slug}`), slug);
      } catch (e) {
        log(`michelin detail 실패 ${slug}: ${e.message}`);
        return null;
      }
    });
    const records = details
      .filter((d) => d && d.name && d.address)
      .map((d) => ({
        source: 'michelin',
        sourceKey: `michelin:${d.slug}`,
        name: d.name,
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        coordSource: d.lat != null ? 'michelin' : null,
        menu: d.cuisine ? d.cuisine.split(/,\s*/) : [],
        badge: { distinction: distinctionOf.get(d.slug), year: prevByKey.get(`michelin:${d.slug}`)?.badge?.distinction === distinctionOf.get(d.slug) ? prevByKey.get(`michelin:${d.slug}`).badge.year : edition, sourceUrl: `${BASE.replace('/restaurants', '')}/restaurant/${d.slug}`, checkedAt: today },
      }));
    if (records.length < slugs.length * 0.9) throw new Error(`상세 페이지 응답 부족 ${records.length}/${slugs.length}`);
    return { records, sourceUrls: Object.values(LISTS).map((p) => `${BASE}/${p}`) };
  },
};
