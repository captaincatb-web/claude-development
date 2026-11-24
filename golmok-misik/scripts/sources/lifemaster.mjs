// SBS '생활의 달인' 공식 방송정보 게시판의 "방송협조" 항목에서 서울·경기 음식점을 읽는다.
// 게시판은 회차가 계속 늘어나므로 이전 스냅숏에 새 회차만 더한다(누적).
import { htmlToText, mapLimit } from './util.mjs';

const LIST = 'https://programs.sbs.co.kr/culture/lifemaster/boards/55736?cmd=list&page=';
const POST = 'https://programs.sbs.co.kr/culture/lifemaster/board/55736?cmd=view&page=1&board_no=';
const FOOD = /(면|국수|만두|짜장|짬뽕|탕수육|떡|빵|피자|초밥|스시|우동|냉면|칼국수|김밥|치킨|통닭|버거|도넛|케이크|타르트|라멘|쌀국수|미고렝|불고기|오므라이스|중식|은둔식달|김치|족발|보쌈|국밥|순대|갈비|곱창|찌개|탕|전골|돈가스|카레|떡볶이|분식|찹쌀떡|베이커리|제과|디저트|커피|맛집|식당|요리|구이|회|타코야키|고로케|설기|두부|묵)/;
const NOT_FOOD = /(덕후|등산|운동|청소|드론|교습|염색|게임|자전거|휴양림|스토킹|급식|옷|연필|볼펜|필기|벌초|사다리|숨 참기)/;

export function parseBoardList(html) {
  const posts = [];
  const re = /board_no=(\d+)[^>]*>\s*\[?\[?([\d,]+)회\]?\s*([^<]*)/g;
  for (const m of html.matchAll(re)) posts.push({ boardNo: m[1], episode: Number(m[2].replace(/,/g, '')), title: m[3].trim() });
  const uniq = new Map(posts.map((p) => [p.boardNo, p]));
  return [...uniq.values()];
}

export function parsePost(html) {
  const text = htmlToText(html);
  const ep = text.match(/\[\s*([\d,]+)\s*회\s*\]/);
  const posted = text.match(/등록일\s*(\d{4})\.(\d{2})\.(\d{2})/);
  const section = text.split(/\*\s*방송\s*협조\s*\*/)[1];
  const out = [];
  if (!section) return { episode: ep ? Number(ep[1].replace(/,/g, '')) : null, postedAt: null, shops: out };
  const body = section.split(/촬영에 협조해주신/)[0];
  let heading = '';
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = l.match(/^\d+\s*\.\s*(.+)$/);
    if (h) { heading = h[1].trim(); continue; }
    const n = l.match(/^<\s*([^<>]+?)\s*>$/);
    if (n) {
      const addr = lines[i + 1] || '';
      if (/^(경?서울|경기)/.test(addr)) {
        out.push({ name: n[1].trim(), address: addr.replace(/^경(?=서울)/, ''), heading });
        i++;
      }
    }
  }
  return {
    episode: ep ? Number(ep[1].replace(/,/g, '')) : null,
    postedAt: posted ? `${posted[1]}-${posted[2]}-${posted[3]}` : null,
    shops: out.filter((s) => FOOD.test(s.heading + ' ' + s.name) && !NOT_FOOD.test(s.heading)),
  };
}

export function shopKey(episode, name) {
  return `lifemaster:${episode}:${String(name).replace(/\s+/g, '')}`;
}

export default {
  id: 'lifemaster',
  minCount: 1,
  scope: '서울·경기. SBS 공식 방송정보 게시판에 방송협조 주소가 공개된 회차만',
  async fetch({ fetchText, log, today, prev, maxPages = 2 }) {
    const prevRecords = prev?.records || [];
    const known = new Set(prevRecords.map((r) => r.badge?.boardNo).filter(Boolean));
    const posts = [];
    for (let page = 1; page <= maxPages; page++) {
      const list = parseBoardList(await fetchText(LIST + page));
      if (!list.length) break;
      posts.push(...list);
    }
    if (!posts.length) throw new Error('게시판 목록을 읽지 못함');
    const fresh = posts.filter((p) => !known.has(p.boardNo));
    log(`lifemaster: 게시물 ${posts.length}건 중 새 게시물 ${fresh.length}건`);
    const parsed = await mapLimit(fresh, 2, async (p) => ({ p, d: parsePost(await fetchText(POST + p.boardNo)) }));
    const added = [];
    for (const { p, d } of parsed) {
      const episode = d.episode || p.episode;
      for (const s of d.shops) {
        added.push({
          source: 'lifemaster',
          sourceKey: shopKey(episode, s.name),
          name: s.name,
          address: s.address,
          lat: null,
          lng: null,
          menu: [],
          badge: { episode, title: s.heading, postedAt: d.postedAt, airDate: null, boardNo: p.boardNo, sourceUrl: POST + p.boardNo, checkedAt: today },
        });
      }
    }
    const byKey = new Map(prevRecords.map((r) => [r.sourceKey, r]));
    for (const r of added) if (!byKey.has(r.sourceKey)) byKey.set(r.sourceKey, r);
    return { records: [...byKey.values()], sourceUrls: [LIST + 1] };
  },
};
