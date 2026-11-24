// 지도 엔진 어댑터. 네이버 지도(Client ID가 있을 때)와 기본 지도(Leaflet + OpenStreetMap)를
// 같은 인터페이스로 감싼다. 클러스터링은 lib/cluster.js 하나로 처리한다.
import { clusterPoints } from './lib/cluster.js';

const SEOUL = { lat: 37.5502, lng: 126.982 };

function pinHtml(p, selected) {
  const multi = p.guides > 1;
  return `<button type="button" class="pin${multi ? ' multi' : ''}${selected ? ' sel' : ''}" ${multi ? '' : `style="--c:${p.color}" `}data-id="${p.id}" aria-label="${p.name.replace(/"/g, '&quot;')}"><span>${multi ? p.guides : ''}</span></button>`;
}
function clusterHtml(c) {
  const s = c.count < 10 ? 34 : c.count < 50 ? 42 : 52;
  return { html: `<div class="cluster" style="width:${s}px;height:${s}px" role="button" aria-label="${c.count}곳 묶음, 눌러서 확대">${c.count}</div>`, size: s };
}

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    s.src = src;
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); reject(new Error('load error')); };
    document.head.appendChild(s);
  });
}

class BaseEngine {
  constructor(el, { onSelect }) {
    this.el = el;
    this.onSelect = onSelect;
    this.points = [];
    this.selected = null;
    this.byId = new Map();
  }
  setPoints(points) {
    this.points = points;
    this.byId = new Map(points.map((p) => [p.id, p]));
    this.render();
  }
  select(id, { pan = true } = {}) {
    this.selected = id;
    const p = this.byId.get(id);
    if (p && pan) this.focus(p);
    else this.render();
  }
  visibleClusters() {
    const [s, w, n, e] = this.bounds();
    const padLat = (n - s) * 0.25;
    const padLng = (e - w) * 0.25;
    const pts = this.points.filter((p) => p.lat >= s - padLat && p.lat <= n + padLat && p.lng >= w - padLng && p.lng <= e + padLng);
    return clusterPoints(pts, Math.round(this.zoom()));
  }
}

class LeafletEngine extends BaseEngine {
  static async create(el, opts) {
    if (!window.L) await loadScript(new URL('./vendor/leaflet/leaflet.js', import.meta.url).href, 10000);
    const L = window.L;
    if (!L) throw new Error('Leaflet 없음');
    const e = new LeafletEngine(el, opts);
    e.L = L;
    e.map = L.map(el, { zoomControl: true, attributionControl: true }).setView([SEOUL.lat, SEOUL.lng], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(e.map);
    e.layer = L.layerGroup().addTo(e.map);
    e.map.on('moveend zoomend', () => e.render());
    e.name = 'leaflet';
    return e;
  }
  bounds() {
    const b = this.map.getBounds();
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  }
  zoom() { return this.map.getZoom(); }
  render() {
    const L = this.L;
    this.layer.clearLayers();
    for (const c of this.visibleClusters()) {
      if (c.count === 1) {
        const p = this.byId.get(c.ids[0]);
        const sel = p.id === this.selected;
        const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ html: pinHtml(p, sel), className: '', iconSize: sel ? [34, 34] : [26, 26], iconAnchor: sel ? [17, 40] : [13, 32] }), zIndexOffset: sel ? 1000 : 0, keyboard: false, title: p.name });
        m.on('click', () => this.onSelect(p.id, 'map'));
        m.addTo(this.layer);
      } else {
        const { html, size } = clusterHtml(c);
        const m = L.marker([c.lat, c.lng], { icon: L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: false });
        m.on('click', () => this.zoomTo(c));
        m.addTo(this.layer);
      }
    }
  }
  zoomTo(c) {
    const [s, w, n, e] = c.bounds;
    if (n - s < 1e-4 && e - w < 1e-4) this.map.setView([c.lat, c.lng], Math.min(this.zoom() + 3, 18));
    else this.map.fitBounds([[s, w], [n, e]], { padding: [40, 40], maxZoom: 17 });
  }
  focus(p) { this.map.setView([p.lat, p.lng], Math.max(this.zoom(), 16)); this.render(); }
  fit(points) {
    if (!points.length) return;
    if (points.length === 1) return this.map.setView([points[0].lat, points[0].lng], 16);
    const b = this.L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    this.map.fitBounds(b, { padding: [30, 30], maxZoom: 15 });
  }
  invalidate() { this.map.invalidateSize(); }
}

class NaverEngine extends BaseEngine {
  static async create(el, opts) {
    const id = opts.clientId;
    const authFailed = new Promise((_, reject) => { window.navermap_authFailure = () => reject(new Error('네이버 지도 인증 실패(Client ID 또는 Web 서비스 URL 확인)')); });
    await loadScript(`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(id)}`, 8000);
    const naver = window.naver;
    if (!naver?.maps) throw new Error('네이버 지도 스크립트 없음');
    const e = new NaverEngine(el, opts);
    e.N = naver.maps;
    e.map = new naver.maps.Map(el, { center: new naver.maps.LatLng(SEOUL.lat, SEOUL.lng), zoom: 11, zoomControl: true, zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT } });
    e.markers = [];
    naver.maps.Event.addListener(e.map, 'idle', () => e.render());
    e.name = 'naver';
    // 인증 실패는 스크립트 로드 뒤 비동기로 알려진다. 1.5초 안에 오면 기본 지도로 바꾼다.
    await Promise.race([authFailed, new Promise((r) => setTimeout(r, 1500))]);
    return e;
  }
  bounds() {
    const b = this.map.getBounds();
    const sw = b.getSW ? b.getSW() : b.getMin();
    const ne = b.getNE ? b.getNE() : b.getMax();
    return [sw.lat(), sw.lng(), ne.lat(), ne.lng()];
  }
  zoom() { return this.map.getZoom(); }
  render() {
    const N = this.N;
    for (const m of this.markers) m.setMap(null);
    this.markers = [];
    for (const c of this.visibleClusters()) {
      if (c.count === 1) {
        const p = this.byId.get(c.ids[0]);
        const sel = p.id === this.selected;
        const m = new N.Marker({ position: new N.LatLng(p.lat, p.lng), map: this.map, title: p.name, zIndex: sel ? 1000 : 100, icon: { content: pinHtml(p, sel), anchor: sel ? new N.Point(17, 40) : new N.Point(13, 32) } });
        N.Event.addListener(m, 'click', () => this.onSelect(p.id, 'map'));
        this.markers.push(m);
      } else {
        const { html, size } = clusterHtml(c);
        const m = new N.Marker({ position: new N.LatLng(c.lat, c.lng), map: this.map, zIndex: 50, icon: { content: html, anchor: new N.Point(size / 2, size / 2) } });
        N.Event.addListener(m, 'click', () => this.zoomTo(c));
        this.markers.push(m);
      }
    }
  }
  zoomTo(c) {
    const N = this.N;
    const [s, w, n, e] = c.bounds;
    if (n - s < 1e-4 && e - w < 1e-4) { this.map.setCenter(new N.LatLng(c.lat, c.lng)); this.map.setZoom(Math.min(this.zoom() + 3, 19)); }
    else this.map.fitBounds(new N.LatLngBounds(new N.LatLng(s, w), new N.LatLng(n, e)), { top: 40, right: 40, bottom: 40, left: 40 });
  }
  focus(p) {
    const N = this.N;
    this.map.setCenter(new N.LatLng(p.lat, p.lng));
    if (this.zoom() < 16) this.map.setZoom(16);
    this.render();
  }
  fit(points) {
    const N = this.N;
    if (!points.length) return;
    if (points.length === 1) { this.map.setCenter(new N.LatLng(points[0].lat, points[0].lng)); this.map.setZoom(16); return; }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    this.map.fitBounds(new N.LatLngBounds(new N.LatLng(Math.min(...lats), Math.min(...lngs)), new N.LatLng(Math.max(...lats), Math.max(...lngs))), { top: 30, right: 30, bottom: 30, left: 30 });
  }
  invalidate() { this.map.autoResize?.(); }
}

export async function createMap(el, { clientId, onSelect, onNote }) {
  if (clientId) {
    try {
      return await NaverEngine.create(el, { clientId, onSelect });
    } catch (err) {
      el.innerHTML = '';
      onNote?.(`네이버 지도를 불러오지 못해 기본 지도로 표시합니다. (${err.message})`);
    }
  } else {
    onNote?.('네이버 지도 Client ID가 설정되지 않아 기본 지도(OpenStreetMap)로 표시합니다. 각 식당은 ‘네이버지도에서 보기’로 열 수 있습니다.');
  }
  try {
    return await LeafletEngine.create(el, { onSelect });
  } catch (err) {
    onNote?.('지도를 불러오지 못했습니다. 목록과 네이버지도 링크는 그대로 쓸 수 있습니다.');
    return null;
  }
}
