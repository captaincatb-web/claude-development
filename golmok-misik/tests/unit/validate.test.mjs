import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDataset } from '../../lib/validate.js';
import { mergeRecords } from '../../lib/merge.js';

const T = '2026-11-24';
const rec = (o = {}) => ({ source: 'michelin', sourceKey: 'michelin:a', name: '우래옥', address: '중구 창경궁로 62-29, Seoul, 04546, 한국', lat: 37.56815, lng: 126.99866, coordSource: 'michelin', menu: [], badge: { distinction: 'bib', year: 2026, sourceUrl: 'https://guide.michelin.com/a', checkedAt: T }, ...o });
const ds = (recs, prev) => {
  const m = mergeRecords(recs, prev, { today: T });
  return { restaurants: m.restaurants, retired: m.retired, idAliases: m.idAliases };
};

test('정상 데이터는 통과', () => {
  assert.equal(validateDataset(ds([rec()])).ok, true);
});

test('좌표가 주소의 시군구와 맞지 않으면 거부(추정·오입력 좌표 차단)', () => {
  const r = validateDataset(ds([rec({ lat: 37.2636, lng: 127.0286 })]));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /범위 밖/);
});

test('출처 URL·확인일이 없으면 거부', () => {
  const bad = ds([rec({ badge: { distinction: 'bib', sourceUrl: 'not a url', checkedAt: '2026/11/24' } })]);
  const r = validateDataset(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /출처 URL/.test(e)));
  assert.ok(r.errors.some((e) => /확인일/.test(e)));
});

test('중복 ID·중복 지점을 거부', () => {
  const d = ds([rec()]);
  d.restaurants.push({ ...d.restaurants[0] });
  const r = validateDataset(d);
  assert.ok(r.errors.some((e) => /ID 중복/.test(e)));
  assert.ok(r.errors.some((e) => /중복/.test(e)));
});

test('기존 ID가 아무 데도 남지 않으면 거부(ID 보존 검사)', () => {
  const prev = ds([rec()]);
  const next = { restaurants: ds([rec({ sourceKey: 'michelin:b', name: '필동면옥', address: '중구 서애로 26, Seoul, 04624, 한국', lat: 37.56035, lng: 126.99689 })]).restaurants, retired: [], idAliases: {} };
  const r = validateDataset(next, prev);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /기존 ID가 사라짐/.test(e)));
});

test('활성 식당 수가 30% 넘게 줄면 불완전 응답으로 거부', () => {
  const many = Array.from({ length: 30 }, (_, i) => rec({ sourceKey: `michelin:${i}`, name: `식당${i}`, address: `중구 창경궁로 ${i + 1}, Seoul, 04546, 한국` }));
  const prev = ds(many);
  const next = ds(many.slice(0, 10), prev);
  const r = validateDataset(next, prev);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /급감/.test(e)));
});
