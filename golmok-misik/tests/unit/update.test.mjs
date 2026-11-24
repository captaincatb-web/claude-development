// 갱신 파이프라인: 실패·불완전 응답 시 배포 데이터 보존, 반복 실행 시 중복 없음
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runUpdate } from '../../scripts/update.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const T = new Date('2026-12-01T02:00:00Z');
const quiet = () => {};

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golmok-'));
  fs.cpSync(path.join(ROOT, 'data'), path.join(dir, 'data'), { recursive: true });
  return dir;
}
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(path.join(dir, 'data'));
  return out;
}
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, 'data', f), 'utf8'));
const prevOf = (dir, id) => read(dir, `sources/${id}.json`);

// 실제 스냅숏을 그대로 돌려주는 가짜 출처
const echo = (id, minCount = 1, extra = []) => ({ id, minCount, scope: 's', fetch: async ({ prev }) => ({ records: [...prev.records, ...extra] }) });
const failing = (id) => ({ id, minCount: 1, scope: 's', fetch: async () => { throw new Error('HTTP 503'); } });
const shrinking = (id) => ({ id, minCount: 1, scope: 's', fetch: async ({ prev }) => ({ records: prev.records.slice(0, 3) }) });

test('원본 조회 실패 시 해당 출처는 이전 자료를 유지하고 서비스 데이터는 바뀌지 않는다', async () => {
  const dir = sandbox();
  const before = read(dir, 'restaurants.json');
  const report = await runUpdate({ rootDir: dir, now: T, log: quiet, adapters: [failing('michelin'), echo('bluer', 0), echo('lifemaster'), echo('baeknyeon')] });
  assert.equal(report.ok, true);
  assert.equal(report.sources.find((s) => s.id === 'michelin').status, 'failed');
  assert.deepEqual(read(dir, 'restaurants.json'), before);
  assert.equal(read(dir, 'meta.json').guides.michelin.status, 'failed');
  assert.equal(prevOf(dir, 'michelin').records.length, 93);
});

test('불완전한 응답(건수 급감)은 반영하지 않고 이전 자료를 유지한다', async () => {
  const dir = sandbox();
  const before = read(dir, 'restaurants.json');
  const report = await runUpdate({ rootDir: dir, now: T, log: quiet, adapters: [shrinking('michelin'), echo('bluer', 0), echo('lifemaster'), echo('baeknyeon')] });
  assert.equal(report.sources.find((s) => s.id === 'michelin').status, 'failed');
  assert.match(report.sources.find((s) => s.id === 'michelin').note, /불완전/);
  assert.deepEqual(read(dir, 'restaurants.json'), before);
});

test('검사에 걸리는 새 자료가 오면 data/ 파일을 하나도 바꾸지 않는다', async () => {
  const dir = sandbox();
  const before = snapshot(dir);
  const bad = { source: 'lifemaster', sourceKey: 'lifemaster:9999:가짜', name: '가짜식당', address: '서울 마포구 성지길 1', lat: 35.1, lng: 129.0, coordSource: 'x', menu: [], badge: { episode: 9999, sourceUrl: 'https://programs.sbs.co.kr/x', checkedAt: '2026-12-01' } };
  const report = await runUpdate({ rootDir: dir, now: T, log: quiet, adapters: [echo('michelin'), echo('bluer', 0), echo('lifemaster', 1, [bad]), echo('baeknyeon')] });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((e) => /범위 밖/.test(e)));
  const after = snapshot(dir);
  delete after['data/last-failed-report.json'];
  assert.deepEqual(after, before);
});

test('새 항목은 추가되고, 같은 자료로 다시 돌려도 중복·변경이 없다', async () => {
  const dir = sandbox();
  const add = { source: 'lifemaster', sourceKey: 'lifemaster:1055:테스트', name: '테스트국수', address: '경기 수원시 팔달구 정조로 800', lat: null, lng: null, menu: ['국수'], badge: { episode: 1055, sourceUrl: 'https://programs.sbs.co.kr/x', checkedAt: '2026-12-01' } };
  const ads = [echo('michelin'), echo('bluer', 0), { id: 'lifemaster', minCount: 1, scope: 's', fetch: async ({ prev }) => ({ records: prev.records.some((r) => r.sourceKey === add.sourceKey) ? prev.records : [...prev.records, add] }) }, echo('baeknyeon')];
  const r1 = await runUpdate({ rootDir: dir, now: T, log: quiet, adapters: ads });
  assert.equal(r1.ok, true);
  assert.equal(r1.added.length, 1);
  const d1 = read(dir, 'restaurants.json');
  const r2 = await runUpdate({ rootDir: dir, now: new Date('2026-12-08T02:00:00Z'), log: quiet, adapters: ads });
  assert.equal(r2.changed, false);
  assert.equal(r2.added.length, 0);
  assert.deepEqual(read(dir, 'restaurants.json'), d1);
  assert.equal(d1.restaurants.filter((r) => r.name === '테스트국수').length, 1);
});

test('출처에서 빠진 식당은 retired로 옮겨 ID와 즐겨찾기를 보존한다', async () => {
  const dir = sandbox();
  const before = read(dir, 'restaurants.json');
  const target = before.restaurants.find((r) => r.name === '영순관');
  const drop = { id: 'lifemaster', minCount: 1, scope: 's', fetch: async ({ prev }) => ({ records: prev.records.filter((r) => r.name !== '영순관') }) };
  const r = await runUpdate({ rootDir: dir, now: T, log: quiet, adapters: [echo('michelin'), echo('bluer', 0), drop, echo('baeknyeon')] });
  assert.equal(r.ok, true);
  const after = read(dir, 'restaurants.json');
  assert.ok(!after.restaurants.some((x) => x.id === target.id));
  assert.equal(after.retired.find((x) => x.id === target.id).name, '영순관');
});
