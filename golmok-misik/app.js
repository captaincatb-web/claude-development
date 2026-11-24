import { GUIDES, GUIDE_ORDER, badgeText } from './lib/guides.js';
import { REGIONS, sigunguList } from './lib/regions.js';
import { filterRestaurants, sortRestaurants, haystack } from './lib/search.js';
import { naverMapUrl } from './lib/links.js';
import { loadFavorites, saveFavorites, toggleFavorite, resolveFavorites } from './lib/favorites.js';
import { createMap } from './map.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PAGE = 120;
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>';

const state = {
  data: { restaurants: [], retired: [], idAliases: {} },
  meta: null,
  byId: new Map(),
  q: '',
  sido: '',
  sigungu: '',
  guides: new Set(),
  favoritesOnly: false,
  favs: {},
  shown: PAGE,
  selected: null,
  map: null,
  filtered: [],
};

let storage = null;
try { storage = window.localStorage; } catch { storage = null; }

function topGuide(r) {
  return GUIDE_ORDER.find((g) => r.badges.some((b) => b.guide === g));
}
function guideCount(r) {
  return new Set(r.badges.map((b) => b.guide)).size;
}
function badgesHtml(r) {
  const seen = new Set();
  return r.badges
    .filter((b) => (seen.has(b.guide + (b.episode || '')) ? false : seen.add(b.guide + (b.episode || ''))))
    .map((b) => `<span class="badge b-${b.guide}">${esc(badgeText(b))}</span>`)
    .join('');
}
function place(r) {
  return [r.sigungu, r.gu, r.dong].filter(Boolean).join(' ');
}

function renderChips() {
  const counts = Object.fromEntries(GUIDE_ORDER.map((g) => [g, 0]));
  const base = filterRestaurants(state.data.restaurants, { sido: state.sido, sigungu: state.sigungu, q: state.q });
  for (const r of base) for (const g of new Set(r.badges.map((b) => b.guide))) counts[g]++;
  const favN = Object.keys(state.favs).length;
  $('#guideChips').innerHTML =
    GUIDE_ORDER.map((g) => `<button type="button" class="chip" data-guide="${g}" aria-pressed="${state.guides.has(g)}" style="--c:var(--${g})"><span class="dot"></span>${GUIDES[g].label}<span class="n">${counts[g]}</span></button>`).join('') +
    `<button type="button" class="chip" data-fav aria-pressed="${state.favoritesOnly}" style="--c:#f2b01e"><span class="dot"></span>즐겨찾기<span class="n">${favN}</span></button>`;
}

function cardHtml(r) {
  const fav = Boolean(state.favs[r.id]);
  const menu = (r.menu || []).slice(0, 3).join(' · ');
  return `<li class="card" data-id="${r.id}" ${state.selected === r.id ? 'aria-current="true"' : ''}>
    <button type="button" class="open" aria-label="${esc(r.name)} 상세 보기"></button>
    <h3>${esc(r.name)}${r.branch ? `<span class="branch">${esc(r.branch)}</span>` : ''}</h3>
    <div class="badges">${badgesHtml(r)}</div>
    <p class="sub">${esc(menu)}${menu ? ' · ' : ''}${esc(place(r))}${r.lat == null ? '<span class="nopin" title="출처에 좌표가 없어 지도 핀을 표시하지 않습니다">위치 미확인</span>' : ''}</p>
    <p class="addr">${esc(r.roadAddress || r.jibunAddress)}</p>
    <button type="button" class="fav" data-fav-id="${r.id}" aria-pressed="${fav}" aria-label="${fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">${STAR_SVG}</button>
  </li>`;
}

function ghostCardHtml(item) {
  const s = item.restaurant || item.snapshot || {};
  const addr = s.roadAddress || s.jibunAddress || item.snapshot?.address || '';
  const q = naverMapUrl({ name: s.name || item.snapshot?.name, branch: s.branch, roadAddress: addr, sido: s.sido || '', sigungu: s.sigungu || '' });
  return `<li class="card ghosted" data-ghost="${item.id}">
    <h3>${esc(s.name || item.snapshot?.name)}</h3>
    <p class="addr">${esc(addr)}</p>
    <p class="state">${item.state === 'retired' ? '최근 갱신에서 가이드 목록에 없어 지도에서 내렸습니다. 즐겨찾기는 그대로 보관합니다.' : '현재 데이터에서 찾을 수 없습니다. 저장해 둔 정보로 보여 줍니다.'}</p>
    <p class="sub"><a href="${q}" target="_blank" rel="noopener">네이버지도에서 찾기</a></p>
    <button type="button" class="fav" data-fav-id="${item.id}" aria-pressed="true" aria-label="즐겨찾기 해제">${STAR_SVG}</button>
  </li>`;
}

function applyFilters({ fit = false } = {}) {
  const favSet = new Set(Object.keys(state.favs));
  state.filtered = sortRestaurants(
    filterRestaurants(state.data.restaurants, { q: state.q, sido: state.sido, sigungu: state.sigungu, guides: state.guides, favoritesOnly: state.favoritesOnly, favorites: favSet }),
  );
  const list = state.filtered;
  const onMap = list.filter((r) => r.lat != null);
  $('#count').innerHTML = `<b>${list.length}</b>곳 · 지도 표시 ${onMap.length}곳 · 위치 미확인 ${list.length - onMap.length}곳`;
  let html = list.slice(0, state.shown).map(cardHtml).join('');
  if (state.favoritesOnly) {
    const { items } = resolveFavorites(state.favs, state.data);
    html += items.filter((i) => i.state !== 'active').map(ghostCardHtml).join('');
  }
  $('#list').innerHTML = html;
  $('#more').hidden = list.length <= state.shown;
  $('#empty').hidden = Boolean(html);
  renderChips();
  if (state.map) {
    state.map.setPoints(onMap.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, name: r.name, color: GUIDES[topGuide(r)]?.color, guides: guideCount(r) })));
    if (fit) state.map.fit(onMap);
  }
}

function sourceItem(b) {
  const g = GUIDES[b.guide];
  const bits = [];
  if (b.guide === 'lifemaster') {
    if (b.title) bits.push(esc(b.title));
    if (b.airDate) bits.push(`방송 ${b.airDate}`);
    else if (b.postedAt) bits.push(`게시 ${b.postedAt}`);
  }
  if (b.year && b.guide !== 'michelin') bits.push(`${b.year}년 선정`);
  bits.push(`확인일 ${b.checkedAt}`);
  const ev = (b.evidenceUrls || []).map((u, i) => ` · <a href="${esc(u)}" target="_blank" rel="noopener">보조 자료${i + 1}</a>`).join('');
  return `<li><span class="badge b-${b.guide}">${esc(badgeText(b))}</span>
    <div><a href="${esc(b.sourceUrl)}" target="_blank" rel="noopener">${esc(g.long)} 출처 보기</a>${ev}</div>
    <div class="meta">${bits.join(' · ')}</div>${b.note ? `<div class="meta">${esc(b.note)}</div>` : ''}</li>`;
}

function openDetail(id, from) {
  const r = state.byId.get(id);
  if (!r) return;
  state.selected = id;
  const fav = Boolean(state.favs[id]);
  $('#detailBody').innerHTML = `
    <div class="head">
      <div style="flex:1;min-width:0">
        <h2 id="detailName">${esc(r.name)}${r.branch ? ` <small style="font-weight:500;color:var(--muted);font-size:14px">${esc(r.branch)}</small>` : ''}</h2>
        <div class="badges" style="margin-top:6px">${badgesHtml(r)}</div>
      </div>
      <button type="button" class="fav" data-fav-id="${r.id}" aria-pressed="${fav}" aria-label="${fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">${STAR_SVG}</button>
      <button type="button" class="icon close" data-close-detail aria-label="닫기">✕</button>
    </div>
    <dl>
      ${r.menu?.length ? `<dt>메뉴</dt><dd>${esc(r.menu.join(', '))}</dd>` : ''}
      <dt>주소</dt><dd>${esc(r.roadAddress || r.jibunAddress)}${r.roadAddress && r.jibunAddress ? `<br><span style="color:var(--muted)">지번 ${esc(r.jibunAddress)}</span>` : ''}</dd>
      <dt>지역</dt><dd>${esc(r.sido === '서울' ? '서울특별시' : '경기도')} ${esc(place(r))}</dd>
      ${r.addressHistory?.length ? `<dt>이전 주소</dt><dd>${r.addressHistory.map((h) => esc(h.address)).join('<br>')}</dd>` : ''}
    </dl>
    ${r.lat == null ? '<p class="note">출처 자료에 좌표가 없어 지도 핀을 찍지 않았습니다. 아래 버튼으로 네이버지도에서 상호·주소를 검색해 위치를 확인하세요.</p>' : ''}
    <div class="actions"><a class="btn primary" href="${naverMapUrl(r)}" target="_blank" rel="noopener">네이버지도에서 보기</a></div>
    <h3 style="font-size:14px;margin:18px 0 0">가이드별 출처</h3>
    <ul class="sources">${r.badges.map(sourceItem).join('')}</ul>`;
  const d = $('#detail');
  const top = document.querySelector('.layout').getBoundingClientRect().top;
  d.style.setProperty('--detail-top', `${Math.max(0, top)}px`);
  d.hidden = false;
  document.querySelectorAll('.card[aria-current]').forEach((c) => c.removeAttribute('aria-current'));
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) {
    card.setAttribute('aria-current', 'true');
    if (from === 'map') card.scrollIntoView({ block: 'nearest' });
  }
  if (state.map && r.lat != null) state.map.select(id, { pan: from !== 'map' });
  else state.map?.select(null, { pan: false });
  if (from !== 'map') d.querySelector('[data-close-detail]')?.focus({ preventScroll: true });
}

function closeDetail() {
  $('#detail').hidden = true;
  const id = state.selected;
  state.selected = null;
  state.map?.select(null, { pan: false });
  document.querySelector(`.card[data-id="${id}"] .open`)?.focus({ preventScroll: true });
}

function toggleFav(id) {
  const r = state.byId.get(id) || (state.data.retired || []).find((x) => x.id === id) || { id, ...(state.favs[id] || {}) };
  state.favs = toggleFavorite(state.favs, r);
  saveFavorites(storage, state.favs);
  document.querySelectorAll(`[data-fav-id="${id}"]`).forEach((b) => {
    const on = Boolean(state.favs[id]);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? '즐겨찾기 해제' : '즐겨찾기 추가');
  });
  if (state.favoritesOnly) applyFilters();
  else renderChips();
}

function renderCoverage() {
  const m = state.meta;
  if (!m) { $('#coverageBody').innerHTML = '<p>자료 현황 정보를 불러오지 못했습니다.</p>'; return; }
  const st = { ok: ['정상', 'ok'], failed: ['최근 조회 실패 · 이전 자료 유지', 'failed'], manual: ['수동 확인 자료', ''], unlicensed: ['이용 권한 필요', ''], unknown: ['미확인', ''] };
  $('#coverageBody').innerHTML = `
    <div class="totals"><span><b>${m.totals.restaurants}</b>곳</span><span><b>${m.totals.onMap}</b>곳 지도 표시</span><span><b>${m.totals.noCoord}</b>곳 위치 미확인</span><span><b>${m.totals.multiBadge}</b>곳 복수 배지</span></div>
    <p style="margin:0 0 12px;color:var(--muted);font-size:13px">데이터 반영일 ${esc(m.generatedAt)} · 매주 화요일 오전 11시(한국시간) 자동 확인</p>
    <div class="cov-grid">${GUIDE_ORDER.map((g) => {
      const x = m.guides[g];
      const [label, cls] = st[x.status] || [x.status, ''];
      return `<section class="cov">
        <h3><span class="badge b-${g}">${GUIDES[g].label}</span> <span class="st ${cls}">${esc(label)}</span></h3>
        <div><span class="num">${x.restaurants}</span>곳 <span style="color:var(--muted)">(서울 ${x.bySido.서울} · 경기 ${x.bySido.경기} · 지도 표시 ${x.onMap})</span></div>
        <div style="color:var(--muted);font-size:13px;margin-top:4px">자료 기준일 ${x.asOf ? (x.asOf.from === x.asOf.to ? x.asOf.from : `${x.asOf.from} ~ ${x.asOf.to}`) : '—'}${x.lastAttempt ? ` · 마지막 확인 ${x.lastAttempt}` : ''}</div>
        ${x.note ? `<div style="font-size:13px;margin-top:4px">${esc(x.note)}</div>` : ''}
        <ul>${x.missing.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        ${x.sourceUrls?.length ? `<div style="font-size:12.5px;margin-top:6px">${x.sourceUrls.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">출처 ${i + 1}</a>`).join(' · ')}</div>` : ''}
      </section>`;
    }).join('')}</div>
    ${m.review?.length ? `<p style="font-size:13px;color:var(--muted);margin-top:12px">검토 대기 ${m.review.length}건(도로명/지번 대조, 좌표 불일치 등)은 자동 병합하지 않았습니다.</p>` : ''}`;
}

function fillSigungu() {
  const sel = $('#sigungu');
  const list = state.sido ? sigunguList(state.sido) : [];
  const counts = {};
  for (const r of state.data.restaurants) if (r.sido === state.sido) counts[r.sigungu] = (counts[r.sigungu] || 0) + 1;
  sel.innerHTML = `<option value="">${state.sido ? `${state.sido} 전체` : '시·군·구 전체'}</option>` +
    list.sort((a, b) => a.localeCompare(b, 'ko')).map((s) => `<option value="${s}">${s}${counts[s] ? ` (${counts[s]})` : ''}</option>`).join('');
  sel.disabled = !state.sido;
  sel.value = state.sigungu;
}

function bind() {
  let t;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; applyFilters({ fit: true }); }, 120);
  });
  $('#sido').addEventListener('change', (e) => { state.sido = e.target.value; state.sigungu = ''; fillSigungu(); state.shown = PAGE; applyFilters({ fit: true }); });
  $('#sigungu').addEventListener('change', (e) => { state.sigungu = e.target.value; state.shown = PAGE; applyFilters({ fit: true }); });
  $('#guideChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.fav !== undefined) state.favoritesOnly = !state.favoritesOnly;
    else {
      const g = b.dataset.guide;
      if (state.guides.has(g)) state.guides.delete(g); else state.guides.add(g);
    }
    state.shown = PAGE;
    applyFilters({ fit: true });
  });
  $('#list').addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav-id]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.favId); return; }
    if (e.target.closest('a')) return;
    const card = e.target.closest('.card[data-id]');
    if (card) openDetail(card.dataset.id, 'list');
  });
  $('#detail').addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav-id]');
    if (fav) return toggleFav(fav.dataset.favId);
    if (e.target.closest('[data-close-detail]')) closeDetail();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#detail').hidden && !$('#coverage').open) closeDetail(); });
  $('#more').addEventListener('click', () => { state.shown += PAGE; applyFilters(); });
  $('#coverageBtn').addEventListener('click', () => { renderCoverage(); $('#coverage').showModal(); });
  $('#coverage').addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === e.currentTarget) $('#coverage').close(); });
}

async function loadJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function main() {
  bind();
  try {
    const [data, meta] = await Promise.all([loadJson('data/restaurants.json'), loadJson('data/meta.json').catch(() => null)]);
    state.data = data;
    state.meta = meta;
  } catch (e) {
    $('#count').textContent = '데이터를 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.';
    return;
  }
  for (const r of state.data.restaurants) { r._hay = haystack(r); state.byId.set(r.id, r); }
  // 즐겨찾기: 합쳐진 ID는 새 ID로 옮기고, 목록에서 빠진 곳도 지우지 않는다.
  const resolved = resolveFavorites(loadFavorites(storage), state.data);
  state.favs = resolved.favorites;
  saveFavorites(storage, state.favs);
  applyFilters();
  const params = new URLSearchParams(location.search);
  const clientId = params.get('ncpKeyId') || window.GOLMOK_CONFIG?.naverMapsClientId || '';
  state.map = await createMap($('#map'), {
    clientId,
    onSelect: (id, from) => openDetail(id, from),
    onNote: (msg) => { const n = $('#mapNote'); n.textContent = msg; n.hidden = false; setTimeout(() => { n.hidden = true; }, 9000); },
  });
  document.documentElement.dataset.mapEngine = state.map?.name || 'none';
  applyFilters({ fit: true });
}

main();
