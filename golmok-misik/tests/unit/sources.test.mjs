// 출처 파서: 실제 페이지 구조를 본뜬 고정 HTML로 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePost, parseBoardList } from '../../scripts/sources/lifemaster.mjs';
import { parseListing, parseDetail } from '../../scripts/sources/michelin.mjs';
import { rowsToRecords } from '../../scripts/sources/baeknyeon.mjs';
import { parseCsv } from '../../scripts/sources/util.mjs';

const POST = `<div class="board_view"><h3>[1,049회] 은둔식달- 9년 연속 M슐랭 강북 최고 우동</h3>
<span>등록일</span> 2026.10.06 13:07<div class="text">
<p>&lt; 생활의 달인 1,049 회 방송 정보 &gt;</p><p>* 달인 프로필 *</p><p>1. 은둔식달 - 9 년 연속 M 슐랭 강북 최고 우동</p>
<p>* 방송협조 *</p><p>1. 은둔식달 - 9 년 연속 M 슐랭 강북 최고 우동</p><p>&lt; 교다이야 &gt;</p><p>서울특별시 마포구 성지길 39 1 층</p><p>02-2654-2645</p>
<p>2. 남대문 시장의 모든 것 3 대째 남대문 시장 덕후</p><p>&lt;남대문 한양사&gt;</p><p>서울 중구 남창동 32-1</p>
<p>3. 부산 피자 설기 달인</p><p>&lt;영도다리떡방&gt;</p><p>부산 영도구 남항동 1 가 224-1</p>
<p>촬영에 협조해주신 모든 분께 진심으로 감사드립니다 .</p></div></div>`;

test('생활의 달인 게시물: 회차·게시일·서울경기 음식점만 추출', () => {
  const d = parsePost(POST);
  assert.equal(d.episode, 1049);
  assert.equal(d.postedAt, '2026-10-06');
  assert.deepEqual(d.shops.map((s) => s.name), ['교다이야'], '덕후 코너와 부산 업체는 제외');
  assert.equal(d.shops[0].address, '서울특별시 마포구 성지길 39 1 층');
});

test('생활의 달인 게시판 목록 파싱', () => {
  const html = `<a href="/culture/lifemaster/board/55736?cmd=view&page=1&board_no=7599">[1054회] 은둔식달 - 보문동</a><a href="?cmd=view&board_no=7582">[1,053회] 천안 피자 달인</a>`;
  assert.deepEqual(parseBoardList(html).map((p) => [p.boardNo, p.episode]), [['7599', 1054], ['7582', 1053]]);
});

test('미쉐린 목록·상세 파싱(JSON-LD 우선, 없으면 본문 좌표 링크)', () => {
  const list = parseListing('<a href="/kr/ko/seoul-capital-area/kr-seoul/restaurant/woo-lae-oak">우래옥</a><a href="/kr/ko/seoul-capital-area/kr-seoul/restaurant/mijin">미진</a><ul class="pagination"><a href="/page/2">2</a></ul>');
  assert.deepEqual(list.slugs, ['woo-lae-oak', 'mijin']);
  const ld = parseDetail('<script type="application/ld+json">{"@type":"Restaurant","name":"우래옥","address":{"streetAddress":"중구 창경궁로 62-29","addressLocality":"Seoul"},"latitude":37.56815,"longitude":126.99866,"servesCuisine":"냉면"}</script>', 'woo-lae-oak');
  assert.equal(ld.name, '우래옥');
  assert.equal(ld.lat, 37.56815);
  const fb = parseDetail('<title>안덕 – Seoul - 의 미쉐린 가이드 레스토랑</title><div>종로구 자하문로 17길 18, Seoul, 03035, 한국</div><a href="/kr/ko/restaurants?lat=37.5814300&amp;lon=126.9696900">가까운 레스토랑</a>', 'andeok');
  assert.equal(fb.name, '안덕');
  assert.equal(fb.address, '종로구 자하문로 17길 18, Seoul, 03035, 한국');
  assert.equal(fb.lng, 126.96969);
});

test('백년가게 공공데이터 행 → 서울·경기 음식점만, 좌표 있으면 사용', () => {
  const rows = parseCsv('﻿연번,업체명,시도,시군구,기본주소,상세주소,주요사업\n1,완산정,경기,군포시,경기도 군포시 번영로 508,,"순대국, 해장국"\n2,김옥연한복,경남,창원시,경상남도 창원시 마산합포구 문화남4길 2,,한복\n3,박성구과자점,경기,남양주시,경기 남양주시 금곡동 404-41,1층,제과\n4,평화문구,서울,종로구,서울 종로구 종로 1,,문구\n');
  const recs = rowsToRecords(rows, { today: '2026-11-24' });
  assert.deepEqual(recs.map((r) => r.name), ['완산정', '박성구과자점']);
  assert.equal(recs[0].lat, null);
  assert.deepEqual(recs[0].menu, ['순대국', '해장국']);
});
