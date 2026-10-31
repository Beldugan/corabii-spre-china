// Harta lumii (proiecția Mercator, ca hărțile navigatorilor): vânturi, curenți, trasee.
import { geoMercator, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import landTopo from './land-50m.json';
import { windAt, WIND_ZONES, CURRENTS, PLACES } from './geo.js';

const LAND = feature(landTopo, landTopo.objects.land);
export const MAP_W = 1200, MAP_H = 760;

export function makeProjection(W = MAP_W, H = MAP_H) {
  const box = { type: 'MultiPoint', coordinates: [[-72, 63], [150, -56], [-72, -56], [150, 63]] };
  return geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], box);
}

// stratul de bază (ocean, uscat, rețeaua de meridiane) desenat o singură dată
export function makeBase(proj, W = MAP_W, H = MAP_H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const path = geoPath(proj, g);
  const oc = g.createLinearGradient(0, 0, 0, H);
  oc.addColorStop(0, '#2c5f86'); oc.addColorStop(0.5, '#1f5279'); oc.addColorStop(1, '#183f60');
  g.fillStyle = oc; g.fillRect(0, 0, W, H);
  // platforma continentală (apă mai deschisă lângă țărm)
  g.save();
  for (const [w, a] of [[22, 0.06], [12, 0.08], [6, 0.12]]) { g.beginPath(); path(LAND); g.lineWidth = w; g.strokeStyle = `rgba(120,200,220,${a})`; g.stroke(); }
  g.restore();
  // meridiane și paralele
  g.beginPath(); path(geoGraticule10()); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.stroke();
  // Ecuatorul și tropicele
  const lat = (y, dash, col) => { g.beginPath(); path({ type: 'LineString', coordinates: Array.from({ length: 50 }, (_, i) => [-80 + i * 5, y]) }); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]); };
  lat(0, [8, 5], 'rgba(255,230,150,.45)'); lat(23.44, [3, 5], 'rgba(255,255,255,.18)'); lat(-23.44, [3, 5], 'rgba(255,255,255,.18)');
  // uscatul
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, '#b9b28a'); lg.addColorStop(0.35, '#a7a873'); lg.addColorStop(0.55, '#c4ad7d'); lg.addColorStop(1, '#a9a27a');
  g.beginPath(); path(LAND); g.fillStyle = lg; g.fill();
  // umbrire ușoară pentru relief
  g.save(); g.beginPath(); path(LAND); g.clip();
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '60,70,40' : '255,250,220'},${Math.random() * 0.06})`; g.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 8, 2 + Math.random() * 5); }
  g.restore();
  g.beginPath(); path(LAND); g.strokeStyle = 'rgba(70,55,30,.75)'; g.lineWidth = 0.8; g.stroke();
  // etichete
  g.font = 'italic 600 15px Georgia, serif'; g.fillStyle = 'rgba(220,235,250,.55)'; g.textAlign = 'center';
  for (const [n, p] of [['OCEANUL ATLANTIC', [-38, 28]], ['OCEANUL ATLANTIC', [-22, -25]], ['OCEANUL INDIAN', [75, -20]], ['MAREA CHINEI DE SUD', [114, 12]], ['OCEANUL PACIFIC', [140, 15]]]) { const q = proj(p); g.fillText(n, q[0], q[1]); }
  g.font = '11px Georgia, serif'; g.fillStyle = 'rgba(255,230,150,.7)'; g.textAlign = 'left';
  const e = proj([-70, 0]); g.fillText('Ecuator', e[0], e[1] - 4);
  // masca uscatului (pentru particule)
  const m = document.createElement('canvas'); m.width = W; m.height = H;
  const mg = m.getContext('2d'); const mp = geoPath(proj, mg);
  mg.fillStyle = '#000'; mg.fillRect(0, 0, W, H); mg.beginPath(); mp(LAND); mg.fillStyle = '#fff'; mg.fill();
  const md = mg.getImageData(0, 0, W, H).data;
  const isLand = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return true; return md[(y * W + x) * 4] > 128; };
  return { canvas: c, isLand, path };
}

export function drawPlaces(g, proj, list = PLACES, o = {}) {
  g.save();
  g.font = `${o.size || 12}px "Segoe UI", system-ui, sans-serif`;
  for (const pl of list) {
    const q = proj(pl.p);
    g.fillStyle = '#fff7e0'; g.strokeStyle = '#4a3410'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(q[0], q[1], 3.2, 0, Math.PI * 2); g.fill(); g.stroke();
    g.textAlign = pl.a === 'l' ? 'right' : pl.a === 'b' ? 'center' : 'left';
    const dx = pl.a === 'l' ? -7 : pl.a === 'b' ? 0 : 7, dy = pl.a === 'b' ? 15 : 4;
    g.lineWidth = 3; g.strokeStyle = 'rgba(20,30,40,.75)'; g.strokeText(pl.n, q[0] + dx, q[1] + dy);
    g.fillStyle = '#fff'; g.fillText(pl.n, q[0] + dx, q[1] + dy);
  }
  g.restore();
}

// particule de vânt (ca niște fire de fum purtate de vânt)
export class WindParticles {
  constructor(proj, base, n = 1100) {
    this.proj = proj; this.base = base; this.season = 'summer'; this.ps = [];
    for (let i = 0; i < n; i++) this.ps.push(this.spawn({}));
  }
  spawn(p) {
    let x, y, k = 0;
    do { x = Math.random() * MAP_W; y = Math.random() * MAP_H; } while (this.base.isLand(x, y) && k++ < 20);
    p.x = x; p.y = y; p.age = Math.random() * 80; p.max = 60 + Math.random() * 60; p.h = [];
    return p;
  }
  step(dt) {
    for (const p of this.ps) {
      const ll = this.proj.invert([p.x, p.y]);
      const w = windAt(ll[0], ll[1], this.season);
      p.zone = w.zone;
      p.h.push(p.x, p.y); if (p.h.length > 16) p.h.splice(0, 2);
      p.x += w.u * 38 * dt; p.y -= w.v * 38 * dt;
      p.age++;
      if (p.age > p.max || this.base.isLand(p.x, p.y)) this.spawn(p);
    }
  }
  draw(g, alpha = 1) {
    // grupăm firele pe culori și pe 2 niveluri de transparență: puține apeluri de desen, deci rapid
    const groups = {};
    for (const p of this.ps) {
      if (p.h.length < 4) continue;
      const fade = Math.min(1, p.age / 10, (p.max - p.age) / 10);
      const key = (p.zone || 'x') + (fade > 0.6 ? 'a' : 'b');
      (groups[key] || (groups[key] = [])).push(p);
    }
    g.save(); g.lineCap = 'round'; g.lineWidth = 1.5;
    for (const key in groups) {
      const z = key.slice(0, -1);
      g.strokeStyle = WIND_ZONES[z] ? WIND_ZONES[z].col : '#fff';
      g.globalAlpha = (key.endsWith('a') ? 0.75 : 0.3) * alpha;
      g.beginPath();
      for (const p of groups[key]) {
        g.moveTo(p.h[0], p.h[1]);
        for (let i = 2; i < p.h.length; i += 2) g.lineTo(p.h[i], p.h[i + 1]);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
    }
    g.restore();
  }
}

export function currentScreen(proj, c, season) {
  let pts = c.pts.map(p => proj(p));
  if (c.monsoon && season === 'winter') pts = pts.slice().reverse();
  return pts;
}
export function drawCurrents(g, proj, t, season, hi = -1) {
  CURRENTS.forEach((c, i) => {
    const pts = currentScreen(proj, c, season);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = c.warm ? 'rgba(255,120,70,.9)' : 'rgba(110,190,255,.95)';
    g.lineWidth = i === hi ? 7 : 4.5;
    g.setLineDash([14, 10]); g.lineDashOffset = -t * 30;
    g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]));
    g.stroke(); g.setLineDash([]);
    // vârful săgeții
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    g.fillStyle = g.strokeStyle; g.translate(b[0], b[1]); g.rotate(ang);
    g.beginPath(); g.moveTo(10, 0); g.lineTo(-8, 8); g.lineTo(-8, -8); g.closePath(); g.fill();
    g.restore();
  });
}
export function nearestCurrent(proj, x, y, season) {
  let best = -1, bd = 14;
  CURRENTS.forEach((c, i) => {
    const pts = currentScreen(proj, c, season);
    for (let k = 1; k < pts.length; k++) {
      const d = segDist(x, y, pts[k - 1], pts[k]);
      if (d < bd) { bd = d; best = i; }
    }
  });
  return best;
}
function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

// ---------------------------------------------------------------- secțiunea „Vânturi și curenți”
export function initWinds(root) {
  const cv = root.querySelector('#cvWinds'); const g = cv.getContext('2d');
  cv.width = MAP_W; cv.height = MAP_H;
  const proj = makeProjection(); const base = makeBase(proj);
  const parts = new WindParticles(proj, base);
  const st = { winds: true, currents: true, route: false, season: 'summer', hi: -1 };
  const info = root.querySelector('#windInfo');
  const bind = (id, key) => { const b = root.querySelector(id); b.addEventListener('click', () => { st[key] = !st[key]; b.setAttribute('aria-pressed', st[key]); }); };
  bind('#wTogWind', 'winds'); bind('#wTogCur', 'currents'); bind('#wTogRoute', 'route');
  root.querySelectorAll('[data-season]').forEach(b => b.addEventListener('click', () => {
    st.season = b.dataset.season; parts.season = st.season;
    root.querySelectorAll('[data-season]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const z = WIND_ZONES[st.season === 'summer' ? 'monsoonSW' : 'monsoonNE'];
    info.innerHTML = `<b>${z.name}</b><br>${z.d}`;
  }));
  // legenda vânturilor
  const leg = root.querySelector('#windLegend');
  leg.innerHTML = ['westN', 'tradeNE', 'doldrums', 'tradeSE', 'forties', 'monsoonSW'].map(k => `<button class="chip" data-z="${k}"><i style="background:${WIND_ZONES[k].col}"></i>${WIND_ZONES[k].name.replace(/ \(.*/, '')}</button>`).join('');
  leg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const z = WIND_ZONES[b.dataset.z]; info.innerHTML = `<b>${z.name}</b><br>${z.d}`; }));
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) * MAP_W / r.width, y = (e.clientY - r.top) * MAP_H / r.height;
    const ci = st.currents ? nearestCurrent(proj, x, y, st.season) : -1;
    if (ci >= 0) { const c = CURRENTS[ci]; st.hi = ci; info.innerHTML = `<b>${c.warm ? '🔴 Curent cald' : '🔵 Curent rece'}: ${c.name}</b><br>${c.d}`; return; }
    st.hi = -1;
    if (base.isLand(x, y)) { info.innerHTML = 'Acolo e uscat. Apasă pe mare, ca să afli ce vânt bate acolo.'; return; }
    const ll = proj.invert([x, y]); const w = windAt(ll[0], ll[1], st.season); const z = WIND_ZONES[w.zone];
    const dir = windDirName(w.u, w.v);
    info.innerHTML = `<b>${z.name}</b> · aici vântul bate <b>dinspre ${dir}</b> (${Math.abs(ll[1]).toFixed(0)}° ${ll[1] >= 0 ? 'nord' : 'sud'})<br>${z.d}`;
  });
  let routePts = null;
  import('./geo.js').then(m => { routePts = m.ROUTES.cutty.pts.map(p => proj(p.p)); });
  let last = performance.now(), t = 0, alive = true;
  const loop = now => {
    if (!alive) return;
    requestAnimationFrame(loop);
    if (!root.offsetParent || now - last < 30) { if (!root.offsetParent) last = now; return; } // cel mult ~30 de cadre pe secundă
    const dt = Math.min(0.06, (now - last) / 1000); last = now; t += dt;
    g.drawImage(base.canvas, 0, 0);
    if (st.winds) { parts.step(dt); parts.draw(g); }
    if (st.currents) drawCurrents(g, proj, t, st.season, st.hi);
    if (st.route && routePts) {
      g.save(); g.strokeStyle = '#ffd34d'; g.lineWidth = 3; g.setLineDash([2, 7]); g.lineCap = 'round';
      g.beginPath(); routePts.forEach((q, k) => k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.restore();
    }
    drawPlaces(g, proj, PLACES.filter(p => ['Londra', 'Capul Bunei Speranțe', 'Canton', 'Shanghai', 'Str. Sunda', 'Rio de Janeiro', 'Madeira'].includes(p.n)));
  };
  requestAnimationFrame(loop);
}

export function windDirName(u, v) { // direcția DIN care bate vântul
  const from = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
  const names = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-vest', 'vest', 'nord-vest'];
  return names[Math.round(from / 45) % 8];
}
