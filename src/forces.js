// Secțiunea „Forțele pe corabie”: solicitările din structură (chilă, coaste, grinzi, catarg, wanturi)
// și cum se schimbă ele când apare vântul, când se strâng pânzele sau când vin valurile.
// Corabia de referință: un East Indiaman ca „Hindostan” (cca 1.200 t). Cifrele sunt estimări realiste, rotunjite.

import * as THREE from 'three';
import { ShipViewer } from './ships3d.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------ geometria secțiunii transversale (metri)
const RAIL = 6.4, KEEL = -6.2, BEAM2 = 6.7; // parapet, chilă, jumătate de lățime
const DECKS = { main: 5.1, gun: 2.4, orlop: -0.8, floor: -4.7 };
function hw(y) { // jumătatea lățimii corpului la înălțimea y
  const v = clamp((RAIL - y) / (RAIL - KEEL), 0, 1);
  let g = Math.sqrt(Math.max(0, 1 - v * v * v));
  g *= 1 - 0.12 * Math.pow(Math.max(0, 1 - v / 0.45), 2);
  return BEAM2 * g;
}
function hullOutline(inset = 0) {
  const pts = [], N = 40;
  for (let i = 0; i <= N; i++) { const y = lerp(RAIL, KEEL + inset * 1.6, i / N); pts.push([Math.max(0.05, hw(y) - inset), y]); }
  for (let i = N; i >= 0; i--) { const y = lerp(RAIL, KEEL + inset * 1.6, i / N); pts.push([-Math.max(0.05, hw(y) - inset), y]); }
  return pts;
}
const OUTER = hullOutline(0), INNER = hullOutline(0.38);
const rot = (p, th) => [p[0] * Math.cos(th) + p[1] * Math.sin(th), -p[0] * Math.sin(th) + p[1] * Math.cos(th)];
function clipBelow(poly) { // partea de sub apă (y < 0)
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ina = a[1] < 0, inb = b[1] < 0;
    if (ina) out.push(a);
    if (ina !== inb) { const t = a[1] / (a[1] - b[1]); out.push([a[0] + (b[0] - a[0]) * t, 0]); }
  }
  return out;
}
function centroid(poly) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  A /= 2; return A ? { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) } : { A: 0, x: 0, y: 0 };
}
// brațul de redresare GZ (m) pentru unghiul θ și centrul de greutate la înălțimea yG
function GZ(theta, yG) {
  const sub = centroid(clipBelow(OUTER.map(p => rot(p, theta))));
  const G = rot([0, yG], theta);
  // după ce marginea punții intră în apă (~35°) corabia își pierde repede stabilitatea (apa intră pe punte)
  const d = theta / D2R, f = d < 35 ? 1 : d < 70 ? 1 - (d - 35) / 35 : -0.3;
  return (sub.x - G[0]) * f; // pozitiv = îndreaptă corabia
}

const BEAUFORT = [
  [0, 'calm, apa e ca oglinda'], [1, 'adiere'], [2.5, 'briză ușoară'], [4.5, 'briză slabă'], [7, 'briză moderată'],
  [9.5, 'vânt potrivit'], [12, 'vânt puternic'], [15, 'vânt foarte puternic'], [19, 'vijelie'], [22.5, 'vijelie puternică'],
  [26, 'furtună'], [30, 'furtună violentă'],
];
const SAILS = {
  all: { A: 1500, h: 22, ro: 'toate pânzele' },
  top: { A: 950, h: 17, ro: 'fără zburători și rândunici' },
  reef: { A: 480, h: 13, ro: 'doar gabierii, cu terțarolele luate' },
  bare: { A: 90, h: 12, ro: 'fără pânze (doar catargele)' },
};
const BALLAST = { little: { yG: -0.15, ro: 'puțin' }, normal: { yG: -0.9, ro: 'normal' }, much: { yG: -1.7, ro: 'mult' } };
const W = 1200; // greutatea corăbiei, în tone
const CLR = -3; // centrul rezistenței laterale (chila), m

const PARTS = {
  chila: { n: 'Chila', f: 'Încovoiere pe valuri (vezi panoul de mai jos)', d: 'Coloana vertebrală: o grindă lungă de stejar pe fundul corăbiei. Pe ea se sprijină totul, inclusiv catargele. Se opune și alunecării laterale când vântul împinge din lateral.' },
  carlinga: { n: 'Carlinga', f: 'Compresiune: aici apasă catargul', d: 'A doua grindă, peste coaste, în interior. Prinde coastele de chilă ca un sandviș și primește piciorul catargului.' },
  coaste: { n: 'Coastele', f: 'Încovoiere: apa le împinge spre interior', d: 'Coastele sunt scheletul corpului: lemn de stejar curbat, la fiecare 30–40 cm. Apa apasă pe ele din toate părțile, mai tare cu cât sunt mai adânci.' },
  bordaj: { n: 'Bordajul (scândurile)', f: 'Presiunea apei + etanșare', d: 'Scânduri groase de stejar (10–15 cm), bătute cu cuie de lemn pe coaste. Între ele se bătea câlți cu smoală, ca să nu intre apa.' },
  grinzi: { n: 'Grinzile punților', f: 'Compresiune: țin pereții depărtați', d: 'Apa împinge pereții spre interior, iar grinzile îi țin depărtați, ca niște proptele. În același timp duc greutatea punților și a tunurilor.' },
  genunchi: { n: 'Genunchii', f: 'Întindere și compresiune: fac din colț un triunghi', d: 'Bucăți de lemn în formă de L (din ramuri crescute strâmb!) care prind grinda de coastă. Un colț drept se poate strâmba, iar un triunghi nu.' },
  pontili: { n: 'Pontilii (stâlpișori)', f: 'Compresiune', d: 'Stâlpi pe mijloc, sub grinzi. Duc greutatea punților până jos la carlingă.' },
  picior: { n: 'Piciorul catargului', f: 'Compresiune foarte mare', d: 'Capătul de jos al catargului intră într-un lăcaș din carlingă (îmbinare „cep în gaură”). Aici ajunge toată forța care apasă catargul în jos.' },
  partener: { n: 'Partenerii și penele', f: 'Forțe laterale: țin catargul drept', d: 'Unde catargul trece prin punte, e strâns într-un cadru întărit, cu pene de lemn bătute cu ciocanul. Puntea ține catargul să nu se încline.' },
  catarg: { n: 'Catargul', f: 'Compresiune + încovoiere', d: 'E apăsat în jos de wanturi (strâns, „compresiune”) și îndoit de vânt. Catargele mari erau făcute din mai multe bucăți de pin, legate cu cercuri de fier.' },
  wantVant: { n: 'Wanturile din partea vântului', f: 'Întindere: trag tare', d: 'Când vântul împinge catargul, wanturile din partea de unde vine vântul se întind și țin catargul. O frânghie poate doar să tragă, nu să împingă.' },
  wantSub: { n: 'Wanturile de sub vânt', f: 'Aproape slăbite', d: 'Pe partea cealaltă, wanturile se slăbesc. Marinarii le strângeau bine în port, ca să nu se clatine catargul când corabia se legăna.' },
  ochi: { n: 'Ochii de lemn (deadeyes)', f: 'Întindere', d: 'Două discuri de lemn cu câte 3 găuri. Parâma trecută prin găuri în zig-zag lucrează ca un scripete: cu mâna tragi puțin, iar wantul se întinde tare.' },
  lant: { n: 'Lanțurile și podina', f: 'Întindere: duc forța în corp', d: 'Wantul se termină cu un lanț de fier prins cu bolțuri în bordaj. Podina (o scândură groasă în afară) depărtează wanturile de catarg, ca triunghiul să fie mai lat și mai puternic.' },
  verga: { n: 'Vergile', f: 'Încovoiere', d: 'Pânza trage de vergă pe toată lungimea ei, ca o greutate pe o bară sprijinită la mijloc.' },
  panza: { n: 'Pânzele', f: 'Întindere în țesătură', d: 'Vântul umflă pânza. Forța crește cu pătratul vitezei vântului: vânt de 2 ori mai tare înseamnă forță de 4 ori mai mare!' },
  G: { n: 'G: centrul de greutate', f: 'Greutatea trage în jos', d: 'Punctul în care putem considera că apasă toată greutatea corăbiei. Balastul pus jos coboară punctul G și face corabia mai stabilă.' },
  B: { n: 'B: centrul împingerii apei', f: 'Apa împinge în sus', d: 'Când corabia se înclină, partea scufundată se mută spre partea care coboară. Atunci și punctul B se mută într-acolo, iar împingerea apei o îndreaptă la loc.' },
};

export function initForces(root) {
  const viewer = initSection(root);
  initBending(root, viewer);
  initMastBuild(root);
  initTriangle(root);
  initQuiz(root);
  return viewer;
}

// ============================================================ 1. secțiunea transversală (modelul 3D real, tăiat prin mijloc)
function initSection(root) {
  const $ = s => root.querySelector(s);
  const host = $('#force3d');
  const ov = $('#cvForceOv'); const g = ov.getContext('2d');
  const v = new ShipViewer(host, { noInteriorUI: true });
  host.appendChild(ov); // stratul cu forțele, deasupra imaginii 3D
  v.setShip('hindostan');
  const ship = v.current; ship.userData.noBob = true;
  const F = ship.userData.hullFns, rig = ship.userData.rig;
  const L = F.L, x0 = rig.mx - 3.3, t0 = x0 / L + 0.5;
  v.fixedClip = { n: new THREE.Vector3(1, 0, 0), c: -x0 }; // păstrăm doar partea din fața tăieturii
  v.setUnderwater(true);
  const deckY = F.deckH(t0) - F.bw, railY = F.deckH(t0), keelY = F.keelY(t0);
  const camHome = () => { v.camera.position.set(x0 - 96, 17, 0.01); v.controls.target.set(x0 + 4, 16, 0); };
  v.sun.position.set(-90, 110, -40); // soarele din spatele privitorului, ca pânzele să fie luminate
  camHome();
  v.controls.minDistance = 25; v.controls.maxDistance = 150;
  v.controls.minAzimuthAngle = -Math.PI / 2 - 0.55; v.controls.maxAzimuthAngle = -Math.PI / 2 + 0.55;
  v.controls.maxPolarAngle = Math.PI * 0.6;
  // conturul secțiunii, luat din corpul 3D
  const OUT3 = [];
  for (let i = 0; i <= 30; i++) { const y = lerp(railY, keelY + 0.05, i / 30); OUT3.push([F.zAt(t0, y), y]); }
  for (let i = 30; i >= 0; i--) { const y = lerp(railY, keelY + 0.05, i / 30); OUT3.push([-F.zAt(t0, y), y]); }

  const st = { bf: 0, sails: 'all', ballast: 'normal', dir: 'side', waves: false, exag: false, pressure: true, hi: null, theta: 0, vel: 0, capsized: false };
  let table = null;
  const buildTable = () => { const yG = BALLAST[st.ballast].yG; table = []; for (let d = 0; d <= 95; d += 0.5) table.push(GZ(d * D2R, yG)); };
  buildTable();
  const gzAt = d => { const i = clamp(d / 0.5, 0, table.length - 1), i0 = Math.floor(i); return lerp(table[i0], table[Math.min(table.length - 1, i0 + 1)], i - i0); };
  function calc() {
    const vv = BEAUFORT[st.bf][0], sp = SAILS[st.sails];
    const kHeel = st.dir === 'side' ? 0.85 : 0.08;
    const Ft = 0.5 * 1.225 * vv * vv * sp.A * 1.2 / 9810, Fh = Ft * kHeel, arm = sp.h - CLR;
    let eq = null, maxD = 0, maxR = 0;
    for (let d = 0; d <= 90; d += 0.25) {
      const R = W * gzAt(d), Hm = Fh * arm * Math.pow(Math.cos(d * D2R), 2);
      if (R > maxR) { maxR = R; maxD = d; }
      if (eq === null && R >= Hm && d > 0) eq = d;
      if (d > maxD + 15 && eq === null) break;
    }
    if (Fh < 0.01) eq = 0;
    if (eq !== null && eq > 45) eq = null;
    return { v: vv, Ft, Fh, arm, eq, sp };
  }
  function applySails() {
    for (const s of ship.userData.sails) {
      const sq = s.userData.sq;
      let on;
      if (st.sails === 'all') on = true;
      else if (st.sails === 'top') on = sq === undefined ? true : sq <= 1;
      else if (st.sails === 'reef') on = sq === 1;
      else on = false;
      s.visible = on; if (s.userData.furl) s.userData.furl.visible = !on;
    }
  }
  const bind = (sel, key, fn) => root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { st[key] = b.dataset.v; root.querySelectorAll(sel).forEach(x => x.setAttribute('aria-pressed', x === b)); if (fn) fn(); }));
  bind('[data-fsails]', 'sails', applySails); bind('[data-fdir]', 'dir');
  bind('[data-fball]', 'ballast', buildTable);
  const bfIn = $('#fWind'); bfIn.addEventListener('input', () => { st.bf = +bfIn.value; });
  $('#fWaves').addEventListener('change', e => st.waves = e.target.checked);
  $('#fExag').addEventListener('change', e => st.exag = e.target.checked);
  $('#fPress').addEventListener('change', e => st.pressure = e.target.checked);
  $('#fReset').addEventListener('click', () => { st.capsized = false; st.theta = 0; st.vel = 0; st.bf = 4; bfIn.value = 4; camHome(); });
  $('#fView').addEventListener('click', camHome);
  root.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => {
    const sc = { port: [0, 'all', 'side', false], briza: [4, 'all', 'side', false], tare: [7, 'all', 'side', false], furtuna: [11, 'all', 'side', true], strans: [11, 'reef', 'side', true], pupa: [7, 'all', 'back', false] }[b.dataset.scen];
    st.capsized = false; st.theta = 0; st.vel = 0; st.bf = sc[0]; bfIn.value = sc[0]; st.sails = sc[1]; st.dir = sc[2]; st.waves = sc[3]; $('#fWaves').checked = sc[3];
    root.querySelectorAll('[data-fsails]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === sc[1]));
    root.querySelectorAll('[data-fdir]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === sc[2]));
    applySails();
  }));
  const chips = $('#fParts');
  chips.innerHTML = Object.entries(PARTS).map(([k, p]) => `<button class="chip" data-p="${k}">${p.n}</button>`).join('');
  chips.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
    st.hi = b.dataset.p; chips.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const p = PARTS[st.hi]; $('#fPartInfo').innerHTML = `<b>${p.n}</b> · <i>${p.f}</i><br>${p.d}`;
  }));

  // proiecția punctelor 3D pe ecran
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  let Wv = 0, Hv = 0, dpr = 1;
  const toWorld = p => p.clone().applyMatrix4(ship.matrixWorld);
  const scr = w => { const q = w.clone().project(v.camera); return [(q.x + 1) / 2 * Wv, (1 - q.y) / 2 * Hv, q.z]; };
  const P = (x, y, z) => scr(toWorld(V3(x, y, z)));
  const xs = x0 + 0.15; // planul tăieturii
  const PARTPOS = () => ({
    chila: V3(xs, keelY - 0.3, 0), carlinga: V3(xs, keelY + 0.7, 0), coaste: V3(xs, -2.5, F.zAt(t0, -2.5) - 0.25),
    bordaj: V3(xs, 1.0, F.zAt(t0, 1.0)), grinzi: V3(xs, 2.25, 2.5), genunchi: V3(xs, 1.9, F.zAt(t0, 1.9) - 0.8), pontili: V3(xs, 0.8, 0.3),
    picior: V3(rig.mx, F.keelY(0.5) + 1.0, 0), partener: V3(rig.mx, deckY + 0.2, 0), catarg: V3(rig.mx, deckY + 12, 0),
    wantVant: rig.feet['-1'][2].clone().lerp(rig.top['-1'], 0.4), wantSub: rig.feet['1'][2].clone().lerp(rig.top['1'], 0.4),
    ochi: rig.feet['-1'][0].clone(), lant: V3(rig.mx - 1, rig.chainY - 1.3, -(F.zAt(t0, rig.chainY - 1.3) + 0.1)),
    verga: V3(rig.mx + 0.7, deckY + 20, -9), panza: V3(rig.mx + 1.5, deckY + 15, -4),
  });
  const streaks = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random() * 0.75, l: 0.3 + Math.random() }));
  let last = performance.now(), t = 0, lastMsg = '';
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    // dimensiunea stratului
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = host.clientWidth, ch = host.clientHeight;
    if (ov.width !== Math.round(cw * dpr) || ov.height !== Math.round(ch * dpr)) { ov.width = Math.round(cw * dpr); ov.height = Math.round(ch * dpr); }
    Wv = cw; Hv = ch;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
    const c = calc();
    let target;
    if (st.capsized || c.eq === null) { st.capsized = true; target = 112; }
    else {
      const gust = st.bf > 2 ? 1 + 0.12 * Math.sin(t * 1.7) * Math.sin(t * 0.63) : 1;
      target = c.eq * gust;
      if (st.waves) target += (3 + st.bf * 0.6) * Math.sin(t * 2 * Math.PI / 7);
    }
    const k = st.capsized ? 0.5 : 2.2;
    st.vel += (k * (target - st.theta) - 1.6 * st.vel) * dt; st.theta += st.vel * dt;
    const th = st.theta * D2R;
    ship.userData.roll = th;
    v.water.material.uniforms.uAmp.value = st.waves ? 1 + st.bf * 0.25 : 1;
    ship.updateMatrixWorld(true);
    // forțele în wanturi și catarg
    const Fm = c.Ft * (st.dir === 'side' ? 0.85 : 0.1) * 0.4 * Math.pow(Math.cos(th), 2);
    const hm = c.sp.h - DECKS.main, b = 6.9, alpha = Math.atan(b / 21), P0 = 3;
    const Tv = (Fm * hm + 10 * Math.sin(th) * 14) / b;
    const Tw = P0 + Tv / Math.cos(alpha), Tl = Math.max(0, P0 - 0.35 * Tv);
    const Cmast = 10 + (Tw + Tl) * Math.cos(alpha);
    // vântul (fire albe care trec prin fața imaginii)
    if (c.v > 0.5 && st.dir === 'side') {
      g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4; g.lineCap = 'round';
      for (const s of streaks) { s.x += c.v * 0.012 * dt * (0.6 + s.l * 0.5); if (s.x > 1.1) { s.x = -0.1; s.y = Math.random() * 0.75; } const X = s.x * cw, Y = s.y * ch; g.beginPath(); g.moveTo(X, Y); g.lineTo(X - s.l * (20 + c.v * 3), Y); g.stroke(); }
      g.restore();
    }
    // presiunea apei pe corp (săgeți spre interior, mai lungi la adâncime)
    if (st.pressure) {
      g.save(); g.strokeStyle = 'rgba(125,211,252,.95)'; g.fillStyle = 'rgba(125,211,252,.95)'; g.lineWidth = 2.2;
      for (let i = 1; i < OUT3.length - 1; i++) {
        const [z, y] = OUT3[i];
        const wp = toWorld(V3(xs, y, z)); const depth = -wp.y; if (depth <= 0.3) continue;
        const [zn, yn] = OUT3[i + 1], [zp, yp] = OUT3[i - 1];
        let nz = -(yn - yp), ny = zn - zp; const nl = Math.hypot(nz, ny) || 1; nz /= nl; ny /= nl;
        if (nz * z + ny * (y + 1) < 0) { nz = -nz; ny = -ny; }
        const len = depth * 0.55;
        const A = P(xs, y + ny * len, z + nz * len), B = P(xs, y, z);
        drawArrowPx(g, A[0], A[1], B[0], B[1], 'rgba(125,211,252,.95)', 2.2, 7);
      }
      g.restore();
    }
    // wanturile catargului mare, colorate după cât trag
    const tensCol = T0 => T0 < 0.8 ? 'rgba(70,50,30,.9)' : `rgb(${Math.round(lerp(90, 30, clamp(T0 / 25, 0, 1)))},${Math.round(lerp(110, 110, 0))},${Math.round(lerp(160, 255, clamp(T0 / 25, 0, 1)))})`;
    for (const sd of ['-1', '1']) {
      const windward = sd === '-1', T0 = windward ? Tw : Tl, slack = T0 < 0.8;
      const hi = st.hi === (windward ? 'wantVant' : 'wantSub');
      const top = P(rig.top[sd].x, rig.top[sd].y, rig.top[sd].z);
      for (const f of rig.feet[sd]) {
        const q = P(f.x, f.y, f.z);
        g.strokeStyle = hi ? '#facc15' : tensCol(T0); g.lineWidth = slack ? 1.5 : 1.8 + clamp(T0 / 25, 0, 1) * 4;
        g.beginPath(); g.moveTo(top[0], top[1]);
        if (slack) g.quadraticCurveTo((top[0] + q[0]) / 2 + (windward ? -12 : 12), (top[1] + q[1]) / 2 + 10, q[0], q[1]); else g.lineTo(q[0], q[1]);
        g.stroke();
      }
    }
    // compresiunea catargului: săgeți roșii care coboară până în chilă
    if (Cmast > 11) {
      const n = 5, top = deckY + 18, bot = keelY + 1.2;
      for (let i = 0; i < n; i++) {
        const f = ((t * 0.35 + i / n) % 1), y = lerp(top, bot, f);
        const A = P(rig.mx, y + 1.6, 0.9), B = P(rig.mx, y, 0.9);
        drawArrowPx(g, A[0], A[1], B[0], B[1], `rgba(220,38,38,${0.4 + 0.6 * clamp(Cmast / 50, 0, 1)})`, 3.5, 9);
      }
      const fp = P(rig.mx, keelY + 1.2, 0.9); label(g, fp[0] + 14, fp[1], `⇩ ${fmt(Cmast)} t pe chilă`, '#fca5a5', true);
    }
    // G și B
    const yG = BALLAST[st.ballast].yG;
    const sub = centroid(clipBelow(OUTER.map(p => rot(p, th))));
    const Bloc = rot([sub.x, sub.y], -th);
    const Gw = toWorld(V3(xs, yG, 0)), Bw = toWorld(V3(xs, Bloc[1], Bloc[0]));
    const Gs = scr(Gw), Bs = scr(Bw);
    const Ge = scr(Gw.clone().add(V3(0, -7, 0))), Be = scr(Bw.clone().add(V3(0, 7, 0)));
    drawArrowPx(g, Gs[0], Gs[1], Ge[0], Ge[1], '#ef4444', 5, 14); label(g, Ge[0] + 10, Ge[1] - 4, 'greutatea', '#ef4444');
    drawArrowPx(g, Bs[0], Bs[1], Be[0], Be[1], '#22c55e', 5, 14); label(g, Be[0] + 10, Be[1] + 12, 'împingerea apei', '#16a34a');
    dot(g, Gs, '#dc2626', 'G', st.hi === 'G'); dot(g, Bs, '#16a34a', 'B', st.hi === 'B');
    if (!st.capsized && Math.abs(Bs[0] - Gs[0]) > 4) { g.save(); g.setLineDash([5, 4]); g.strokeStyle = '#fde68a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(Gs[0], Gs[1] + 26); g.lineTo(Bs[0], Gs[1] + 26); g.stroke(); g.restore(); label(g, Math.max(Gs[0], Bs[0]) + 8, Gs[1] + 30, 'brațul care o îndreaptă', '#fde68a', true); }
    // vântul pe pânze și apa care ține chila
    if (c.Fh > 0.05 && st.dir === 'side') {
      const ce = toWorld(V3(rig.mx, c.sp.h, 0));
      const len = clamp(c.Fh * 0.55, 2, 22);
      const A = scr(ce.clone().add(V3(0, 0, -14 - len))), B = scr(ce.clone().add(V3(0, 0, -12)));
      drawArrowPx(g, A[0], A[1], B[0], B[1], '#2563eb', 8, 20); label(g, A[0], A[1] - 14, `vântul împinge pânzele: ${fmt(c.Ft * 0.85)} t`, '#93c5fd', true);
      const kw = toWorld(V3(xs, keelY - 0.2, 0));
      const K1 = scr(kw.clone().add(V3(0, 0, 3 + len * 0.5))), K2 = scr(kw.clone().add(V3(0, 0, 0.6)));
      drawArrowPx(g, K1[0], K1[1], K2[0], K2[1], '#f97316', 6, 16); label(g, K1[0] + 8, K1[1] + 4, 'apa ține chila', '#fdba74', true);
    }
    if (st.dir === 'back' && c.Ft > 0.05) label(g, cw / 2, 26, `⊗ vântul vine din spate și împinge corabia înainte (spre tine se vede pupa): ${fmt(c.Ft)} t`, '#93c5fd', true, 'center');
    // piesa aleasă: un cerc care pulsează
    if (st.hi && st.hi !== 'G' && st.hi !== 'B') {
      const pp = PARTPOS()[st.hi];
      if (pp) { const q = P(pp.x, pp.y, pp.z); const r = 16 + 4 * Math.sin(t * 5); g.save(); g.strokeStyle = '#facc15'; g.lineWidth = 4; g.shadowColor = '#000'; g.shadowBlur = 6; g.beginPath(); g.arc(q[0], q[1], r, 0, Math.PI * 2); g.stroke(); g.restore(); label(g, q[0] + r + 6, q[1] - r, PARTS[st.hi].n, '#fde68a', true); }
    }
    // caseta cu înclinarea
    g.fillStyle = 'rgba(15,23,42,.78)'; g.fillRect(12, 12, 250, 58);
    g.fillStyle = '#fff'; g.font = '700 22px "Segoe UI"'; g.textAlign = 'left';
    g.fillText(st.capsized ? 'RĂSTURNATĂ!' : `înclinare ${Math.abs(st.theta).toFixed(0)}°`, 22, 40);
    g.font = '13px "Segoe UI"'; g.fillText(`vânt: ${BEAUFORT[st.bf][1]} (${st.bf} Beaufort)`, 22, 60);
    const portLee = rot([hw(DECKS.gun + 0.9), DECKS.gun + 0.9], th);
    const flooding = portLee[1] < 0 && !st.capsized;
    // valorile
    $('#fV').textContent = `${c.v} m/s (${Math.round(c.v * 3.6)} km/h)`;
    $('#fF').textContent = `${fmt(c.Ft)} t`;
    $('#fFc').textContent = `cât ${Math.max(0, Math.round(c.Ft / 1.3))} mașini`;
    $('#fHeel').textContent = st.capsized ? '—' : `${Math.abs(st.theta).toFixed(0)}°`;
    $('#fTw').textContent = `${fmt(Tw)} t`;
    $('#fTl').textContent = Tl < 0.8 ? 'slăbite' : `${fmt(Tl)} t`;
    $('#fC').textContent = `${fmt(Cmast)} t`;
    $('#fP').textContent = `${(-rot([0, KEEL], th)[1]).toFixed(1).replace('.', ',')} t/m²`;
    let msg, cls = 'say';
    if (st.capsized) { msg = '💥 <b>Corabia s-a răsturnat!</b> Forța vântului pe pânze a fost mai mare decât poate îndrepta greutatea. Căpitanii strângeau pânzele <b>înainte</b> de furtună. Apasă „De la capăt”.'; cls = 'say warn'; }
    else if (flooding) { msg = '⚠️ <b>Porturile de tun de sub vânt intră în apă!</b> Corabia se poate umple. Strânge pânzele sau pune mai mult balast.'; cls = 'say warn'; }
    else if (c.v < 0.5) msg = 'Fără vânt corabia stă dreaptă. Wanturile sunt totuși strânse („pretensionate”), iar catargul apasă pe chilă cu greutatea lui. Mută glisorul vântului!';
    else if (st.dir === 'back') msg = 'Cu vântul din spate, corabia aproape nu se înclină: forța o împinge <b>înainte</b>. Catargul vrea să cadă în față, așa că acum trag <b>patarainele</b> (frânghiile din spate).';
    else if (st.theta > 22) msg = `Vânt prea puternic pentru „${c.sp.ro}”. Wanturile din vânt trag cu ${fmt(Tw)} t. Încearcă <b>„Strânge pânzele”</b>.`;
    else msg = `Vântul împinge pânzele cu ${fmt(c.Ft)} t, sus, departe de apă. Ca la o pârghie, forța mică de sus face o forță mare jos: wanturile trag cu ${fmt(Tw)} t, iar catargul apasă pe chilă cu ${fmt(Cmast)} t. Greutatea (G) și împingerea apei (B) se depărtează și îndreaptă corabia.`;
    if (msg !== lastMsg) { lastMsg = msg; const s = $('#fSay'); s.className = cls; s.innerHTML = msg; }
  }
  requestAnimationFrame(loop);
  v.start();
  return v;
}
function drawArrowPx(g, x0, y0, x1, y1, col, w, head) {
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 3;
  const a = Math.atan2(y1 - y0, x1 - x0), h = head || 8 + w * 1.6;
  const ex = x1 - Math.cos(a) * h * 0.6, ey = y1 - Math.sin(a) * h * 0.6;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(ex, ey); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - h * Math.cos(a - 0.42), y1 - h * Math.sin(a - 0.42)); g.lineTo(x1 - h * Math.cos(a + 0.42), y1 - h * Math.sin(a + 0.42)); g.closePath(); g.fill();
  g.restore();
}
function label(g, x, y, text, col, box, align = 'left') {
  g.save(); g.font = '700 13px "Segoe UI", system-ui, sans-serif'; g.textAlign = align;
  if (box) { const w = g.measureText(text).width; const bx = align === 'center' ? x - w / 2 - 6 : x - 6; g.fillStyle = 'rgba(15,23,42,.72)'; g.fillRect(bx, y - 14, w + 12, 20); g.fillStyle = col; g.fillText(text, x, y); }
  else { g.lineWidth = 3.5; g.strokeStyle = 'rgba(255,255,255,.92)'; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y); }
  g.restore();
}

function fmt(x) { return x < 10 ? x.toFixed(1).replace('.', ',') : Math.round(x).toString(); }
function arrow(g, x0, y0, x1, y1, col, w, label) {
  g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0), h = 8 + w * 1.6;
  g.beginPath(); g.moveTo(x1 + Math.cos(a) * 4, y1 + Math.sin(a) * 4); g.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45)); g.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); g.closePath(); g.fill();
  if (label) {
    g.font = '700 13px "Segoe UI"'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)';
    let lx, ly; const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
    if (vertical) { g.textAlign = 'left'; lx = x1 + 10; ly = y1 + (y1 > y0 ? -4 : 12); } else { g.textAlign = 'center'; lx = (x0 + x1) / 2; ly = y0 - 10; }
    g.strokeText(label, lx, ly); g.fillText(label, lx, ly);
  }
  g.restore();
}
function dot(g, p, col, txt, hi) {
  g.save(); g.fillStyle = '#fff'; g.strokeStyle = hi ? '#facc15' : col; g.lineWidth = hi ? 5 : 3;
  g.beginPath(); g.arc(p[0], p[1], 10, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = col; g.font = '700 13px "Segoe UI"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, p[0], p[1] + 1); g.restore();
}

// ------------------------------------------------------------ texturi desenate (lemn, frânghie, fier)
const PATC = {};
function woodCanvas(key, base, dark, light, vertical) {
  if (PATC[key]) return PATC[key];
  const c = document.createElement('canvas'); c.width = vertical ? 64 : 256; c.height = vertical ? 256 : 64;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  const n = 26;
  for (let i = 0; i < n; i++) {
    g.strokeStyle = i % 3 ? dark : light; g.globalAlpha = 0.18 + Math.random() * 0.25; g.lineWidth = 0.6 + Math.random() * 1.4;
    g.beginPath();
    const off = Math.random() * (vertical ? 64 : 64), amp = 1 + Math.random() * 3, fr = 0.02 + Math.random() * 0.04;
    for (let s = 0; s <= (vertical ? 256 : 256); s += 4) {
      const a = off + Math.sin(s * fr + i) * amp;
      if (vertical) s ? g.lineTo(a, s) : g.moveTo(a, s); else s ? g.lineTo(s, a) : g.moveTo(s, a);
    }
    g.stroke();
  }
  g.globalAlpha = 0.35; g.fillStyle = dark;
  for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(Math.random() * c.width, Math.random() * c.height, vertical ? 3 : 8, vertical ? 8 : 3, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  PATC[key] = c; return c;
}
const pats = new WeakMap();
function wood(g, kind) {
  let m = pats.get(g); if (!m) { m = {}; pats.set(g, m); }
  if (m[kind]) return m[kind];
  const C = {
    oak: woodCanvas('oak', '#5b3c22', '#2e1d0f', '#7a5634'), oakV: woodCanvas('oakV', '#5b3c22', '#2e1d0f', '#7a5634', true),
    pine: woodCanvas('pineV', '#c9a066', '#8a6436', '#e2c08a', true), pineH: woodCanvas('pineH', '#c9a066', '#8a6436', '#e2c08a'),
    deck: woodCanvas('deck', '#a9875e', '#6e5232', '#c8a77a'), plank: woodCanvas('plank', '#3a2a1a', '#1c130a', '#5a412a'),
  }[kind];
  m[kind] = g.createPattern(C, 'repeat'); return m[kind];
}
function shadeBar(g, x, y, w, h, vertical) { // umbrire cilindrică peste o bară
  const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(0.35, 'rgba(255,255,255,.12)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
function iron(g, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(0.45, '#3b3f44'); gr.addColorStop(1, '#16181b');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}
function rope(g, x0, y0, x1, y1, w, col = '#3a2a18', hi = 'rgba(200,170,120,.55)', sag = 0) {
  g.save(); g.lineCap = 'round';
  const path = () => { g.beginPath(); g.moveTo(x0, y0); if (sag) g.quadraticCurveTo((x0 + x1) / 2 + sag, (y0 + y1) / 2 + Math.abs(sag) * 0.6, x1, y1); else g.lineTo(x1, y1); };
  path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
  if (w >= 2) { path(); g.strokeStyle = hi; g.lineWidth = Math.max(1, w * 0.45); g.setLineDash([w * 0.9, w * 0.9]); g.stroke(); }
  g.restore();
}
function skyAndSea(g, Wc, OY, Hc, t) {
  const sky = g.createLinearGradient(0, 0, 0, OY); sky.addColorStop(0, '#6fa6d6'); sky.addColorStop(0.7, '#c4ddef'); sky.addColorStop(1, '#e6f0f6');
  g.fillStyle = sky; g.fillRect(0, 0, Wc, OY);
  g.save(); g.globalAlpha = 0.7;
  for (const [cx, cy, r] of [[120, 60, 40], [170, 50, 55], [230, 64, 38], [640, 90, 34], [700, 76, 50], [760, 92, 36]]) {
    const gr = g.createRadialGradient(cx + Math.sin(t * 0.05) * 20, cy, 4, cx + Math.sin(t * 0.05) * 20, cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx + Math.sin(t * 0.05) * 20, cy, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ============================================================ 2. corabia pe val: cocoașă și șa (imaginea corăbiei 3D, îndoită)
function initBending(root, viewer) {
  const cv = root.querySelector('#cvBend'); const g = cv.getContext('2d');
  const Wc = cv.width = 1200, Hc = cv.height = 640;
  const $ = s => root.querySelector(s);
  const L = 50, N = 51, S = 12.5, OX = 520, OY = 520;
  const st = { h: 3, run: true, phase: 0 };
  $('#bH').addEventListener('input', e => st.h = +e.target.value);
  $('#bRun').addEventListener('click', () => { st.run = !st.run; $('#bRun').textContent = st.run ? '⏸ Oprește valul' : '▶ Pornește valul'; });
  root.querySelectorAll('[data-bpos]').forEach(b => b.addEventListener('click', () => { st.run = false; $('#bRun').textContent = '▶ Pornește valul'; st.phase = b.dataset.bpos === 'crest' ? 0 : Math.PI; }));
  // imaginea laterală a corăbiei Hindostan, randată din modelul 3D
  let img = null, info = null;
  try { info = viewer.sideImage('hindostan', 22); img = new Image(); img.src = info.url; } catch (e) { img = null; }
  const ship = viewer.getShip('hindostan'), F = ship.userData.hullFns;
  const xs = Array.from({ length: N }, (_, i) => -L / 2 + L * i / (N - 1));
  const width = x => { const u = Math.abs(2 * x / L); return u < 0.6 ? 1 : Math.max(0.15, 1 - (u - 0.6) / 0.4 * 0.85); };
  const qShape = xs.map(x => (1 + 0.35 * Math.cos(Math.PI * x / L)) * width(x));
  const qSum = qShape.reduce((a, b) => a + b, 0);
  let last = performance.now(), lastMode = '', t = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (st.run) st.phase += dt * 0.7;
    const A = st.h / 2;
    const eta = x => A * Math.cos(2 * Math.PI * x / L - st.phase);
    const keelY = -6.2;
    const buoyAt = (x, s) => Math.max(0, eta(x) - (keelY + s)) * width(x);
    const target = xs.reduce((a, x) => a + -keelY * width(x), 0);
    let lo = -8, hi = 8;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; const B = xs.reduce((a, x) => a + buoyAt(x, m), 0); if (B > target) lo = m; else hi = m; }
    const s = (lo + hi) / 2;
    const b = xs.map(x => buoyAt(x, s)), Btot = b.reduce((a, v) => a + v, 0);
    const q = qShape.map(v => v * Btot / qSum);
    let acc = 0, mm = 0; const M = [];
    for (let i = 0; i < N; i++) { acc += b[i] - q[i]; mm += acc; M.push(mm); }
    const Mmid = M[Math.floor(N / 2)];
    const k = clamp(-Mmid / (45 * Math.max(0.5, st.h)), -1.2, 1.2); // >0 cocoașă (creasta la mijloc), <0 șa
    const def = x => { const u = clamp(2 * x / L, -1.15, 1.15); return k * 1.1 * (1 - u * u); };
    const sx = x => OX + x * S, sy = y => OY - y * S;
    // cer, nori
    skyAndSea(g, Wc, OY, Hc, t);
    // marea din spate
    const back = g.createLinearGradient(0, OY - 40, 0, Hc); back.addColorStop(0, '#3f7ea6'); back.addColorStop(1, '#0d2f47');
    g.fillStyle = back; g.beginPath(); g.moveTo(0, Hc);
    for (let px = 0; px <= Wc; px += 6) g.lineTo(px, sy(eta((px - OX) / S) * 0.75 + 0.6));
    g.lineTo(Wc, Hc); g.fill();
    // corabia: imaginea 3D tăiată în fâșii verticale, fiecare mutată după îndoire
    if (img && img.complete && img.naturalWidth) {
      const pxm = 22, step = 3;
      for (let col = 0; col < info.w; col += step) {
        const x = info.x0 + (col + step / 2) / pxm;
        const dy = s + def(x);
        const dx = sx(info.x0 + col / pxm), dw = step / pxm * S + 0.6;
        g.drawImage(img, col, 0, step, info.h, dx, sy(info.y1 + dy), dw, info.h / pxm * S);
      }
    }
    // apa din față: acoperă partea de sub linia apei, transparentă
    const front = g.createLinearGradient(0, OY - 20, 0, Hc); front.addColorStop(0, 'rgba(38,105,145,.62)'); front.addColorStop(1, 'rgba(10,40,62,.9)');
    g.fillStyle = front; g.beginPath(); g.moveTo(0, Hc);
    for (let px = 0; px <= Wc; px += 5) g.lineTo(px, sy(eta((px - OX) / S)));
    g.lineTo(Wc, Hc); g.fill();
    // spuma de pe creste
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5; g.beginPath();
    for (let px = 0; px <= Wc; px += 5) { const x = (px - OX) / S; px ? g.lineTo(px, sy(eta(x))) : g.moveTo(px, sy(eta(x))); } g.stroke();
    for (let px = 0; px <= Wc; px += 14) { const x = (px - OX) / S, e = eta(x); if (e > A * 0.7) { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(px + Math.sin(px + t * 3) * 3, sy(e) + 3, 2.5, 0, Math.PI * 2); g.fill(); } }
    // puntea și chila colorate (albastru = întindere, roșu = compresiune)
    const colOf = sgn => { const a = clamp(Math.abs(k), 0, 1); return sgn > 0 ? `rgba(59,130,246,${0.3 + 0.6 * a})` : `rgba(239,68,68,${0.3 + 0.6 * a})`; };
    const line = (yf, col) => { g.save(); g.strokeStyle = col; g.lineWidth = 7; g.lineCap = 'round'; g.shadowColor = col; g.shadowBlur = 8; g.beginPath(); xs.forEach((x, i) => { const y = yf(x) + s + def(x); i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y)); }); g.stroke(); g.restore(); };
    if (Math.abs(k) > 0.08) { line(x => F.deckH(x / L + 0.5) + 0.2, colOf(k)); line(x => F.keelY(clamp(x / L + 0.5, 0, 0.97)) - 0.2, colOf(-k)); }
    // forțele: greutatea (roșu, în jos) și împingerea apei (verde, în sus)
    for (let i = 3; i < N - 2; i += 4) {
      const x = xs[i], yb = F.keelY(clamp(x / L + 0.5, 0, 0.97)) + s + def(x);
      const lb = b[i] * 8, lq = q[i] * 8;
      if (lb > 3) drawArrowPx(g, sx(x) + 6, sy(yb) + lb + 6, sx(x) + 6, sy(yb) + 4, 'rgba(34,197,94,.95)', 3.2, 10);
      const yd = F.deckH(x / L + 0.5) + s + def(x);
      drawArrowPx(g, sx(x) - 6, sy(yd) - 30, sx(x) - 6, sy(yd) - 30 + lq, 'rgba(239,68,68,.95)', 3.2, 10);
    }
    if (Math.abs(k) > 0.15) {
      const tens = k > 0;
      label(g, OX, sy(F.deckH(0.5) + s + def(0)) - 46, tens ? '⟵  puntea se întinde  ⟶' : '⟶  puntea se strânge  ⟵', tens ? '#93c5fd' : '#fca5a5', true, 'center');
      label(g, OX, sy(F.keelY(0.5) + s + def(0)) + 44, tens ? '⟶  chila se strânge  ⟵' : '⟵  chila se întinde  ⟶', tens ? '#fca5a5' : '#93c5fd', true, 'center');
    }
    const mode = Math.abs(k) < 0.15 ? 'flat' : k > 0 ? 'hog' : 'sag';
    g.fillStyle = 'rgba(15,23,42,.8)'; g.fillRect(14, 14, 360, 60);
    g.fillStyle = '#fff'; g.font = '700 22px "Segoe UI"'; g.textAlign = 'left';
    g.fillText(mode === 'hog' ? 'COCOAȘĂ (hogging)' : mode === 'sag' ? 'ȘA (sagging)' : 'echilibru', 26, 44);
    g.font = '14px "Segoe UI"'; g.fillText(mode === 'hog' ? 'creasta valului e la mijloc, capetele atârnă' : mode === 'sag' ? 'creste la capete, mijlocul atârnă' : 'apa ține corabia uniform', 26, 64);
    label(g, Wc - 14, Hc - 14, '🔴 greutatea   🟢 împingerea apei   (îndoirea e mărită de multe ori ca să se vadă)', '#e2e8f0', true, 'right');
    if (mode !== lastMode) {
      lastMode = mode;
      $('#bSay').innerHTML = mode === 'hog'
        ? '<b>Cocoașă:</b> valul ține corabia doar la mijloc. Capetele, grele, atârnă în jos și corabia se îndoaie ca o cocoașă. <b>Puntea se întinde</b>, iar <b>chila se strânge</b>. După ani de navigație, multe corăbii de lemn rămâneau „cocoșate” de-a binelea!'
        : mode === 'sag' ? '<b>Șa:</b> două creste țin corabia la capete, iar mijlocul, încărcat, atârnă. Acum <b>puntea se strânge</b> și <b>chila se întinde</b>. Așa, de câteva ori pe minut, pe fiecare val.'
          : 'Când apa ține corabia la fel peste tot, corpul nu se îndoaie. Pe valuri însă se îndoaie mereu, într-o parte și în alta. De aceea chila, carlinga și scândurile lungi trebuie să fie foarte rezistente.';
    }
  }
  requestAnimationFrame(loop);
}

// ============================================================ 3. cum se leagă catargul, pas cu pas
const BUILD = [
  { t: 'Chila, coastele și carlinga', d: 'Totul pornește de jos: <b>chila</b> (coloana vertebrală), <b>coastele</b> (scheletul) și <b>carlinga</b>, grinda de deasupra chilei. Aici se va sprijini catargul.', why: 'Catargul apasă cu zeci de tone. Forța trebuie dusă direct în cea mai tare parte a corăbiei: chila.' },
  { t: 'Piciorul catargului: cep în lăcaș', d: 'Capătul de jos al catargului e tăiat ca un <b>cep</b> pătrat și intră într-un <b>lăcaș</b> săpat în carlingă (îmbinare „cep în gaură”, <i>mast step</i>).', why: 'Cepul împiedică piciorul să alunece sau să se rotească, iar forța se împarte pe o suprafață mare.' },
  { t: 'Trecerea prin punți: parteneri și pene', d: 'La fiecare punte, catargul trece printr-o gaură întărită cu un cadru gros (<b>parteneri</b>). Golul se umple cu <b>pene de lemn</b> bătute cu ciocanul.', why: 'Punțile țin catargul drept ca niște mâini care îl strâng în trei locuri. Fără pene, catargul ar „juca” și ar rupe puntea.' },
  { t: 'Un catarg din mai multe bucăți', d: 'Catargul de jos al unei corăbii mari avea aproape 1 m grosime. Nu exista un copac atât de gros și de drept, așa că era făcut din <b>mai multe bucăți de pin</b> lipite, strânse cu <b>cercuri de fier</b> bătute la cald.', why: 'Fierul încălzit se strânge când se răcește și presează bucățile ca un inel pe deget. Pinul e lung, drept, ușor și se îndoaie fără să se rupă.' },
  { t: 'Gabia și gabierul, ținut de un cui', d: 'Deasupra se pune <b>gabia</b> (platforma) și un catarg mai subțire, <b>gabierul</b>. El urcă printr-un <b>capac</b> și stă sprijinit pe un <b>cui gros de fier</b> (<i>fid</i>).', why: 'Pe furtună, gabierul se putea coborî: se scotea cuiul și catargul aluneca în jos. Corabia avea astfel mai puțină greutate sus și se înclina mai puțin.' },
  { t: 'Wanturile cu ochi de lemn', d: '<b>Wanturile</b> leagă vârful catargului de marginile corăbiei. Jos se termină cu doi <b>ochi de lemn</b> cu câte 3 găuri, prin care trece în zig-zag o <b>parâmă de întindere</b>.', why: 'Parâma trece de 6 ori între ochi, ca un scripete: tragi cu 10 kg și wantul se întinde cu aproape 60 kg. Așa wanturile puteau fi strânse foarte tare cu mâna.' },
  { t: 'Lanțurile și podinele', d: 'Ochiul de jos e prins cu un <b>lanț de fier</b> bătut cu bolțuri în bordaj. O scândură groasă care iese în afară, <b>podina</b>, depărtează wanturile de catarg.', why: 'Cu cât baza triunghiului e mai lată, cu atât wanturile țin catargul cu mai puțină forță. Lanțul duce forța în coastele corăbiei.' },
  { t: 'Straiuri și pataraine: triunghiuri peste tot', d: 'Spre față, catargul e ținut de <b>straiuri</b>, iar spre spate de <b>pataraine</b>. Împreună cu wanturile, formează <b>triunghiuri</b> în toate direcțiile.', why: 'Triunghiul este singura formă care nu se strâmbă când o împingi. Catargul (apăsat) și frânghiile (întinse) fac împreună o structură rigidă.' },
  { t: 'Totul lucrează: vine vântul', d: 'Vântul împinge pânzele. Wanturile din vânt se întind (<span style="color:#2563eb">albastru</span>), catargul e apăsat în jos (<span style="color:#dc2626">roșu</span>), iar forța coboară prin punți până la carlingă și chilă.', why: 'Fiecare piesă face un singur lucru: frânghiile trag, lemnul ține. Inginerii numesc asta <b>întindere</b> (tensiune) și <b>compresiune</b>.' },
];
function initMastBuild(root) {
  const cv = root.querySelector('#cvMast'); const g = cv.getContext('2d');
  const Wc = cv.width = 960, Hc = cv.height = 720;
  const $ = s => root.querySelector(s);
  let step = 0, stepT = 0, auto = false, autoT = 0;
  const list = $('#mSteps');
  list.innerHTML = BUILD.map((b, i) => `<li data-i="${i}"><b>${b.t}</b></li>`).join('');
  list.querySelectorAll('li').forEach(li => li.addEventListener('click', () => go(+li.dataset.i)));
  function go(i) { step = clamp(i, 0, BUILD.length - 1); stepT = 0; const B = BUILD[step]; $('#mText').innerHTML = `<h3>${step + 1}. ${B.t}</h3><p>${B.d}</p><p class="why"><b>De ce?</b> ${B.why}</p>`; [...list.children].forEach((li, k) => { li.classList.toggle('now', k === step); li.classList.toggle('done', k < step); }); }
  $('#mPrev').addEventListener('click', () => go(step - 1));
  $('#mNext').addEventListener('click', () => go(step + 1));
  $('#mAuto').addEventListener('click', () => { auto = !auto; autoT = 0; $('#mAuto').textContent = auto ? '⏸ Oprește' : '▶ Arată tot'; if (auto && step === BUILD.length - 1) go(0); });
  go(0);
  // vedere laterală, tăiată prin mijlocul corăbiei
  const S = 13, OX = 480, OY = 540;
  const sx = x => OX + x * S, sy = y => OY - y * S;
  const KE = -6.2, KS = KE + 1.25, DK = [5.1, 2.4, -0.8], RAILY = 6.4, TOP = 5.1 + 21, MT = 5.1 + 33;
  const HX = 17; // jumătatea porțiunii de corp desenate
  let last = performance.now(), t = 0;
  const hiCol = 'rgba(250,204,21,.55)';
  function hiRect(x, y, w, h) { g.save(); g.strokeStyle = '#facc15'; g.lineWidth = 3; g.shadowColor = '#facc15'; g.shadowBlur = 12; g.strokeRect(x, y, w, h); g.restore(); }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; stepT += dt;
    if (auto) { autoT += dt; if (autoT > 6) { autoT = 0; if (step < BUILD.length - 1) go(step + 1); else { auto = false; $('#mAuto').textContent = '▶ Arată tot'; } } }
    const e = k => clamp((stepT - k) / 1.2, 0, 1);
    const show = i => step >= i, now_ = i => step === i;
    // cerul, marea
    skyAndSea(g, Wc, OY, Hc, t);
    const sea = g.createLinearGradient(0, OY, 0, Hc); sea.addColorStop(0, '#2f6f96'); sea.addColorStop(1, '#0c2a40');
    g.fillStyle = sea; g.fillRect(0, OY, Wc, Hc - OY);
    // bordajul exterior (scânduri închise la culoare) – conturul tăieturii
    g.fillStyle = wood(g, 'plank'); g.fillRect(sx(-HX), sy(RAILY), 2 * HX * S, (RAILY - KE) * S);
    // interiorul calei, luminat de felinare
    g.fillStyle = '#24170c'; g.fillRect(sx(-HX + 0.5), sy(RAILY - 0.5), (2 * HX - 1) * S, (RAILY - KE - 1.3) * S);
    // coastele (stejar), una lângă alta
    for (let x = -HX + 0.8; x <= HX - 0.8; x += 1.3) { g.fillStyle = wood(g, 'oakV'); g.fillRect(sx(x), sy(RAILY - 0.4), 0.55 * S, (RAILY - KE - 1.1) * S); shadeBar(g, sx(x), sy(RAILY - 0.4), 0.55 * S, (RAILY - KE - 1.1) * S, true); }
    if (now_(0)) hiRect(sx(-HX + 0.8), sy(RAILY - 0.4), (2 * HX - 1.6) * S, (RAILY - KE - 1.1) * S);
    // lumina caldă a felinarelor
    for (const [lx, ly] of [[-9, 1.0], [9, 1.0], [-9, -3.4], [9, -3.4], [-9, 3.9], [9, 3.9]]) {
      const gr = g.createRadialGradient(sx(lx), sy(ly), 2, sx(lx), sy(ly), 90); gr.addColorStop(0, 'rgba(255,190,90,.55)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr; g.fillRect(sx(lx) - 90, sy(ly) - 90, 180, 180);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(sx(lx), sy(ly) + 4, 3.5, 0, Math.PI * 2); g.fill();
    }
    // chila și carlinga
    g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-HX), sy(KE + 0.3), 2 * HX * S, 1.0 * S); shadeBar(g, sx(-HX), sy(KE + 0.3), 2 * HX * S, 1.0 * S, false);
    g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-HX + 0.5), sy(KS), (2 * HX - 1) * S, (KS - KE - 0.3) * S); shadeBar(g, sx(-HX + 0.5), sy(KS), (2 * HX - 1) * S, (KS - KE - 0.3) * S, false);
    if (now_(0)) { hiRect(sx(-HX), sy(KE + 0.3), 2 * HX * S, 1.0 * S); hiRect(sx(-HX + 0.5), sy(KS), (2 * HX - 1) * S, (KS - KE - 0.3) * S); label(g, sx(-HX + 1), sy(KE) + 18, 'chila', '#fde68a', true); label(g, sx(-HX + 1), sy(KS) - 6, 'carlinga', '#fde68a', true); }
    // punțile, cu grinzi
    for (const y of DK) {
      g.fillStyle = wood(g, 'deck'); g.fillRect(sx(-HX + 0.5), sy(y), (2 * HX - 1) * S, 0.38 * S); shadeBar(g, sx(-HX + 0.5), sy(y), (2 * HX - 1) * S, 0.38 * S, false);
      for (let x = -HX + 1; x < HX - 1; x += 1.3) { g.fillStyle = wood(g, 'oak'); g.fillRect(sx(x), sy(y - 0.38), 0.5 * S, 0.45 * S); }
    }
    // parapetul și copastia
    g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-HX), sy(RAILY + 0.2), 2 * HX * S, 0.4 * S);
    // lăcașul piciorului
    if (show(1)) {
      g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-1.4), sy(KS + 1.0), 2.8 * S, 1.0 * S); shadeBar(g, sx(-1.4), sy(KS + 1.0), 2.8 * S, 1.0 * S, false);
      g.fillStyle = '#0d0905'; g.fillRect(sx(-0.42), sy(KS + 1.0), 0.84 * S, 0.75 * S);
      if (now_(1)) { hiRect(sx(-1.4), sy(KS + 1.0), 2.8 * S, 1.0 * S); label(g, sx(1.7), sy(KS + 0.4), 'lăcașul din carlingă', '#fde68a', true); }
    }
    // catargul de jos, din pin, coboară în lăcaș
    if (show(1)) {
      const drop = now_(1) ? (1 - e(0.2)) * 6 : 0, w = 0.95;
      const x = sx(-w / 2), y = sy(TOP + drop), h = (TOP - KS) * S;
      g.fillStyle = wood(g, 'pine'); g.fillRect(x, y, w * S, h); shadeBar(g, x, y, w * S, h, true);
      g.fillStyle = wood(g, 'pine'); g.fillRect(sx(-0.4), sy(KS + drop + 0.0), 0.8 * S, 0.75 * S); shadeBar(g, sx(-0.4), sy(KS + drop), 0.8 * S, 0.75 * S, true);
      if (now_(1)) label(g, sx(0.8), sy(KS + drop + 1.3), 'cepul catargului', '#fde68a', true);
      if (show(3)) {
        g.strokeStyle = 'rgba(70,45,20,.85)'; g.lineWidth = 1.5;
        for (const dx of [-0.22, 0.0, 0.22]) { g.beginPath(); g.moveTo(sx(dx), sy(TOP)); g.lineTo(sx(dx), sy(KS + 0.75)); g.stroke(); }
        const nh = now_(3) ? Math.floor(e(0.2) * 13) : 13;
        for (let i = 0; i < nh; i++) {
          const yy = DK[0] + 1.2 + i * 1.3; if (yy > TOP - 1) break;
          iron(g, sx(-0.6), sy(yy), 1.2 * S, 0.32 * S);
          if (now_(3) && i === nh - 1) { const gl = g.createRadialGradient(sx(0), sy(yy), 2, sx(0), sy(yy), 28); gl.addColorStop(0, 'rgba(255,120,30,.9)'); gl.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gl; g.fillRect(sx(0) - 30, sy(yy) - 30, 60, 60); }
        }
        if (now_(3)) label(g, sx(1.2), sy(DK[0] + 6), 'cercuri de fier, bătute la cald', '#fde68a', true);
      }
    }
    // partenerii și penele
    if (show(2)) for (const y of DK) {
      g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-1.4), sy(y + 0.2), 2.8 * S, 0.75 * S); shadeBar(g, sx(-1.4), sy(y + 0.2), 2.8 * S, 0.75 * S, false);
      const k = now_(2) ? e(0.3) : 1;
      for (const sd of [-1, 1]) {
        const x0 = sd * (0.47 + (1 - k) * 1.6), yo = (1 - k) * 2.2;
        g.fillStyle = wood(g, 'pineH'); g.beginPath(); g.moveTo(sx(x0), sy(y + 0.55 + yo)); g.lineTo(sx(x0 + sd * 0.3), sy(y + 0.55 + yo)); g.lineTo(sx(x0), sy(y - 0.45 + yo)); g.closePath(); g.fill();
        g.strokeStyle = '#5a3d1f'; g.lineWidth = 1; g.stroke();
      }
      if (now_(2) && k < 1) { iron(g, sx(1.7), sy(y + 3 + Math.abs(Math.sin(t * 10)) * 1.2), 0.9 * S, 0.5 * S); g.fillStyle = wood(g, 'pine'); g.fillRect(sx(2.0), sy(y + 3 + Math.abs(Math.sin(t * 10)) * 1.2) + 6, 0.2 * S, 2.0 * S); }
      if (now_(2)) hiRect(sx(-1.4), sy(y + 0.2), 2.8 * S, 0.75 * S);
    }
    if (now_(2)) label(g, sx(1.8), sy(DK[0] + 1.8), 'parteneri și pene', '#fde68a', true);
    // gabia, gabierul, capacul și cuiul
    if (show(4)) {
      g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-3.3), sy(TOP + 0.25), 6.6 * S, 0.55 * S); shadeBar(g, sx(-3.3), sy(TOP + 0.25), 6.6 * S, 0.55 * S, false);
      const rise = now_(4) ? e(0.2) : 1;
      const tb = TOP - 3, tt = TOP - 3 + (MT - TOP + 3) * (0.35 + 0.65 * rise);
      g.fillStyle = wood(g, 'pine'); g.fillRect(sx(0.5), sy(tt), 0.6 * S, (tt - tb) * S); shadeBar(g, sx(0.5), sy(tt), 0.6 * S, (tt - tb) * S, true);
      g.fillStyle = wood(g, 'oak'); g.fillRect(sx(-0.7), sy(TOP + 2.4), 2.0 * S, 0.55 * S);
      const fx = now_(4) ? lerp(3.6, 0.3, e(1.4)) : 0.3; iron(g, sx(fx), sy(TOP - 2.7), 1.2 * S, 0.32 * S);
      if (now_(4)) { label(g, sx(1.8), sy(TOP + 2.7), 'capacul', '#fde68a', true); label(g, sx(2.0), sy(TOP - 2.4), 'cuiul (fid)', '#fde68a', true); label(g, sx(1.6), sy(MT - 3), 'gabierul', '#fde68a', true); }
    }
    // wanturile, ochii de lemn, lanțurile
    const wind = step === 8, chainX = [-3.4, -1.7, 0, 1.7, 3.4];
    if (show(5)) {
      const k = now_(5) ? e(0.2) : 1;
      for (const cx of chainX) {
        const fy = DK[0] + 1.6, x1 = sx(lerp(0.1, cx * 1.7, k)), y1 = sy(lerp(TOP - 0.6, fy, k));
        const col = wind ? `rgb(37,99,235)` : '#2f2215';
        rope(g, sx(0.1), sy(TOP - 0.6), x1, y1, wind ? 3.5 : 2.6, col, wind ? 'rgba(147,197,253,.7)' : 'rgba(200,170,120,.5)');
        if (k >= 1) for (const yy of [fy, fy - 0.95]) { const gr = g.createRadialGradient(sx(cx * 1.7) - 2, sy(yy) - 2, 1, sx(cx * 1.7), sy(yy), 7); gr.addColorStop(0, '#8a6440'); gr.addColorStop(1, '#2a1a0c'); g.fillStyle = gr; g.beginPath(); g.arc(sx(cx * 1.7), sy(yy), 6.5, 0, Math.PI * 2); g.fill(); }
      }
      if (now_(5)) { // lupa cu ochii de lemn
        const bx = 790, by = 330, r = 110;
        g.save(); g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.clip();
        g.fillStyle = '#e8ddc7'; g.fillRect(bx - r, by - r, 2 * r, 2 * r);
        const dy1 = by - 42, dy2 = by + 42 - e(1.0) * 16;
        rope(g, bx, by - r, bx, dy1 - 30, 9, '#2f2215');
        for (const dy of [dy1, dy2]) {
          const gr = g.createRadialGradient(bx - 8, dy - 8, 3, bx, dy, 32); gr.addColorStop(0, '#9a7450'); gr.addColorStop(1, '#3a2614');
          g.fillStyle = gr; g.beginPath(); g.arc(bx, dy, 30, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#2a1a0c'; g.lineWidth = 3; g.stroke();
          g.fillStyle = '#1a1009'; for (const a of [-1, 0, 1]) { g.beginPath(); g.arc(bx + a * 13, dy + (a === 0 ? -8 : 5), 5, 0, Math.PI * 2); g.fill(); }
        }
        for (const a of [-1, 0, 1]) rope(g, bx + a * 13, dy1 + (a === 0 ? -8 : 5), bx + a * 13, dy2 + (a === 0 ? -8 : 5), 4, '#c9a26b', 'rgba(120,90,50,.7)');
        iron(g, bx - 5, dy2 + 30, 10, r);
        g.restore();
        g.strokeStyle = '#7a5a2a'; g.lineWidth = 4; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke();
        label(g, bx, by + r + 22, 'parâma trece de 6 ori → forța × 6', '#fde68a', true, 'center');
      }
    }
    if (show(6)) for (const cx of chainX) {
      const x = sx(cx * 1.7);
      g.fillStyle = wood(g, 'oak'); g.fillRect(x - 0.7 * S, sy(DK[0] + 0.85), 1.4 * S, 0.4 * S);
      for (let yy = DK[0] + 0.6; yy > DK[0] - 1.8; yy -= 0.45) { g.strokeStyle = '#4b5563'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(x, sy(yy), 2.5, 4.5, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(x, sy(DK[0] - 1.9), 3, 0, Math.PI * 2); g.fill();
      if (now_(6)) hiRect(x - 0.8 * S, sy(DK[0] + 0.9), 1.6 * S, 3.0 * S);
    }
    if (now_(6)) label(g, sx(6.4), sy(DK[0] - 1.2), 'lanțuri prinse cu bolțuri în bordaj', '#fde68a', true);
    // straiuri și pataraine
    if (show(7)) {
      const k = now_(7) ? e(0.2) : 1;
      const col = wind ? '#64748b' : '#2f2215';
      rope(g, sx(0.1), sy(TOP - 0.4), sx(lerp(0.1, HX - 1, k)), sy(lerp(TOP - 0.4, RAILY, k)), 3.2, col);
      rope(g, sx(0.8), sy(MT - 0.6), sx(lerp(0.8, -HX + 1, k)), sy(lerp(MT - 0.6, RAILY + 0.4, k)), 2.6, col);
      if (now_(7) && k >= 1) { g.fillStyle = 'rgba(250,204,21,.22)'; g.beginPath(); g.moveTo(sx(0), sy(TOP)); g.lineTo(sx(HX - 1), sy(RAILY)); g.lineTo(sx(0), sy(RAILY)); g.closePath(); g.fill(); g.beginPath(); g.moveTo(sx(0.8), sy(MT - 0.6)); g.lineTo(sx(-HX + 1), sy(RAILY + 0.4)); g.lineTo(sx(0.4), sy(RAILY + 0.4)); g.closePath(); g.fill(); label(g, sx(HX - 6), sy(RAILY + 4), 'strai', '#fde68a', true); label(g, sx(-HX + 2), sy(RAILY + 6), 'pataraină', '#fde68a', true); }
    }
    // vântul: compresiune până în chilă, wanturile trag
    if (wind) {
      for (let i = 0; i < 7; i++) { const yy = TOP + 6 - i * 2.2, xx = -HX + ((t * 6 + i * 3) % 12); drawArrowPx(g, sx(xx - 3), sy(yy), sx(xx), sy(yy), 'rgba(37,99,235,.75)', 3, 10); }
      for (let i = 0; i < 6; i++) { const y = TOP - ((t * 6 + i * 5.5) % (TOP - KS)); drawArrowPx(g, sx(1.5), sy(y + 1.8), sx(1.5), sy(y), 'rgba(220,38,38,.9)', 3.5, 10); }
      label(g, sx(2.2), sy(KS + 3.2), 'compresiune: catargul e apăsat până în chilă', '#fca5a5', true);
      label(g, sx(5.8), sy(TOP - 5), 'întindere: wanturile trag', '#93c5fd', true);
    }
    label(g, 12, Hc - 12, 'secțiune prin mijlocul corăbiei, văzută din lateral · prova este în dreapta', '#e2e8f0', true);
  }
  requestAnimationFrame(loop);
}

// ============================================================ 4. de ce triunghiuri? (bârne de lemn cu bolțuri)
function initTriangle(root) {
  const cv = root.querySelector('#cvTri'); const g = cv.getContext('2d');
  const Wc = cv.width = 960, Hc = cv.height = 300;
  const $ = s => root.querySelector(s);
  let push = 0, diag = false, t = 0;
  $('#triPush').addEventListener('input', e => push = +e.target.value / 100);
  $('#triDiag').addEventListener('change', e => diag = e.target.checked);
  function loop() {
    requestAnimationFrame(loop);
    if (!root.offsetParent) return;
    t += 0.016;
    const bg = g.createLinearGradient(0, 0, 0, Hc); bg.addColorStop(0, '#dbe7f0'); bg.addColorStop(1, '#f1f5f9'); g.fillStyle = bg; g.fillRect(0, 0, Wc, Hc);
    g.fillStyle = wood(g, 'deck'); g.fillRect(0, Hc - 36, Wc, 36); shadeBar(g, 0, Hc - 36, Wc, 36, false);
    for (let x = 0; x < Wc; x += 120) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, Hc - 36, 2, 36); }
    const base = Hc - 36, s = 170;
    const shear = diag ? push * 4 : push * 105;
    const sq = [[110, base], [110 + s, base], [110 + s + shear, base - s], [110 + shear, base - s]];
    beams(g, sq, true);
    if (diag) { beam(g, sq[0], sq[2]); bolts(g, [sq[0], sq[2]]); }
    if (push > 0.02) drawArrowPx(g, sq[3][0] - 90, sq[3][1], sq[3][0] - 12, sq[3][1], '#2563eb', 6, 16);
    const tri = [[600, base], [600 + s * 1.25, base], [600 + s * 0.62 + push * 3, base - s]];
    beams(g, tri, true);
    if (push > 0.02) drawArrowPx(g, tri[2][0] - 90, tri[2][1], tri[2][0] - 12, tri[2][1], '#2563eb', 6, 16);
    label(g, 110 + s / 2 + 50, 28, diag ? 'pătrat cu diagonală = 2 triunghiuri: rezistă!' : push > 0.3 ? 'pătratul se strâmbă!' : 'pătrat', '#0f172a', false, 'center');
    label(g, 600 + s * 0.62, 28, 'triunghiul nu se strâmbă', '#0f172a', false, 'center');
  }
  requestAnimationFrame(loop);
}
function beam(g, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  g.save(); g.translate(a[0], a[1]); g.rotate(ang);
  g.fillStyle = wood(g, 'pineH'); g.fillRect(-8, -9, len + 16, 18); shadeBar(g, -8, -9, len + 16, 18, false);
  g.strokeStyle = 'rgba(60,40,20,.8)'; g.lineWidth = 1; g.strokeRect(-8, -9, len + 16, 18);
  g.restore();
}
function beams(g, pts) { for (let i = 0; i < pts.length; i++) beam(g, pts[i], pts[(i + 1) % pts.length]); bolts(g, pts); }
function bolts(g, pts) {
  for (const p of pts) { const gr = g.createRadialGradient(p[0] - 2, p[1] - 2, 1, p[0], p[1], 8); gr.addColorStop(0, '#d1d5db'); gr.addColorStop(1, '#1f2937'); g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], 7.5, 0, Math.PI * 2); g.fill(); }
}

// ============================================================ 5. quiz
const QZ = [
  { q: 'Ce fac wanturile când vântul împinge pânzele din stânga?', o: ['Cele din stânga trag tare, cele din dreapta se slăbesc', 'Toate împing catargul', 'Nu se întâmplă nimic'], a: 0, e: 'O frânghie poate doar să tragă. Wanturile din partea vântului țin catargul să nu cadă.' },
  { q: 'Vântul bate de 2 ori mai tare. Cu cât crește forța pe pânze?', o: ['De 2 ori', 'De 4 ori', 'Rămâne la fel'], a: 1, e: 'Forța crește cu pătratul vitezei: 2 × 2 = 4. De aceea pe furtună se strâng pânzele.' },
  { q: 'Unde este cea mai mare presiunea apei pe corabie?', o: ['Lângă linia apei', 'Jos, la chilă', 'Peste tot la fel'], a: 1, e: 'Presiunea crește cu adâncimea: la 6 m sunt cam 6 tone pe fiecare metru pătrat!' },
  { q: 'De ce se pune balastul (greutatea) jos, pe fundul calei?', o: ['Ca să meargă mai repede', 'Ca să coboare centrul de greutate și corabia să nu se răstoarne', 'Ca să fie loc pentru ceai'], a: 1, e: 'Cu G jos, greutatea și împingerea apei îndreaptă corabia mai puternic.' },
  { q: 'De ce sunt peste tot triunghiuri (wanturi, straiuri, genunchi)?', o: ['Arată frumos', 'Triunghiul nu se poate strâmba', 'Sunt mai ieftine'], a: 1, e: 'Un pătrat articulat se strâmbă, un triunghi nu. Inginerii folosesc triunghiuri la poduri, macarale și acoperișuri.' },
  { q: 'Când creasta valului e la mijlocul corăbiei, ce se întâmplă cu puntea?', o: ['Se întinde (cocoașă)', 'Se strânge (șa)', 'Nimic'], a: 0, e: 'Capetele atârnă, corabia face cocoașă: puntea se întinde, iar chila se strânge.' },
];
function initQuiz(root) {
  const box = root.querySelector('#fQuiz'); let score = 0, n = 0;
  box.innerHTML = QZ.map((q, i) => `<div class="q" data-q="${i}"><p class="qt">${i + 1}. ${q.q}</p><div class="opts">${q.o.map((o, j) => `<button data-j="${j}">${o}</button>`).join('')}</div><div class="fb"></div></div>`).join('') + '<p class="score" id="fScore"></p>';
  box.querySelectorAll('.q').forEach(div => {
    const q = QZ[+div.dataset.q];
    div.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (div.dataset.done) return; div.dataset.done = 1; n++;
      const ok = +b.dataset.j === q.a; if (ok) score++;
      b.classList.add(ok ? 'ok' : 'no'); div.querySelectorAll('button')[q.a].classList.add('ok');
      div.querySelector('.fb').textContent = (ok ? '✅ ' : '💡 ') + q.e;
      if (n === QZ.length) root.querySelector('#fScore').textContent = `Scor: ${score} din ${QZ.length} ${score === QZ.length ? '🏆 Inginer naval!' : ''}`;
    }));
  });
}
