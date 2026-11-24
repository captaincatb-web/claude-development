// 배포되는 초기 데이터 자체에 대한 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateDataset } from '../../lib/validate.js';

const data = JSON.parse(fs.readFileSync(new URL('../../data/restaurants.json', import.meta.url)));
const meta = JSON.parse(fs.readFileSync(new URL('../../data/meta.json', import.meta.url)));

test('초기 데이터가 검사를 통과한다', () => {
  const r = validateDataset(data);
  assert.deepEqual(r.errors, []);
});

test('같은 지점의 여러 가이드 배지가 한 카드로 합쳐져 있다', () => {
  const y = data.restaurants.filter((r) => r.name === '용금옥');
  assert.equal(y.length, 1);
  assert.deepEqual([...new Set(y[0].badges.map((b) => b.guide))].sort(), ['baeknyeon', 'michelin']);
  const k = data.restaurants.filter((r) => r.name === '교다이야');
  assert.equal(k.length, 1);
  assert.deepEqual([...new Set(k[0].badges.map((b) => b.guide))].sort(), ['lifemaster', 'michelin']);
});

test('좌표가 없는 곳은 핀 없이(좌표 null) 목록에 남는다', () => {
  const noCoord = data.restaurants.filter((r) => r.lat == null);
  assert.ok(noCoord.length > 0);
  for (const r of noCoord) {
    assert.equal(r.lng, null);
    assert.equal(r.coordSource, null);
    assert.ok(r.roadAddress || r.jibunAddress);
  }
  // 좌표는 출처가 준 경우만 있다
  for (const r of data.restaurants.filter((x) => x.lat != null)) assert.ok(['michelin', 'baeknyeon', 'bluer', 'naver-geocode'].includes(r.coordSource));
});

test('자료 현황에 가이드별 건수·기준일·미확보 범위가 있다', () => {
  for (const g of ['michelin', 'bluer', 'lifemaster', 'baeknyeon']) {
    const x = meta.guides[g];
    assert.equal(typeof x.restaurants, 'number');
    assert.ok(Array.isArray(x.missing) && x.missing.length > 0, `${g} 미확보 범위`);
  }
  assert.equal(meta.guides.michelin.restaurants, data.restaurants.filter((r) => r.badges.some((b) => b.guide === 'michelin')).length);
  assert.equal(meta.totals.restaurants, data.restaurants.length);
});
