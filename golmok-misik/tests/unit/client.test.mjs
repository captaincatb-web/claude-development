import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clusterPoints } from '../../lib/cluster.js';
import { filterRestaurants } from '../../lib/search.js';
import { naverMapUrl } from '../../lib/links.js';
import { toggleFavorite, resolveFavorites, loadFavorites, saveFavorites, FAV_KEY } from '../../lib/favorites.js';

const data = JSON.parse(fs.readFileSync(new URL('../../data/restaurants.json', import.meta.url)));
const pts = data.restaurants.filter((r) => r.lat != null).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng }));

test('지도 축소 시 가까운 핀은 숫자로 묶이고, 확대하면 풀린다', () => {
  const far = clusterPoints(pts, 10);
  const near = clusterPoints(pts, 17);
  assert.ok(far.length < pts.length / 3, `zoom 10 클러스터 ${far.length}개`);
  assert.ok(far.some((c) => c.count > 5));
  assert.equal(near.length, pts.length);
  assert.equal(far.reduce((s, c) => s + c.count, 0), pts.length, '묶음 숫자 합 = 전체 핀 수');
});

test('윤서울·면서울처럼 같은 좌표의 두 식당은 최대 확대 전까지 한 묶음', () => {
  const two = pts.filter((p) => ['면서울', '윤서울'].includes(data.restaurants.find((r) => r.id === p.id).name));
  assert.equal(two.length, 2);
  assert.equal(clusterPoints(two, 15)[0].count, 2);
});

test('지역 필터: 서울/경기, 시군구', () => {
  const mapo = filterRestaurants(data.restaurants, { sido: '서울', sigungu: '마포구' });
  assert.ok(mapo.length > 5 && mapo.every((r) => r.sigungu === '마포구'));
  const gg = filterRestaurants(data.restaurants, { sido: '경기' });
  assert.ok(gg.length >= 5 && gg.every((r) => r.sido === '경기'));
});

test('검색: 상호·메뉴·동네·주소', () => {
  assert.ok(filterRestaurants(data.restaurants, { q: '용금옥' }).length === 1);
  assert.ok(filterRestaurants(data.restaurants, { q: '추어탕' }).some((r) => r.name === '용금옥'));
  assert.ok(filterRestaurants(data.restaurants, { q: '통인동' }).some((r) => r.name === '용금옥'));
  assert.ok(filterRestaurants(data.restaurants, { q: '자하문로 41-2' }).some((r) => r.name === '용금옥'));
  assert.ok(filterRestaurants(data.restaurants, { q: '보문동' }).length >= 3);
  assert.equal(filterRestaurants(data.restaurants, { q: '없는식당이름xyz' }).length, 0);
});

test('가이드 필터는 여러 개를 고르면 하나라도 해당하는 식당(OR)', () => {
  const b = filterRestaurants(data.restaurants, { guides: ['baeknyeon'] });
  const l = filterRestaurants(data.restaurants, { guides: ['lifemaster'] });
  const both = filterRestaurants(data.restaurants, { guides: ['baeknyeon', 'lifemaster'] });
  assert.equal(both.length, new Set([...b, ...l].map((r) => r.id)).size);
  assert.ok(b.every((r) => r.badges.some((x) => x.guide === 'baeknyeon')));
});

test('네이버지도 링크는 상호와 주소로 검색한다(좌표 없어도 동작)', () => {
  const r = data.restaurants.find((x) => x.name === '영순관');
  assert.equal(r.lat, null);
  const u = naverMapUrl(r);
  assert.ok(u.startsWith('https://map.naver.com/p/search/'));
  assert.ok(decodeURIComponent(u).includes('영순관'));
  assert.ok(decodeURIComponent(u).includes('보문동2가 122'));
});

test('즐겨찾기: 저장·복원, 목록 제외(retired)와 ID 병합(idAliases) 후에도 보존', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const r = data.restaurants[0];
  let favs = toggleFavorite({}, r, '2026-11-24T00:00:00Z');
  saveFavorites(storage, favs);
  assert.ok(store.has(FAV_KEY));
  favs = loadFavorites(storage);
  assert.ok(favs[r.id]);
  // 1) 갱신으로 목록에서 빠짐
  const retiredData = { restaurants: data.restaurants.slice(1), retired: [{ id: r.id, name: r.name }], idAliases: {} };
  const res1 = resolveFavorites(favs, retiredData);
  assert.ok(res1.favorites[r.id]);
  assert.equal(res1.items[0].state, 'retired');
  // 2) 다른 ID로 합쳐짐
  const target = data.restaurants[1];
  const aliasData = { restaurants: data.restaurants.slice(1), retired: [], idAliases: { [r.id]: target.id } };
  const res2 = resolveFavorites(favs, aliasData);
  assert.ok(res2.favorites[target.id], '새 ID로 옮겨진다');
  assert.equal(res2.items[0].state, 'active');
  // 3) 데이터에서 완전히 사라져도 스냅숏으로 남는다
  const res3 = resolveFavorites(favs, { restaurants: [], retired: [], idAliases: {} });
  assert.equal(res3.items[0].state, 'missing');
  assert.equal(res3.items[0].snapshot.name, r.name);
  // 깨진 저장값은 빈 목록으로 처리
  assert.deepEqual(loadFavorites({ getItem: () => '{broken' }), {});
  assert.deepEqual(loadFavorites(null), {});
});
