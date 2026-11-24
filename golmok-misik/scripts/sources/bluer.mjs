// 블루리본 서베이는 공개 API가 없고 데이터 재배포에 권한이 필요하다.
// 이용 권한이 있는 데이터를 data/imports/bluer.json 으로 넣으면 반영한다.
// 형식: [{ "name", "address", "ribbons", "year", "sourceUrl", "lat"?, "lng"? }]
import fs from 'node:fs';
import path from 'node:path';
import { parseAddress, normName } from '../../lib/address.js';

export default {
  id: 'bluer',
  minCount: 0,
  scope: '이용 권한이 있는 블루리본 데이터를 넣은 경우에만',
  async fetch({ today, rootDir, prev }) {
    const file = path.join(rootDir, 'data/imports/bluer.json');
    if (!fs.existsSync(file)) return { records: prev?.records || [], skipped: true, note: '이용 권한 있는 블루리본 데이터 미제공' };
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const records = rows
      .filter((r) => r.name && r.address && r.sourceUrl)
      .map((r) => {
        const p = parseAddress(r.address);
        const hasC = typeof r.lat === 'number' && typeof r.lng === 'number';
        return {
          source: 'bluer',
          sourceKey: r.sourceKey || `bluer:${normName(r.name)}@${p?.key || r.address}`,
          name: r.name,
          address: r.address,
          lat: hasC ? r.lat : null,
          lng: hasC ? r.lng : null,
          coordSource: hasC ? 'bluer' : null,
          menu: r.menu || [],
          badge: { ribbons: r.ribbons || null, year: r.year || null, sourceUrl: r.sourceUrl, checkedAt: r.checkedAt || today },
        };
      });
    return { records, sourceUrls: ['https://www.bluer.co.kr'], via: 'data/imports/bluer.json' };
  },
};
