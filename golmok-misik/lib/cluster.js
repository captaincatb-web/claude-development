// 지도 엔진(네이버/기본 지도)과 무관한 격자 클러스터링. Web Mercator 픽셀 좌표 기준.
export function project(lat, lng, zoom) {
  const scale = 256 * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

// points: [{id, lat, lng}] → [{lat, lng, count, ids, bounds}]
export function clusterPoints(points, zoom, { cellPx = 64, maxClusterZoom = 16 } = {}) {
  if (zoom >= maxClusterZoom) {
    return points.map((p) => ({ lat: p.lat, lng: p.lng, count: 1, ids: [p.id], bounds: [p.lat, p.lng, p.lat, p.lng] }));
  }
  const cells = new Map();
  for (const p of points) {
    const { x, y } = project(p.lat, p.lng, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(p);
  }
  // 이웃 셀과 너무 가까운 클러스터를 한 번 더 합친다.
  const raw = [...cells.values()].map((ps) => {
    const lat = ps.reduce((s, p) => s + p.lat, 0) / ps.length;
    const lng = ps.reduce((s, p) => s + p.lng, 0) / ps.length;
    return { lat, lng, pts: ps, ...project(lat, lng, zoom) };
  });
  raw.sort((a, b) => b.pts.length - a.pts.length);
  const merged = [];
  for (const c of raw) {
    const near = merged.find((m) => Math.hypot(m.x - c.x, m.y - c.y) < cellPx * 0.6);
    if (near) {
      near.pts.push(...c.pts);
      near.lat = near.pts.reduce((s, p) => s + p.lat, 0) / near.pts.length;
      near.lng = near.pts.reduce((s, p) => s + p.lng, 0) / near.pts.length;
      Object.assign(near, project(near.lat, near.lng, zoom));
    } else merged.push(c);
  }
  return merged.map((c) => {
    const lats = c.pts.map((p) => p.lat);
    const lngs = c.pts.map((p) => p.lng);
    return {
      lat: c.lat,
      lng: c.lng,
      count: c.pts.length,
      ids: c.pts.map((p) => p.id).sort(),
      bounds: [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)],
    };
  });
}
