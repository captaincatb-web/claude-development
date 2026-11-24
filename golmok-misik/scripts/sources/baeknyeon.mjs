// 백년가게: 소상공인시장진흥공단 공공데이터(공공데이터포털)를 우선 사용한다.
//  1) DATA_GO_KR_SERVICE_KEY가 있으면 공공데이터포털 오픈API(파일데이터 자동변환 API)
//  2) 없으면 data/imports/baeknyeon.csv (포털에서 내려받은 CSV, CP949/UTF-8 모두 가능)
//  3) 둘 다 없으면 이전 스냅숏 유지(백년가게 누리집에서 직접 확인한 항목)
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv, decodeMaybeEucKr } from './util.mjs';
import { parseAddress, normName } from '../../lib/address.js';

const DATASET_PAGE = 'https://www.data.go.kr/data/15132695/fileData.do';
const API = 'https://api.odcloud.kr/api/15132695/v1/uddi:82fc1cc1-f636-46fc-ae0d-b1f2da5052b4';
const FOOD_WORDS = /(음식|식당|한식|중식|일식|양식|분식|냉면|국밥|국수|칼국수|탕|찌개|갈비|고기|구이|순대|족발|보쌈|만두|막국수|면|짜장|짬뽕|회|초밥|삼계탕|해장국|설렁탕|곰탕|추어탕|백반|정식|한정식|부대찌개|닭|오리|돈가스|떡|제과|빵|베이커리|카페|커피|김밥|떡볶이|두부|전골|아구|생선|매운탕|낙지|주꾸미|곱창|막창|불고기|비빔밥|죽)/;

function pick(row, ...patterns) {
  for (const p of patterns) {
    const k = Object.keys(row).find((key) => p.test(key));
    if (k && row[k]) return row[k];
  }
  return '';
}

export function rowsToRecords(rows, { today, sourceUrl = DATASET_PAGE }) {
  const out = [];
  for (const row of rows) {
    const name = pick(row, /업체명|상호|가게명/);
    const base = pick(row, /도로명|기본주소|^주소|소재지/);
    const detail = pick(row, /상세주소/);
    const jibun = pick(row, /지번/);
    const sector = pick(row, /업종|구분/);
    const biz = pick(row, /주요사업|대표메뉴|주메뉴/);
    const year = Number((pick(row, /지정연도|선정연도|지정일/).match(/\d{4}/) || [])[0]) || null;
    if (!name || !base) continue;
    const p = parseAddress(base);
    if (!p || !['서울', '경기'].includes(p.sido) || !p.sigungu) continue;
    const isFood = sector ? /음식/.test(sector) : FOOD_WORDS.test(biz + ' ' + name);
    if (!isFood) continue;
    const lat = Number(pick(row, /위도|LAT/i)) || null;
    const lng = Number(pick(row, /경도|LOGT|LNG|LON/i)) || null;
    out.push({
      source: 'baeknyeon',
      sourceKey: `baeknyeon:${normName(name)}@${p.key || base}`,
      name,
      address: `${base}${detail ? ' ' + detail : ''}`,
      jibunAddress: jibun || null,
      lat: lat && lng ? lat : null,
      lng: lat && lng ? lng : null,
      coordSource: lat && lng ? 'baeknyeon' : null,
      menu: biz ? biz.split(/[,·/]\s*/).filter(Boolean) : [],
      badge: { year, sourceUrl, checkedAt: today },
    });
  }
  return out;
}

export default {
  id: 'baeknyeon',
  minCount: 1,
  scope: '서울·경기 음식점업 백년가게',
  async fetch({ fetchText, log, today, prev, env, rootDir }) {
    const manual = (prev?.records || []).filter((r) => r.origin === 'manual');
    let rows = null;
    let via = null;
    if (env.DATA_GO_KR_SERVICE_KEY) {
      rows = [];
      for (let page = 1; page <= 10; page++) {
        const url = `${API}?page=${page}&perPage=1000&returnType=JSON&serviceKey=${encodeURIComponent(env.DATA_GO_KR_SERVICE_KEY)}`;
        const j = JSON.parse(await fetchText(url));
        if (!Array.isArray(j.data)) throw new Error('공공데이터 API 응답 형식 오류');
        rows.push(...j.data);
        if (rows.length >= (j.totalCount || 0) || !j.data.length) break;
      }
      via = 'data.go.kr API';
    } else {
      const csv = path.join(rootDir, 'data/imports/baeknyeon.csv');
      if (fs.existsSync(csv)) {
        rows = parseCsv(decodeMaybeEucKr(fs.readFileSync(csv)));
        via = 'data/imports/baeknyeon.csv';
      }
    }
    if (!rows) {
      log('baeknyeon: API 키·CSV 없음 → 이전 스냅숏 유지');
      return { records: prev?.records || [], skipped: true, note: '공공데이터 키 또는 CSV가 없어 이전 자료 유지' };
    }
    if (rows.length < 500) throw new Error(`백년가게 원본 행 수가 너무 적음(${rows.length}) — 불완전 응답으로 판단`);
    const records = rowsToRecords(rows, { today });
    log(`baeknyeon(${via}): 원본 ${rows.length}행 → 서울·경기 음식점 ${records.length}곳`);
    const keys = new Set(records.map((r) => r.sourceKey));
    return { records: [...records, ...manual.filter((m) => !keys.has(m.sourceKey))], sourceUrls: [DATASET_PAGE], via };
  },
};
