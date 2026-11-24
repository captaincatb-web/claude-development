// 테스트용 NAVER Maps v3 대역(최소 API). 실제 지도는 그리지 않고 마커 DOM만 만든다.
(function () {
  function LatLng(lat, lng) { this._lat = lat; this._lng = lng; }
  LatLng.prototype.lat = function () { return this._lat; };
  LatLng.prototype.lng = function () { return this._lng; };
  function Point(x, y) { this.x = x; this.y = y; }
  function LatLngBounds(sw, ne) { this.sw = sw; this.ne = ne; }
  LatLngBounds.prototype.getSW = function () { return this.sw; };
  LatLngBounds.prototype.getNE = function () { return this.ne; };
  function fire(t, ev) { ((t._l || {})[ev] || []).forEach(function (f) { f(); }); }
  function Map(el, o) {
    this.el = el; this.center = o.center; this.zoom = o.zoom;
    this.layer = document.createElement('div'); this.layer.className = 'fake-naver'; el.appendChild(this.layer);
    window.__fakeNaverMap = this; var self = this; setTimeout(function () { fire(self, 'idle'); }, 0);
  }
  Map.prototype.getBounds = function () {
    var d = (360 / Math.pow(2, this.zoom)) * 1.2;
    return new LatLngBounds(new LatLng(this.center.lat() - d / 2, this.center.lng() - d), new LatLng(this.center.lat() + d / 2, this.center.lng() + d));
  };
  Map.prototype.getZoom = function () { return this.zoom; };
  Map.prototype.setZoom = function (z) { this.zoom = z; fire(this, 'idle'); };
  Map.prototype.setCenter = function (c) { this.center = c; fire(this, 'idle'); };
  Map.prototype.fitBounds = function (b) {
    this.center = new LatLng((b.sw.lat() + b.ne.lat()) / 2, (b.sw.lng() + b.ne.lng()) / 2);
    var span = Math.max(b.ne.lat() - b.sw.lat(), b.ne.lng() - b.sw.lng(), 0.002);
    this.zoom = Math.max(6, Math.min(18, Math.floor(Math.log2(360 / span))));
    fire(this, 'idle');
  };
  function Marker(o) {
    this.el = document.createElement('div'); this.el.className = 'fake-marker'; this.el.innerHTML = o.icon.content;
    o.map.layer.appendChild(this.el); var self = this;
    this.el.addEventListener('click', function () { fire(self, 'click'); });
  }
  Marker.prototype.setMap = function (m) { if (!m && this.el.parentNode) this.el.parentNode.removeChild(this.el); };
  var Event = { addListener: function (t, ev, fn) { t._l = t._l || {}; (t._l[ev] = t._l[ev] || []).push(fn); } };
  window.naver = { maps: { LatLng: LatLng, Point: Point, LatLngBounds: LatLngBounds, Map: Map, Marker: Marker, Event: Event, Position: { TOP_RIGHT: 3 } } };
  if (window.__fakeNaverAuthFail) setTimeout(function () { window.navermap_authFailure && window.navermap_authFailure(); }, 50);
})();
