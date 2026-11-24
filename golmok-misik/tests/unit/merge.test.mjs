import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecords } from '../../lib/merge.js';

const T = '2026-11-24';
const mic = (o = {}) => ({ source: 'michelin', sourceKey: 'michelin:yonggeumok', name: '용금옥', address: '종로구 자하문로 41-2, Seoul, 03036, 한국', lat: 37.57972, lng: 126.97088, coordSource: 'michelin', menu: ['추어탕'], badge: { distinction: 'bib', year: 2026, sourceUrl: 'https://guide.michelin.com/x', checkedAt: T }, ...o });
const bae = (o = {}) => ({ source: 'baeknyeon', sourceKey: 'baeknyeon:yong', name: '용금옥', address: '서울특별시 종로구 자하문로 41-2 (통인동)', lat: null, lng: null, menu: ['추어탕'], badge: { year: 2022, sourceUrl: 'https://www.sbiz.or.kr/x', checkedAt: T }, ...o });

test('같은 지점이 여러 출처에 나오면 하나로 합치고 배지를 모두 붙인다', () => {
  const { restaurants } = mergeRecords([mic(), bae()], null, { today: T });
  assert.equal(restaurants.length, 1);
  assert.deepEqual(restaurants[0].badges.map((b) => b.guide), ['michelin', 'baeknyeon']);
  assert.equal(restaurants[0].lat, 37.57972);
  assert.equal(restaurants[0].coordSource, 'michelin');
  assert.equal(restaurants[0].dong, '통인동');
});

test('같은 상호라도 주소가 다른 본점·분점은 합치지 않고 이력도 섞지 않는다', () => {
  const dadong = bae({ sourceKey: 'baeknyeon:dadong', address: '서울 중구 다동길 24-2' });
  const { restaurants } = mergeRecords([mic(), dadong], null, { today: T });
  assert.equal(restaurants.length, 2);
  const tongin = restaurants.find((r) => r.sigungu === '종로구');
  const da = restaurants.find((r) => r.sigungu === '중구');
  assert.deepEqual(tongin.badges.map((b) => b.guide), ['michelin']);
  assert.deepEqual(da.badges.map((b) => b.guide), ['baeknyeon']);
  assert.equal(da.lat, null, '다른 지점의 좌표를 빌려오지 않는다');
});

test('같은 건물이라도 상호가 다르면 별개 식당이다(윤서울/면서울)', () => {
  const a = mic({ sourceKey: 'michelin:yun', name: '윤서울', address: '강남구 선릉로 805, Seoul, 06019, 한국', lat: 37.52416, lng: 127.03906 });
  const b = mic({ sourceKey: 'michelin:myeon-seoul', name: '면서울', address: '강남구 선릉로 805, Seoul, 06019, 한국', lat: 37.52416, lng: 127.03906 });
  assert.equal(mergeRecords([a, b], null, { today: T }).restaurants.length, 2);
});

test('지번↔도로명 대응이 확인된 경우에만 지번 주소 레코드를 합친다', () => {
  const jib = bae({ sourceKey: 'baeknyeon:j', address: '서울 종로구 통인동 118-5' });
  const without = mergeRecords([mic(), jib], null, { today: T });
  assert.equal(without.restaurants.length, 2, '대응표가 없으면 자동 병합하지 않는다');
  assert.equal(without.report.review.filter((r) => r.type === 'road-vs-jibun').length, 1, '대신 검토 목록에 올린다');
  const withAlias = mergeRecords([mic(), jib], null, { today: T, aliases: { '서울|종로구|통인동|118-5': '서울|종로구|자하문로|41-2' } });
  assert.equal(withAlias.restaurants.length, 1);
  assert.equal(withAlias.restaurants[0].jibunAddress, '서울 종로구 통인동 118-5');
});

test('같은 입력으로 반복 실행해도 결과·ID가 같고 중복이 없다', () => {
  const first = mergeRecords([mic(), bae(), mic()], null, { today: T });
  assert.equal(first.restaurants.length, 1);
  assert.equal(first.restaurants[0].badges.length, 2, '같은 출처 항목이 두 번 들어와도 배지는 하나');
  const prev = { restaurants: first.restaurants, retired: first.retired, idAliases: first.idAliases };
  const second = mergeRecords([mic(), bae()], prev, { today: '2026-12-01' });
  assert.deepEqual(second.restaurants, first.restaurants);
  assert.equal(second.report.added.length + second.report.updated.length, 0);
});

test('주소가 바뀌어도 출처 키가 같으면 기존 ID를 유지하고 이전 주소를 남긴다', () => {
  const first = mergeRecords([mic()], null, { today: T });
  const id = first.restaurants[0].id;
  const moved = mic({ address: '종로구 자하문로 50, Seoul, 03036, 한국', lat: 37.5801, lng: 126.9712 });
  const second = mergeRecords([moved], first, { today: '2026-12-01' });
  assert.equal(second.restaurants[0].id, id);
  assert.equal(second.report.addressChanged.length, 1);
  assert.equal(second.restaurants[0].addressHistory[0].address, '서울 종로구 자하문로 41-2');
});

test('목록에서 빠진 지점은 지우지 않고 retired로 옮기며, 다시 나오면 같은 ID로 복귀한다', () => {
  const first = mergeRecords([mic(), bae({ sourceKey: 'baeknyeon:other', name: '완산정', address: '경기도 군포시 번영로 508(금정동)' })], null, { today: T });
  const wanId = first.restaurants.find((r) => r.name === '완산정').id;
  const second = mergeRecords([mic()], first, { today: '2026-12-01' });
  assert.equal(second.restaurants.length, 1);
  assert.equal(second.retired[0].id, wanId);
  const third = mergeRecords([mic(), bae({ sourceKey: 'baeknyeon:other', name: '완산정', address: '경기도 군포시 번영로 508(금정동)' })], second, { today: '2026-12-08' });
  assert.ok(third.restaurants.some((r) => r.id === wanId));
  assert.equal(third.retired.length, 0);
  assert.equal(third.report.revived.length, 1);
});

test('이전에 따로 있던 두 ID가 같은 지점으로 합쳐지면 idAliases로 이어 준다', () => {
  const jib = bae({ sourceKey: 'baeknyeon:j', address: '서울 종로구 통인동 118-5' });
  const first = mergeRecords([mic(), jib], null, { today: T });
  assert.equal(first.restaurants.length, 2);
  const second = mergeRecords([mic(), jib], first, { today: T, aliases: { '서울|종로구|통인동|118-5': '서울|종로구|자하문로|41-2' } });
  assert.equal(second.restaurants.length, 1);
  const oldIds = first.restaurants.map((r) => r.id);
  const kept = second.restaurants[0].id;
  const other = oldIds.find((x) => x !== kept);
  assert.equal(second.idAliases[other], kept);
});

test('서울·경기 밖이거나 주소를 해석할 수 없는 레코드는 제외 목록에 남긴다', () => {
  const { restaurants, report } = mergeRecords([mic({ sourceKey: 'm:busan', address: '부산 해운대구 구남로24번길 8' }), mic({ sourceKey: 'm:bad', address: '서울 마포구' })], null, { today: T });
  assert.equal(restaurants.length, 0);
  assert.deepEqual(report.excluded.map((e) => e.reason).sort(), ['address', 'region']);
});
