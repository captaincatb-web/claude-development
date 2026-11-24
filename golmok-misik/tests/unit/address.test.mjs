import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress, splitBranch, normName } from '../../lib/address.js';

test('표기가 다른 같은 도로명주소는 같은 키가 된다', () => {
  const a = parseAddress('종로구 인사동 10길 11-3, Seoul, 03146, 한국');
  const b = parseAddress('서울특별시 종로구 인사동10길 11-3');
  const c = parseAddress('서울 종로구 인사동10길 11-3 1층');
  assert.equal(a.key, '서울|종로구|인사동10길|11-3');
  assert.equal(a.key, b.key);
  assert.equal(b.key, c.key);
  assert.equal(c.detail, '1층');
});

test('번길·가길 띄어쓰기와 경기 일반구 처리', () => {
  const p = parseAddress('경기 수원시 팔달구 창룡대로 8 번길 6');
  assert.equal(p.sido, '경기');
  assert.equal(p.sigungu, '수원시');
  assert.equal(p.gu, '팔달구');
  assert.equal(p.key, '경기|수원시|팔달구|창룡대로8번길|6');
  assert.equal(parseAddress('경기 평택시 안중읍 안중로 117 번길 1 1 층').key, '경기|평택시|안중로117번길|1');
});

test('지번주소는 jibun으로 구분하고 괄호 속 동 이름을 동네로 쓴다', () => {
  const j = parseAddress('서울 성북구 보문동2가 122');
  assert.equal(j.kind, 'jibun');
  assert.equal(j.key, '서울|성북구|보문동2가|122');
  const r = parseAddress('서울특별시 종로구 자하문로 41-2 (통인동)');
  assert.equal(r.kind, 'road');
  assert.equal(r.dong, '통인동');
});

test('시도 표기 변형과 SBS 게시물 오타를 정규화한다', () => {
  assert.equal(parseAddress('서울시 용산구 회나무로 41길 4, Seoul, 04344, 한국').key, '서울|용산구|회나무로41길|4');
  assert.equal(parseAddress('경서울특별시 강남구 학동로 56 길 32').key, '서울|강남구|학동로56길|32');
  assert.equal(parseAddress('경기도 군포시 번영로 508(금정동)').key, '경기|군포시|번영로|508');
});

test('서울·경기 밖 주소는 시군구를 찾지 못한다', () => {
  const p = parseAddress('부산 해운대구 구남로24번길 8');
  assert.equal(p.sigungu, null);
  assert.equal(parseAddress('인천 강화군 강화읍 동문안길 12-1').sigungu, null);
});

test('지점명 분리: 본점·분점을 구분할 수 있게 한다', () => {
  assert.deepEqual(splitBranch('이쿠라 더현대서울점'), { base: '이쿠라', branch: '더현대서울점' });
  assert.deepEqual(splitBranch('니시무라멘 연남본점'), { base: '니시무라멘', branch: '연남본점' });
  assert.deepEqual(splitBranch('만두집'), { base: '만두집', branch: null });
  assert.equal(normName('개성만두 궁'), normName('개성만두궁'));
  assert.equal(normName('(주)옛날중국집'), normName('옛날중국집'));
});
