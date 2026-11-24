#!/usr/bin/env node
// 골목미식 데이터 갱신.
//   node scripts/update.mjs              모든 출처 조회 → 검사 → 통과 시 data/ 반영
//   node scripts/update.mjs --offline    출처를 조회하지 않고 data/sources 스냅숏만 다시 병합
//   node scripts/update.mjs --only=michelin,lifemaster
//   node scripts/update.mjs --dry-run    검사만 하고 파일은 바꾸지 않음
// 원본 조회 실패·불완전 응답이면 해당 출처는 이전 스냅숏을 그대로 쓰고,
// 최종 검사에 실패하면 data/ 를 전혀 바꾸지 않고 종료 코드 1로 끝난다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeRecords } from '../lib/merge.js';
import { validateDataset } from '../lib/validate.js';
import { GUIDES, GUIDE_ORDER } from '../lib/guides.js';
import { parseAddress } from '../lib/address.js';
import { makeFetchText, todayKST } from './sources/util.mjs';
import michelin from './sources/michelin.mjs';
import lifemaster from './sources/lifemaster.mjs';
import baeknyeon from './sources/baeknyeon.mjs';
import bluer from './sources/bluer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_ADAPTERS = [michelin, bluer, lifemaster, baeknyeon];

// 출처별로 "아직 확보하지 못한 범위"를 앱에 보여주기 위한 설명
const COVERAGE_NOTES = {
  michelin: ['미쉐린 가이드 한국판은 서울·부산만 발간 — 경기도 31개 시·군은 해당 없음', '미쉐린 "선정(플레이트)" 레스토랑은 아직 미수록, 스타·빕 구르망만 수록'],
  bluer: ['블루리본 서베이는 공개 API가 없고 데이터 재배포 권한이 필요 — 권한 있는 데이터를 받기 전까지 0곳'],
  lifemaster: ['SBS 공식 방송정보 게시판에서 주소가 공개된 회차만 수록(초기 회차 대부분 미수록)', '좌표를 제공하지 않아 지도 핀 없이 목록·네이버지도 검색으로만 표시'],
  baeknyeon: ['공공데이터포털 전체 목록(전국 1,511건) 반영에는 서비스키 또는 CSV가 필요', '서울시 자료에는 좌표가 없어 목록·네이버지도 검색으로만 표시'],
};

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1) + '\n');
}

// 확인된 주소로 네이버 지오코딩을 호출해 좌표·지번을 얻는다(선택). 결과가 정확히 1건이고
// 도로명 키가 원래 주소와 같을 때만 쓴다. 추정 좌표는 만들지 않는다.
async function geocodeMissing(records, { env, fetchText, log, aliases }) {
  if (env.GEOCODE !== '1' || !env.NCP_API_KEY_ID || !env.NCP_API_KEY) return 0;
  let n = 0;
  for (const r of records) {
    if (typeof r.lat === 'number') continue;
    const p = parseAddress(r.address);
    if (!p?.key) continue;
    try {
      const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(r.address)}`;
      const j = JSON.parse(await fetchText(url, { headers: { 'x-ncp-apigw-api-key-id': env.NCP_API_KEY_ID, 'x-ncp-apigw-api-key': env.NCP_API_KEY } }));
      if (j.addresses?.length !== 1) continue;
      const a = j.addresses[0];
      const road = parseAddress(a.roadAddress);
      const jibun = parseAddress(a.jibunAddress);
      if (!road?.key || (p.kind === 'road' && road.key !== p.key) || (p.kind === 'jibun' && jibun?.key !== p.key)) continue;
      r.lat = Number(a.y);
      r.lng = Number(a.x);
      r.coordSource = 'naver-geocode';
      if (jibun?.key) aliases[jibun.key] = road.key;
      n++;
    } catch (e) {
      log(`geocode 실패 ${r.name}: ${e.message}`);
    }
  }
  return n;
}

function buildMeta(merged, snapshots, today, prevMeta) {
  const guides = {};
  for (const id of GUIDE_ORDER) {
    const snap = snapshots[id] || {};
    const withBadge = merged.restaurants.filter((r) => r.badges.some((b) => b.guide === id));
    const bySido = { 서울: 0, 경기: 0 };
    for (const r of withBadge) bySido[r.sido]++;
    const dates = withBadge.flatMap((r) => r.badges.filter((b) => b.guide === id).map((b) => b.checkedAt)).sort();
    guides[id] = {
      label: GUIDES[id].long,
      restaurants: withBadge.length,
      bySido,
      onMap: withBadge.filter((r) => r.lat != null).length,
      asOf: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
      status: snap.status || 'unknown',
      lastAttempt: snap.lastAttempt || null,
      lastSuccess: snap.lastSuccess || null,
      note: snap.note || null,
      scope: snap.scope || null,
      sourceUrls: snap.sourceUrls || [],
      missing: [...(COVERAGE_NOTES[id] || []), ...(snap.extraMissing || [])],
    };
  }
  return {
    generatedAt: prevMeta?.generatedAt || today,
    totals: {
      restaurants: merged.restaurants.length,
      onMap: merged.restaurants.filter((r) => r.lat != null).length,
      noCoord: merged.restaurants.filter((r) => r.lat == null).length,
      multiBadge: merged.restaurants.filter((r) => new Set(r.badges.map((b) => b.guide)).size > 1).length,
      retired: merged.retired.length,
    },
    guides,
    review: merged.report.review,
  };
}

export async function runUpdate({
  rootDir = ROOT,
  adapters = DEFAULT_ADAPTERS,
  offline = false,
  only = null,
  dryRun = false,
  env = process.env,
  fetchText = makeFetchText(),
  now = new Date(),
  log = console.log,
} = {}) {
  const dataDir = path.join(rootDir, 'data');
  const today = todayKST(now);
  const prevData = readJson(path.join(dataDir, 'restaurants.json'));
  const prevMeta = readJson(path.join(dataDir, 'meta.json'));
  const aliasFile = readJson(path.join(dataDir, 'address-aliases.json'), { aliases: {} });
  const aliases = { ...(aliasFile.aliases || {}) };
  const snapshots = {};
  const sourceStatus = [];

  for (const ad of adapters) {
    const snapFile = path.join(dataDir, 'sources', `${ad.id}.json`);
    const prev = readJson(snapFile, { source: ad.id, records: [] });
    let snap = { ...prev, scope: ad.scope };
    if (!offline && (!only || only.includes(ad.id))) {
      snap.lastAttempt = today;
      try {
        const res = await ad.fetch({ fetchText, log, today, prev, env, rootDir });
        const prevCount = prev.records?.length || 0;
        const n = res.records.length;
        if (res.skipped) {
          snap = { ...snap, records: res.records, status: prev.status === 'ok' ? 'ok' : 'manual', note: res.note || null };
        } else if (n < ad.minCount || (prevCount >= 10 && n < prevCount * 0.7)) {
          throw new Error(`불완전 응답: ${n}건 (이전 ${prevCount}건, 최소 ${ad.minCount}건)`);
        } else {
          snap = { ...snap, records: res.records, status: 'ok', lastSuccess: today, note: null, sourceUrls: res.sourceUrls || prev.sourceUrls || [] };
        }
      } catch (e) {
        log(`⚠ ${ad.id}: ${e.message} → 이전 스냅숏(${prev.records?.length || 0}건) 유지`);
        snap = { ...prev, scope: ad.scope, lastAttempt: today, status: 'failed', note: `조회 실패로 이전 자료 유지: ${e.message}` };
      }
    }
    snapshots[ad.id] = snap;
    sourceStatus.push({ id: ad.id, status: snap.status || 'snapshot', records: snap.records?.length || 0, note: snap.note || null });
  }

  const all = Object.values(snapshots).flatMap((s) => s.records || []);
  if (!offline) {
    const g = await geocodeMissing(all, { env, fetchText, log, aliases });
    if (g) log(`geocode: ${g}곳 좌표 확보`);
  }
  const merged = mergeRecords(all, prevData, { aliases, today });
  const dataset = { version: 1, restaurants: merged.restaurants, retired: merged.retired, idAliases: merged.idAliases };
  const check = validateDataset(dataset, prevData);
  const changed = JSON.stringify(dataset) !== JSON.stringify(prevData ? { version: 1, restaurants: prevData.restaurants, retired: prevData.retired, idAliases: prevData.idAliases } : null);
  const meta = buildMeta(merged, snapshots, today, changed ? null : prevMeta);
  const report = {
    ranAt: now.toISOString(),
    ok: check.ok,
    changed,
    sources: sourceStatus,
    errors: check.errors,
    added: merged.report.added,
    updated: merged.report.updated,
    addressChanged: merged.report.addressChanged,
    retired: merged.report.retired,
    revived: merged.report.revived,
    merged: merged.report.merged,
    excluded: merged.report.excluded,
    review: merged.report.review,
  };

  if (!check.ok) {
    log(`✖ 검사 실패 — 현재 배포 데이터를 유지합니다.\n  ${check.errors.slice(0, 20).join('\n  ')}`);
    if (!dryRun) writeJson(path.join(dataDir, 'last-failed-report.json'), report);
    return report;
  }
  if (dryRun) {
    log('✔ 검사 통과(dry-run, 파일 변경 없음)');
    return report;
  }
  // 임시 폴더에 모두 쓴 뒤 한 번에 교체
  const tmp = fs.mkdtempSync(path.join(dataDir, '.tmp-'));
  try {
    for (const [id, snap] of Object.entries(snapshots)) writeJson(path.join(tmp, 'sources', `${id}.json`), snap);
    writeJson(path.join(tmp, 'restaurants.json'), dataset);
    writeJson(path.join(tmp, 'meta.json'), meta);
    writeJson(path.join(tmp, 'address-aliases.json'), { note: aliasFile.note || '같은 건물임이 출처에서 확인된 지번→도로명 키', aliases });
    writeJson(path.join(tmp, 'update-report.json'), report);
    // 다시 읽어 검사(디스크에 쓴 내용 그대로)
    const again = validateDataset(readJson(path.join(tmp, 'restaurants.json')), prevData);
    if (!again.ok) throw new Error('임시 파일 재검사 실패: ' + again.errors[0]);
    fs.mkdirSync(path.join(dataDir, 'sources'), { recursive: true });
    for (const id of Object.keys(snapshots)) fs.renameSync(path.join(tmp, 'sources', `${id}.json`), path.join(dataDir, 'sources', `${id}.json`));
    for (const f of ['address-aliases.json', 'meta.json', 'update-report.json', 'restaurants.json']) fs.renameSync(path.join(tmp, f), path.join(dataDir, f));
    fs.rmSync(path.join(dataDir, 'last-failed-report.json'), { force: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  log(`✔ 반영 완료: 식당 ${dataset.restaurants.length}곳 (추가 ${report.added.length}, 변경 ${report.updated.length}, 주소변경 ${report.addressChanged.length}, 목록 제외 ${report.retired.length})`);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  const report = await runUpdate({ offline: args.includes('--offline'), dryRun: args.includes('--dry-run'), only: only.length ? only : null });
  const failedSources = report.sources.filter((s) => s.status === 'failed');
  if (failedSources.length) console.log(`출처 조회 실패(이전 자료 유지): ${failedSources.map((s) => s.id).join(', ')}`);
  process.exit(report.ok ? 0 : 1);
}
