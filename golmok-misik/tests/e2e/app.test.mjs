// 브라우저 테스트: node --test --test-concurrency=1 tests/e2e/*.test.mjs
// 외부 네트워크 없이 돌도록 지도 타일·폰트·네이버 스크립트를 가로챈다.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startServer } from '../../scripts/serve.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const PORT = 8123;
const URL0 = `http://localhost:${PORT}/`;
const DATA = JSON.parse(fs.readFileSync(new URL('../../data/restaurants.json', import.meta.url)));
const FAKE_NAVER = fs.readFileSync(new URL('./fake-naver-maps.js', import.meta.url), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
const onMapTotal = DATA.restaurants.filter((r) => r.lat != null).length;

let server, browser;
before(async () => {
  server = await startServer(PORT);
  browser = await pw.chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open({ viewport = { width: 1280, height: 860 }, query = '', setup } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/tile.openstreetmap.org/**', (r) => r.fulfill({ body: PNG, contentType: 'image/png' }));
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route('https://oapi.map.naver.com/**', (r) => r.fulfill({ body: FAKE_NAVER, contentType: 'text/javascript' }));
  if (setup) await setup(page, ctx);
  await page.goto(URL0 + query);
  await page.waitForSelector('.card');
  await page.waitForFunction(() => document.documentElement.dataset.mapEngine);
  page.errors = errors;
  return { page, ctx };
}
const cardNames = (page) => page.$$eval('.card[data-id] h3', (hs) => hs.map((h) => h.firstChild.textContent));
const mapTotal = (page) => page.evaluate(() => [...document.querySelectorAll('#map .pin')].length + [...document.querySelectorAll('#map .cluster')].reduce((s, c) => s + Number(c.textContent), 0));

test('데스크톱: 왼쪽 목록·오른쪽 지도 / 모바일: 검색·필터 → 지도 → 목록 세로 배치', async () => {
  const { page, ctx } = await open();
  const list = await page.locator('.list-pane').boundingBox();
  const map = await page.locator('.map-pane').boundingBox();
  assert.ok(list.x < map.x && Math.abs(list.y - map.y) < 5);
  await ctx.close();
  const m = await open({ viewport: { width: 390, height: 844 } });
  const ctrl = await m.page.locator('#controls').boundingBox();
  const mm = await m.page.locator('.map-pane').boundingBox();
  const ml = await m.page.locator('.list-pane').boundingBox();
  assert.ok(ctrl.y < mm.y && mm.y < ml.y, '세로 순서');
  const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, '가로 스크롤 없음');
  assert.deepEqual(m.page.errors, []);
  await m.ctx.close();
});

test('같은 지점의 배지 병합이 카드에 보이고, 지도 핀(묶음 숫자 포함) 수가 좌표 있는 식당 수와 같다', async () => {
  const { page, ctx } = await open();
  assert.equal(await page.locator('.card[data-id]').count(), Math.min(120, DATA.restaurants.length));
  const y = page.locator('.card', { hasText: '용금옥' });
  assert.deepEqual(await y.locator('.badge').allTextContents(), ['미쉐린 빕 구르망 2026', '백년가게 2022']);
  assert.equal(await mapTotal(page), onMapTotal);
  assert.ok((await page.locator('#map .cluster').count()) > 0, '축소 상태에서 숫자 묶음 표시');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mapEngine), 'leaflet');
  assert.match(await page.locator('#mapNote').textContent(), /Client ID/);
  await ctx.close();
});

test('지역·검색·가이드 필터', async () => {
  const { page, ctx } = await open();
  await page.fill('#q', '추어탕');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-id]').length < 10);
  assert.ok((await cardNames(page)).includes('용금옥'));
  await page.fill('#q', '보문동');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-id]').length === 3);
  await page.fill('#q', '');
  await page.selectOption('#sido', '서울');
  await page.selectOption('#sigungu', '마포구');
  const mapo = DATA.restaurants.filter((r) => r.sigungu === '마포구').length;
  await page.waitForFunction((n) => document.querySelectorAll('.card[data-id]').length === n, mapo);
  assert.equal(await mapTotal(page), DATA.restaurants.filter((r) => r.sigungu === '마포구' && r.lat != null).length);
  await page.selectOption('#sido', '경기');
  const gg = DATA.restaurants.filter((r) => r.sido === '경기');
  await page.waitForFunction((n) => document.querySelectorAll('.card[data-id]').length === n, gg.length);
  await page.selectOption('#sido', '');
  await page.click('.chip[data-guide="baeknyeon"]');
  await page.click('.chip[data-guide="lifemaster"]');
  const either = DATA.restaurants.filter((r) => r.badges.some((b) => ['baeknyeon', 'lifemaster'].includes(b.guide))).length;
  await page.waitForFunction((n) => document.querySelectorAll('.card[data-id]').length === n, either);
  assert.equal(await page.locator('.chip[data-guide="baeknyeon"]').getAttribute('aria-pressed'), 'true');
  await ctx.close();
});

test('핀 묶음을 누르면 확대되고, 핀을 누르면 카드·상세가 연동된다', async () => {
  const { page, ctx } = await open();
  const clustersBefore = await page.locator('#map .cluster').count();
  const pinsBefore = await page.locator('#map .pin').count();
  await page.locator('#map .cluster').first().click();
  await page.waitForTimeout(600);
  assert.ok((await page.locator('#map .pin').count()) !== pinsBefore || (await page.locator('#map .cluster').count()) !== clustersBefore);
  // 검색으로 한 곳만 남긴 뒤 핀 클릭
  await page.fill('#q', '우래옥');
  await page.waitForFunction(() => document.querySelectorAll('#map .pin').length === 1 && document.querySelector('#map .pin[aria-label="우래옥"]'));
  await page.locator('#map .pin').click();
  await page.waitForSelector('#detail:not([hidden])');
  assert.equal(await page.locator('#detailName').textContent(), '우래옥');
  assert.equal(await page.locator('.card[aria-current="true"] h3').textContent(), '우래옥');
  const href = await page.locator('#detail a.btn.primary').getAttribute('href');
  assert.ok(href.startsWith('https://map.naver.com/p/search/') && decodeURIComponent(href).includes('우래옥'));
  assert.ok((await page.locator('#detail .sources a').first().getAttribute('href')).startsWith('https://guide.michelin.com/'));
  assert.equal(await page.locator('#map .pin.sel').count(), 1, '선택된 핀 강조');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#detail').isHidden(), true);
  await ctx.close();
});

test('좌표 없는 곳은 핀 없이 목록에 보이고 네이버지도 검색으로 연결된다', async () => {
  const { page, ctx } = await open();
  await page.fill('#q', '영순관');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-id]').length === 1);
  assert.equal(await page.locator('.card .nopin').count(), 1);
  assert.equal(await mapTotal(page), 0);
  await page.click('.card[data-id] .open');
  assert.match(await page.locator('#detail .note').textContent(), /좌표가 없어/);
  const href = await page.locator('#detail a.btn.primary').getAttribute('href');
  assert.ok(decodeURIComponent(href).includes('영순관') && decodeURIComponent(href).includes('보문동2가'));
  await ctx.close();
});

test('즐겨찾기: 새로고침 후 유지, 데이터 갱신으로 목록에서 빠져도 남는다', async () => {
  const { page, ctx } = await open();
  const target = DATA.restaurants.find((r) => r.name === '영순관');
  await page.fill('#q', '영순관');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-id]').length === 1);
  await page.click('.card[data-id] .fav');
  assert.equal(await page.locator('.card[data-id] .fav').getAttribute('aria-pressed'), 'true');
  await page.reload();
  await page.waitForSelector('.card');
  await page.click('.chip[data-fav]');
  await page.waitForFunction(() => document.querySelectorAll('.card[data-id]').length === 1);
  assert.equal(await page.locator('.card[data-id] h3').textContent(), '영순관');
  // 다음 주 갱신에서 영순관이 출처 목록에서 빠졌다고 가정(retired)
  const next = { ...DATA, restaurants: DATA.restaurants.filter((r) => r.id !== target.id), retired: [{ id: target.id, name: target.name, roadAddress: target.roadAddress, jibunAddress: target.jibunAddress, sido: target.sido, sigungu: target.sigungu, retiredAt: '2026-12-01' }] };
  await page.route('**/data/restaurants.json', (r) => r.fulfill({ body: JSON.stringify(next), contentType: 'application/json' }));
  await page.reload();
  await page.waitForSelector('.chip[data-fav]');
  assert.equal(await page.locator('.chip[data-fav] .n').textContent(), '1');
  await page.click('.chip[data-fav]');
  await page.waitForSelector('.card.ghosted');
  assert.match(await page.locator('.card.ghosted').textContent(), /영순관[\s\S]*즐겨찾기는 그대로 보관/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('golmok:favorites:v1')));
  assert.ok(stored[target.id]);
  await ctx.close();
});

test('네이버 지도 Client ID가 있으면 네이버 지도 엔진으로 핀·묶음을 그린다(대역 스크립트)', async () => {
  const { page, ctx } = await open({ query: '?ncpKeyId=test-client-id' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mapEngine), 'naver');
  await page.waitForFunction(() => document.querySelectorAll('.fake-marker').length > 0);
  assert.equal(await mapTotal(page), onMapTotal);
  await page.fill('#q', '필동면옥');
  await page.waitForFunction(() => document.querySelectorAll('#map .pin').length === 1 && document.querySelector('#map .pin[aria-label="필동면옥"]'));
  await page.locator('#map .pin').click();
  await page.waitForSelector('#detail:not([hidden])');
  assert.equal(await page.locator('#detailName').textContent(), '필동면옥');
  await ctx.close();
});

test('네이버 지도 인증 실패 시 기본 지도로 자동 전환', async () => {
  const { page, ctx } = await open({ query: '?ncpKeyId=bad', setup: (p) => p.addInitScript(() => { window.__fakeNaverAuthFail = true; }) });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mapEngine), 'leaflet');
  assert.match(await page.locator('#mapNote').textContent(), /인증 실패/);
  assert.equal(await mapTotal(page), onMapTotal);
  await ctx.close();
});

test('자료 현황 창에 가이드별 수록 건수·기준일·미확보 범위가 보인다', async () => {
  const { page, ctx } = await open();
  await page.click('#coverageBtn');
  const txt = await page.locator('#coverage').textContent();
  assert.match(txt, /미쉐린/);
  assert.match(txt, /블루리본[\s\S]*0곳/);
  assert.match(txt, /이용 권한/);
  assert.match(txt, /자료 기준일/);
  await page.click('#coverage [data-close]');
  await ctx.close();
});
