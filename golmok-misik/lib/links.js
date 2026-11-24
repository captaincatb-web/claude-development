// 네이버지도 검색 링크. 좌표가 없어도 상호+주소로 찾을 수 있다.
export function naverMapUrl(r) {
  const addr = r.roadAddress || r.jibunAddress || `${r.sido} ${r.sigungu}`;
  const q = `${r.name}${r.branch ? ' ' + r.branch : ''} ${addr.replace(/\s\d+층.*$/, '')}`;
  return `https://map.naver.com/p/search/${encodeURIComponent(q.trim())}`;
}
