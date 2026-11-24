// 주소 문자열을 비교 가능한 형태로 정규화한다.
// 도로명주소: "서울|종로구|자하문로17길|18"   지번주소: "서울|성북구|보문동2가|122"
import { REGIONS } from './regions.js';

const SIDO_ALIASES = [
  [/^(서울특별시|서울시|서울)$/, '서울'],
  [/^(경기도|경기)$/, '경기'],
];

function normSido(tok) {
  for (const [re, v] of SIDO_ALIASES) if (re.test(tok)) return v;
  return null;
}

// "인사동 10길" → "인사동10길", "창룡대로 8 번길" → "창룡대로8번길"
function joinRoadTokens(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = out[out.length - 1];
    if (prev && /[가-힣]$/.test(prev) && /^\d+[가-힣]?(번?가?길)$/.test(t)) {
      out[out.length - 1] = prev + t;
    } else if (prev && /^\d+$/.test(prev) && /^(번길|가길|길)$/.test(t) && out.length >= 2 && /(로|길)$/.test(out[out.length - 2])) {
      out.pop();
      out[out.length - 1] = out[out.length - 1] + prev + t;
    } else if (prev && /[가-힣]$/.test(prev) && /^\d+$/.test(t) && /^(번길|가길|길)$/.test(tokens[i + 1] || '')) {
      out[out.length - 1] = prev + t + tokens[i + 1];
      i++;
    } else {
      out.push(t);
    }
  }
  return out;
}

export function parseAddress(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  // 미쉐린 표기: "중구 창경궁로 62-29, Seoul, 04546, 한국"
  const isSeoulEn = /,\s*Seoul\b/i.test(s);
  const postal = (s.match(/,\s*(\d{5}),/) || [])[1] || null;
  const paren = (s.match(/\(([^)]*)\)/) || [])[1] || '';
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.split(',')[0];
  s = s.replace(/^경(?=서울)/, ''); // SBS 게시물의 오타 "경서울특별시" 보정
  let tokens = s.split(/\s+/).filter(Boolean);
  let sido = normSido(tokens[0] || '');
  if (sido) tokens.shift();
  if (!sido && isSeoulEn) sido = '서울';
  if (sido === '서울' && normSido(tokens[0] || '') === '서울') tokens.shift();

  // 시·군·구
  let sigungu = null;
  let gu = null;
  const tryRegion = (sd) => {
    const list = REGIONS[sd]?.list || {};
    if (list[tokens[0]]) {
      sigungu = tokens.shift();
      if (sd === '경기' && /구$/.test(tokens[0] || '')) gu = tokens.shift();
      return true;
    }
    return false;
  };
  if (sido) tryRegion(sido);
  else if (tryRegion('서울')) sido = '서울';
  else if (tryRegion('경기')) sido = '경기';
  if (!sido || !sigungu) return { sido, sigungu, gu, kind: null, key: null, postal, raw: String(raw) };

  tokens = joinRoadTokens(tokens);
  let kind = null;
  let key = null;
  let dong = null;
  let road = null;
  let number = null;
  let detail = '';

  // 읍·면 처리: "안중읍 안중로117번길 1", "문산읍 방촌로 1622"
  let eupmyeon = null;
  if (/[읍면]$/.test(tokens[0] || '')) eupmyeon = tokens.shift();

  const roadIdx = tokens.findIndex((t) => /[가-힣\d](로|길)$/.test(t) && !/동\d*가?$/.test(t));
  const dongIdx = tokens.findIndex((t) => /^[가-힣\d]+(동\d*가?|가|리)$/.test(t) && !/(로|길)$/.test(t));
  if (roadIdx !== -1 && /^\d+(-\d+)?$/.test(tokens[roadIdx + 1] || '')) {
    kind = 'road';
    road = tokens[roadIdx];
    number = tokens[roadIdx + 1];
    detail = tokens.slice(roadIdx + 2).join(' ');
    key = [sido, sigungu, gu, road, number].filter(Boolean).join('|');
  } else if (dongIdx !== -1 && /^(산)?\d+(-\d+)?(번지)?$/.test(tokens[dongIdx + 1] || '')) {
    kind = 'jibun';
    dong = tokens[dongIdx];
    number = tokens[dongIdx + 1].replace('번지', '');
    detail = tokens.slice(dongIdx + 2).join(' ');
    key = [sido, sigungu, gu, dong, number].filter(Boolean).join('|');
  }
  if (!dong) {
    const d = paren.split(/[,\s]+/).find((t) => /^[가-힣\d]+(동\d*가?|가)$/.test(t));
    if (d) dong = d;
  }
  const display = [sido === '서울' ? '서울' : '경기', sigungu, gu, eupmyeon, kind === 'road' ? road : dong, number]
    .filter(Boolean)
    .join(' ');
  return { sido, sigungu, gu, eupmyeon, kind, key, road, dong, number, detail: detail.replace(/(\d+)\s+(층|호|동)(?=\s|$)/g, '$1$2').replace(/(지하)\s+(\d)/g, '$1$2').trim(), postal, display, raw: String(raw) };
}

// 상호 정규화: 공백·기호·법인 표기를 없애고, 지점명은 따로 분리한다.
export function splitBranch(name) {
  let n = String(name || '').trim();
  n = n.replace(/\(주\)|㈜|주식회사/g, '').trim();
  let branch = null;
  const m = n.match(/^(.*?)[\s(]*([가-힣A-Za-z0-9]+(?:본점|지점|직영점|점))\)?$/);
  if (m && m[1].trim().length >= 1 && !/^(본점|지점)$/.test(n)) {
    // "이쿠라 더현대서울점" → 이쿠라 / 더현대서울점. 단일 단어 상호(예: "만두집")는 건드리지 않는다.
    if (/\s|\(/.test(n)) {
      n = m[1].trim();
      branch = m[2];
    }
  }
  return { base: n, branch };
}

export function normName(name) {
  return splitBranch(name).base.replace(/[\s·.,'’"()\-_/&]/g, '').toLowerCase();
}
