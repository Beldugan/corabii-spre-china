// Secțiunea „Forțele pe corabie”: solicitările din structură (chilă, coaste, grinzi, catarg, wanturi)
// și cum se schimbă ele când apare vântul, când se strâng pânzele sau când vin valurile.
// Corabia de referință: un East Indiaman ca „Hindostan” (cca 1.200 t). Cifrele sunt estimări realiste, rotunjite.

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
  initSection(root);
  initBending(root);
  initMastBuild(root);
  initTriangle(root);
  initQuiz(root);
}

// ============================================================ 1. secțiunea transversală
function initSection(root) {
  const cv = root.querySelector('#cvForce'); const g = cv.getContext('2d');
  const Wc = cv.width = 960, Hc = cv.height = 700;
  const S = 11, OX = 440, OY = 478; // 11 px pe metru, linia apei
  const $ = s => root.querySelector(s);
  const st = { bf: 0, sails: 'all', ballast: 'normal', dir: 'side', waves: false, exag: false, pressure: true, hi: null, theta: 0, vel: 0, capsized: false, capT: 0 };
  let table = null;
  const buildTable = () => { const yG = BALLAST[st.ballast].yG; table = []; for (let d = 0; d <= 95; d += 0.5) table.push(GZ(d * D2R, yG)); };
  buildTable();
  const gzAt = d => { const i = clamp(d / 0.5, 0, table.length - 1), i0 = Math.floor(i); return lerp(table[i0], table[Math.min(table.length - 1, i0 + 1)], i - i0); };

  function calc() {
    const v = BEAUFORT[st.bf][0], sp = SAILS[st.sails];
    const kHeel = st.dir === 'side' ? 0.85 : 0.08;
    const Ft = 0.5 * 1.225 * v * v * sp.A * 1.2 / 9810; // tone-forță pe pânze
    const Fh = Ft * kHeel;
    const arm = sp.h - CLR;
    let eq = null, maxR = 0, maxD = 0;
    for (let d = 0; d <= 90; d += 0.25) {
      const R = W * gzAt(d), Hm = Fh * arm * Math.pow(Math.cos(d * D2R), 2);
      if (R > maxR) { maxR = R; maxD = d; }
      if (eq === null && R >= Hm && d > 0) eq = d;
      if (d > maxD + 15 && eq === null) break;
    }
    if (Fh < 0.01) eq = 0;
    if (eq !== null && eq > 45) eq = null; // peste 45° apa intră peste punte: corabia e pierdută
    return { v, Ft, Fh, arm, eq, maxR, maxD, sp };
  }
  const bind = (sel, key, fn) => root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { st[key] = b.dataset.v; root.querySelectorAll(sel).forEach(x => x.setAttribute('aria-pressed', x === b)); if (fn) fn(); }));
  bind('[data-fsails]', 'sails'); bind('[data-fdir]', 'dir');
  bind('[data-fball]', 'ballast', buildTable);
  const bfIn = $('#fWind'); bfIn.addEventListener('input', () => { st.bf = +bfIn.value; });
  $('#fWaves').addEventListener('change', e => st.waves = e.target.checked);
  $('#fExag').addEventListener('change', e => st.exag = e.target.checked);
  $('#fPress').addEventListener('change', e => st.pressure = e.target.checked);
  $('#fReset').addEventListener('click', () => { st.capsized = false; st.theta = 0; st.vel = 0; st.bf = 4; bfIn.value = 4; });
  root.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => {
    const sc = { port: [0, 'all', 'side', false], briza: [4, 'all', 'side', false], tare: [7, 'all', 'side', false], furtuna: [11, 'all', 'side', true], strans: [11, 'reef', 'side', true], pupa: [7, 'all', 'back', false] }[b.dataset.scen];
    st.capsized = false; st.bf = sc[0]; bfIn.value = sc[0]; st.sails = sc[1]; st.dir = sc[2]; st.waves = sc[3]; $('#fWaves').checked = sc[3];
    root.querySelectorAll('[data-fsails]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === sc[1]));
    root.querySelectorAll('[data-fdir]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === sc[2]));
  }));
  // butoanele cu piese
  const chips = $('#fParts');
  chips.innerHTML = Object.entries(PARTS).map(([k, p]) => `<button class="chip" data-p="${k}">${p.n}</button>`).join('');
  chips.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
    st.hi = b.dataset.p; chips.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', x === b));
    const p = PARTS[st.hi]; $('#fPartInfo').innerHTML = `<b>${p.n}</b> · <i>${p.f}</i><br>${p.d}`;
  }));

  // particule de vânt
  const parts = Array.from({ length: 90 }, () => ({ x: Math.random() * Wc, y: Math.random() * 440, l: 10 + Math.random() * 30 }));
  let last = performance.now(), t = 0, lastMsg = '';
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const c = calc();
    // dinamica înclinării: un arc amortizat spre poziția de echilibru (+ valuri și rafale)
    let target;
    if (st.capsized || c.eq === null) { st.capsized = true; target = 115; }
    else {
      const gust = st.bf > 2 ? 1 + 0.12 * Math.sin(t * 1.7) * Math.sin(t * 0.63) : 1;
      target = c.eq * gust;
      if (st.waves) target += (3 + st.bf * 0.6) * Math.sin(t * 2 * Math.PI / 7);
    }
    const k = st.capsized ? 0.6 : 2.2;
    st.vel += (k * (target - st.theta) - 1.6 * st.vel) * dt; st.theta += st.vel * dt;
    const th = st.theta * D2R;
    const heelNow = st.theta;
    // forțele din wanturi și catarg (catargul mare)
    const Fm = c.Ft * (st.dir === 'side' ? 0.85 : 0.1) * 0.4 * Math.pow(Math.cos(th), 2); // forța laterală pe catargul mare
    const hm = c.sp.h - DECKS.main; const b = 6.9, alpha = Math.atan(b / 21);
    const P0 = 3; // pretensionarea totală pe fiecare parte (t)
    const Tv = (Fm * hm + 10 * Math.sin(th) * 14) / b; // + greutatea greementului care „atârnă” în lateral
    const Tw = P0 + Tv / Math.cos(alpha), Tl = Math.max(0, P0 - 0.35 * Tv);
    const Cmast = 10 + (Tw + Tl) * Math.cos(alpha);
    // ---------------------------------------------- desen
    const sky = g.createLinearGradient(0, 0, 0, OY); sky.addColorStop(0, '#9ec7e6'); sky.addColorStop(1, '#dcebf5');
    g.fillStyle = sky; g.fillRect(0, 0, Wc, OY);
    const sea = g.createLinearGradient(0, OY, 0, Hc); sea.addColorStop(0, '#2d6f96'); sea.addColorStop(1, '#0f3550');
    const wav = x => st.waves ? Math.sin(x * 0.012 - t * 1.6) * (2 + st.bf * 0.8) : Math.sin(x * 0.03 + t) * 1.2;
    g.fillStyle = sea; g.beginPath(); g.moveTo(0, Hc); for (let x = 0; x <= Wc; x += 10) g.lineTo(x, OY + wav(x)); g.lineTo(Wc, Hc); g.fill();
    // vântul
    const v = c.v;
    if (v > 0.5) {
      g.save(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (const p of parts) {
        if (st.dir === 'side') { p.x += v * 22 * dt * (0.7 + p.l / 60); if (p.x > Wc + 40) { p.x = -40; p.y = Math.random() * 420; } g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.l * (0.5 + v / 15), p.y); g.stroke(); }
        else { g.beginPath(); g.arc(p.x, p.y, 2 + (t * v * 0.4 + p.l) % 5, 0, Math.PI * 2); g.stroke(); }
      }
      g.restore();
    }
    // corabia (coordonate locale în metri -> ecran)
    const T = (x, y) => { const r = rot([x, y], th); return [OX + r[0] * S, OY - r[1] * S]; };
    const poly = (pts, fill, stroke, lw = 1) => { g.beginPath(); pts.forEach((p, i) => { const q = T(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    const line = (a, b2, col, lw) => { const p = T(...a), q = T(...b2); g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); };
    const glow = key => st.hi === key ? 1 : 0;
    // corpul: bordajul, coastele, interiorul
    poly(OUTER, '#2a2016', glow('bordaj') ? '#facc15' : '#120d08', glow('bordaj') ? 5 : 1.5);
    poly(INNER, '#6a4a2c', glow('coaste') ? '#facc15' : '#3a2716', glow('coaste') ? 6 : 3);
    // banda galbenă a porturilor de tun
    // punțile, grinzile, genunchii, pontilii
    for (const [k, y] of Object.entries(DECKS)) {
      const w = hw(y + 0.2) - 0.4;
      poly([[-w, y], [w, y], [w, y - 0.35], [-w, y - 0.35]], glow('grinzi') && k !== 'floor' ? '#facc15' : '#8a6440', '#3a2716', 1);
      if (k !== 'floor') for (const sd of [-1, 1]) poly([[sd * w, y - 0.35], [sd * (w - 1.4), y - 0.35], [sd * w, y - 1.6]], glow('genunchi') ? '#facc15' : '#5a3d22', '#2a1a0c', 1);
    }
    for (const [a, b2] of [[DECKS.main, DECKS.gun], [DECKS.gun, DECKS.orlop], [DECKS.orlop, DECKS.floor]]) poly([[-1.6, a - 0.35], [-1.35, a - 0.35], [-1.35, b2], [-1.6, b2]], glow('pontili') ? '#facc15' : '#5a3d22');
    // chila și carlinga
    poly([[-0.35, KEEL + 0.3], [0.35, KEEL + 0.3], [0.35, KEEL - 0.7], [-0.35, KEEL - 0.7]], glow('chila') ? '#facc15' : '#1d140b', '#000', 1);
    poly([[-0.5, KEEL + 0.6], [0.5, KEEL + 0.6], [0.5, KEEL + 1.25], [-0.5, KEEL + 1.25]], glow('carlinga') ? '#facc15' : '#4a321c', '#000', 1);
    // pânza / vergile (văzute din spate)
    const sp = c.sp, brace = st.dir === 'side' ? 0.62 : 1; // proiecția vergilor
    const sailLevels = { all: [[DECKS.main + 4, DECKS.main + 14, 25], [DECKS.main + 14.5, DECKS.main + 24, 19], [DECKS.main + 24.5, DECKS.main + 31, 12]], top: [[DECKS.main + 4, DECKS.main + 14, 25], [DECKS.main + 14.5, DECKS.main + 24, 19]], reef: [[DECKS.main + 17, DECKS.main + 23, 19]], bare: [] }[st.sails];
    const bend = (y) => { // îndoirea catargului (exagerată opțional)
      const k2 = (st.exag ? 0.022 : 0.004) * Fm;
      const yy = Math.max(0, y - DECKS.main); return k2 * yy * yy / 30;
    };
    const mastTop = DECKS.main + 33;
    const fillAmt = clamp(c.Ft / 12, 0, 1);
    for (const [y0, y1, w0] of sailLevels) {
      const w = w0 * brace / 2;
      const bx0 = bend(y0), bx1 = bend(y1);
      const bul = (st.dir === 'side' ? 1.2 : 0.4) * (0.3 + fillAmt * 2.2);
      const pts = [[-w + bx1, y1], [w + bx1, y1], [w * 1.05 + bx0 + bul * 0.5, y0], [bx0 + bul, y0 - bul * 0.4], [-w * 1.05 + bx0 + bul * 0.5, y0]];
      poly(pts, glow('panza') ? '#fde68a' : 'rgba(243,234,214,.95)', 'rgba(120,100,70,.7)', 1);
      line([-w * 1.08 + bx1, y1], [w * 1.08 + bx1, y1], glow('verga') ? '#facc15' : '#1c1c1c', glow('verga') ? 6 : 4);
    }
    // catargul (cu îndoire), de pe carlingă până sus
    const mpts = [];
    for (let y = KEEL + 1.25; y <= mastTop; y += 1) mpts.push([bend(y), y]);
    const mastW = y => y < DECKS.main + 21 ? 0.55 : 0.32;
    g.lineCap = 'butt';
    for (let i = 1; i < mpts.length; i++) {
      const comp = clamp(Cmast / 60, 0, 1);
      const col = glow('catarg') ? '#facc15' : `rgb(${Math.round(lerp(170, 220, comp))},${Math.round(lerp(125, 60, comp))},${Math.round(lerp(75, 40, comp))})`;
      line(mpts[i - 1], mpts[i], col, mastW(mpts[i][1]) * 2 * S);
    }
    // piciorul catargului și partenerii
    poly([[-0.8, KEEL + 1.25], [0.8, KEEL + 1.25], [0.8, KEEL + 2.0], [-0.8, KEEL + 2.0]], glow('picior') ? '#facc15' : '#2e1f10');
    for (const y of [DECKS.main, DECKS.gun, DECKS.orlop]) { const bx = bend(y); poly([[bx - 1.0, y + 0.1], [bx + 1.0, y + 0.1], [bx + 1.0, y - 0.45], [bx - 1.0, y - 0.45]], glow('partener') ? '#facc15' : '#3a2716'); for (const sd of [-1, 1]) poly([[bx + sd * 0.55, y + 0.1], [bx + sd * 0.8, y + 0.1], [bx + sd * 0.6, y - 0.45]], glow('partener') ? '#fde047' : '#d4b483'); }
    // gabia
    const topY = DECKS.main + 21;
    poly([[-2.8 + bend(topY), topY], [2.8 + bend(topY), topY], [2.8 + bend(topY), topY - 0.5], [-2.8 + bend(topY), topY - 0.5]], '#3a2716');
    // wanturile: grosimea și culoarea arată cât trag
    const chainY = DECKS.main + 0.6;
    for (const sd of [-1, 1]) {
      const windward = sd === -1; // vântul vine din stânga
      const T0 = windward ? Tw : Tl;
      const slack = T0 < 0.8;
      const col = glow(windward ? 'wantVant' : 'wantSub') ? '#facc15' : slack ? 'rgba(60,45,30,.8)' : `rgb(${Math.round(lerp(60, 30, clamp(T0 / 25, 0, 1)))},${Math.round(lerp(60, 90, clamp(T0 / 25, 0, 1)))},${Math.round(lerp(60, 235, clamp(T0 / 25, 0, 1)))})`;
      const lw = slack ? 1.2 : 1.4 + clamp(T0 / 25, 0, 1) * 3.5;
      for (let i = 0; i < 3; i++) {
        const top = [bend(topY - 0.6) + sd * 0.6, topY - 0.6], foot = [sd * (b + 0.15 * i), chainY];
        if (slack) { // wantul slăbit atârnă puțin
          const p = T(...top), q = T(...foot), m = [(p[0] + q[0]) / 2 + 10, (p[1] + q[1]) / 2 + 6];
          g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(...p); g.quadraticCurveTo(m[0], m[1], q[0], q[1]); g.stroke();
        } else line(top, foot, col, lw);
      }
      // wanturile gabierului
      line([bend(mastTop - 1) + sd * 0.3, mastTop - 1], [bend(topY) + sd * 2.6, topY], col, Math.max(1, lw * 0.7));
      // ochii de lemn, podina și lanțul
      const de = T(sd * b, chainY + 0.6); g.fillStyle = glow('ochi') ? '#facc15' : '#111'; g.beginPath(); g.arc(de[0], de[1], 4.5, 0, Math.PI * 2); g.fill();
      line([sd * (hw(chainY) + 0.0), chainY - 0.1], [sd * (b + 0.3), chainY - 0.1], glow('lant') ? '#facc15' : '#3a2716', 4);
      line([sd * b, chainY + 0.4], [sd * (hw(chainY - 2.4) + 0.05), chainY - 2.4], glow('lant') ? '#facc15' : '#555', 2.5);
    }
    // presiunea apei pe corp: săgeți mai lungi la adâncime mai mare (p = ρ·g·h)
    if (st.pressure) {
      g.save(); g.strokeStyle = 'rgba(147,197,253,.95)'; g.fillStyle = 'rgba(147,197,253,.95)'; g.lineWidth = 2;
      for (let i = 2; i < OUTER.length - 2; i += 2) {
        const p = OUTER[i], wp = rot(p, th); const depth = -wp[1]; if (depth <= 0.2) continue;
        const pn = OUTER[i + 1], pp = OUTER[i - 1];
        let nx = -(pn[1] - pp[1]), ny = pn[0] - pp[0]; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        if (nx * p[0] + ny * p[1] < 0) { nx = -nx; ny = -ny; } // normala spre exterior
        const len = depth * 0.42;
        const a = [p[0] + nx * len, p[1] + ny * len];
        const A = T(...a), B2 = T(...p);
        g.beginPath(); g.moveTo(...A); g.lineTo(...B2); g.stroke();
        const ang = Math.atan2(B2[1] - A[1], B2[0] - A[0]);
        g.beginPath(); g.moveTo(B2[0], B2[1]); g.lineTo(B2[0] - 7 * Math.cos(ang - 0.4), B2[1] - 7 * Math.sin(ang - 0.4)); g.lineTo(B2[0] - 7 * Math.cos(ang + 0.4), B2[1] - 7 * Math.sin(ang + 0.4)); g.fill();
      }
      g.restore();
    }
    // G și B, greutatea și împingerea apei
    const yG = BALLAST[st.ballast].yG;
    const sub = centroid(clipBelow(OUTER.map(p => rot(p, th))));
    const Gs = T(0, yG), Bs = [OX + sub.x * S, OY - sub.y * S];
    arrow(g, Gs[0], Gs[1], Gs[0], Gs[1] + 110, '#dc2626', 5, 'greutatea (G)');
    arrow(g, Bs[0], Bs[1], Bs[0], Bs[1] - 110, '#16a34a', 5, 'împingerea apei (B)');
    dot(g, Gs, '#dc2626', 'G', glow('G')); dot(g, Bs, '#16a34a', 'B', glow('B'));
    if (Math.abs(sub.x - rot([0, yG], th)[0]) > 0.05 && !st.capsized) { g.save(); g.setLineDash([4, 4]); g.strokeStyle = '#fde68a'; g.lineWidth = 2; g.beginPath(); g.moveTo(Gs[0], Bs[1] + 28); g.lineTo(Bs[0], Bs[1] + 28); g.stroke(); g.restore(); g.fillStyle = '#fde68a'; g.font = '12px "Segoe UI"'; g.textAlign = 'center'; g.textAlign = 'right'; g.fillText('brațul care o îndreaptă ⟶', Math.min(Gs[0], Bs[0]) - 8, Bs[1] + 32); }
    // forța vântului pe pânze și rezistența apei pe chilă
    if (c.Fh > 0.05 && st.dir === 'side') {
      const ce = T(bend(c.sp.h) - 8, c.sp.h); const lenW = clamp(c.Fh * 6, 10, 210);
      arrow(g, ce[0] - lenW, ce[1], ce[0], ce[1], '#2563eb', 7, `vântul: ${fmt(c.Ft * 0.85)} t`);
      const kl = T(0, KEEL - 0.3); arrow(g, kl[0] + 40 + lenW * 0.6, kl[1] + 26, kl[0] + 12, kl[1] + 26, '#f97316', 6, 'apa ține chila');
    }
    if (st.dir === 'back' && c.Ft > 0.05) { g.fillStyle = '#1d4ed8'; g.font = '700 14px "Segoe UI"'; g.textAlign = 'center'; g.fillText(`⊗ vântul vine din spate și împinge corabia înainte: ${fmt(c.Ft)} t`, OX, 26); }
    // compresiunea catargului: săgeți spre piciorul catargului
    if (Cmast > 11) { const f = T(bend(KEEL + 2.5), KEEL + 2.5); g.fillStyle = '#b91c1c'; g.font = '700 13px "Segoe UI"'; g.textAlign = 'left'; g.fillText(`⇩ ${fmt(Cmast)} t`, f[0] + 14, f[1] + 4); }
    // înclinarea
    g.fillStyle = 'rgba(15,23,42,.75)'; g.fillRect(12, 12, 230, 56);
    g.fillStyle = '#fff'; g.font = '700 22px "Segoe UI"'; g.textAlign = 'left';
    g.fillText(st.capsized ? 'RĂSTURNATĂ!' : `înclinare ${Math.abs(heelNow).toFixed(0)}°`, 22, 40);
    g.font = '13px "Segoe UI"'; g.fillText(`vânt: ${BEAUFORT[st.bf][1]} (${st.bf} Beaufort)`, 22, 60);
    // linia porturilor de tun de sub vânt: intră în apă?
    const portLee = rot([hw(DECKS.gun + 0.9), DECKS.gun + 0.9], th);
    const flooding = portLee[1] < 0 && !st.capsized;
    // ---------------------------------------------- valorile
    $('#fV').textContent = `${c.v} m/s (${Math.round(c.v * 3.6)} km/h)`;
    $('#fF').textContent = `${fmt(c.Ft)} t`;
    $('#fFc').textContent = `cât ${Math.max(0, Math.round(c.Ft / 1.3))} mașini`;
    $('#fHeel').textContent = st.capsized ? '—' : `${Math.abs(heelNow).toFixed(0)}°`;
    $('#fTw').textContent = `${fmt(Tw)} t`;
    $('#fTl').textContent = Tl < 0.8 ? 'slăbite' : `${fmt(Tl)} t`;
    $('#fC').textContent = `${fmt(Cmast)} t`;
    $('#fP').textContent = `${(-rot([0, KEEL], th)[1]).toFixed(1).replace('.', ',')} t/m²`;
    let msg, cls = 'say';
    if (st.capsized) { msg = '💥 <b>Corabia s-a răsturnat!</b> Forța vântului pe pânze a fost mai mare decât poate îndrepta greutatea. Căpitanii strângeau pânzele <b>înainte</b> de furtună. Apasă „De la capăt”.'; cls = 'say warn'; }
    else if (flooding) { msg = '⚠️ <b>Porturile de tun de sub vânt intră în apă!</b> Corabia se poate umple. Strânge pânzele sau pune mai mult balast.'; cls = 'say warn'; }
    else if (c.v < 0.5) msg = 'Fără vânt corabia stă dreaptă. Wanturile sunt totuși strânse („pretensionate”), iar catargul apasă pe chilă cu greutatea lui. Mută glisorul vântului!';
    else if (st.dir === 'back') msg = 'Cu vântul din spate, corabia aproape nu se înclină: forța o împinge <b>înainte</b>. Catargul vrea să cadă în față, așa că acum trag <b>patarainele</b> (frânghiile din spate).';
    else if (heelNow > 22) msg = `Vânt prea puternic pentru „${c.sp.ro}”. Wanturile din vânt trag cu ${fmt(Tw)} t. Încearcă <b>„Strânge pânzele”</b>.`;
    else msg = `Vântul împinge pânzele cu ${fmt(c.Ft)} t, sus, departe de apă. Ca la o pârghie, forța mică de sus face o forță mare jos: wanturile trag cu ${fmt(Tw)} t, iar catargul apasă pe chilă cu ${fmt(Cmast)} t. Greutatea (G) și împingerea apei (B) se depărtează și îndreaptă corabia.`;
    if (msg !== lastMsg) { lastMsg = msg; const s = $('#fSay'); s.className = cls; s.innerHTML = msg; }
  }
  requestAnimationFrame(loop);
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

// ============================================================ 2. corabia pe val: cocoașă și șa
function initBending(root) {
  const cv = root.querySelector('#cvBend'); const g = cv.getContext('2d');
  const Wc = cv.width = 960, Hc = cv.height = 380;
  const $ = s => root.querySelector(s);
  const L = 50, N = 51, S = 15, OX = 480, OY = 215;
  const st = { h: 3, run: true, phase: 0, speed: 1 };
  $('#bH').addEventListener('input', e => st.h = +e.target.value);
  $('#bRun').addEventListener('click', () => { st.run = !st.run; $('#bRun').textContent = st.run ? '⏸ Oprește valul' : '▶ Pornește valul'; });
  root.querySelectorAll('[data-bpos]').forEach(b => b.addEventListener('click', () => { st.run = false; $('#bRun').textContent = '▶ Pornește valul'; st.phase = b.dataset.bpos === 'crest' ? 0 : Math.PI; }));
  const xs = Array.from({ length: N }, (_, i) => -L / 2 + L * i / (N - 1));
  const width = x => { const u = Math.abs(2 * x / L); return u < 0.6 ? 1 : Math.max(0.15, 1 - (u - 0.6) / 0.4 * 0.85); };
  const qShape = xs.map(x => (1 + 0.35 * Math.cos(Math.PI * x / L)) * width(x));
  const qSum = qShape.reduce((a, b) => a + b, 0);
  let last = performance.now(), lastMode = '';
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (st.run) st.phase += dt * 0.7;
    const A = st.h / 2;
    const eta = x => A * Math.cos(2 * Math.PI * x / L - st.phase);
    // găsim cât se afundă corabia ca împingerea apei = greutatea (prin înjumătățire)
    const draftNom = 6.2, keelY = -draftNom;
    const buoyAt = (x, s) => Math.max(0, eta(x) - (keelY + s)) * width(x);
    const target = xs.reduce((a, x) => a + Math.max(0, 0 - keelY) * width(x), 0);
    let lo = -8, hi = 8;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; const B = xs.reduce((a, x) => a + buoyAt(x, m), 0); if (B > target) lo = m; else hi = m; }
    const s = (lo + hi) / 2;
    const b = xs.map(x => buoyAt(x, s)), Btot = b.reduce((a, v) => a + v, 0);
    const q = qShape.map(v => v * Btot / qSum);
    // forța tăietoare și momentul încovoietor
    const V = [], M = []; let acc = 0, mm = 0;
    for (let i = 0; i < N; i++) { acc += b[i] - q[i]; V.push(acc); mm += acc; M.push(mm); }
    const Mmid = M[Math.floor(N / 2)];
    const ref = 45 * Math.max(0.5, st.h);
    const k = clamp(Mmid / ref, -1.2, 1.2); // >0 cocoașă (hogging), <0 șa (sagging)
    // desen
    const sky = g.createLinearGradient(0, 0, 0, Hc); sky.addColorStop(0, '#cfe3f1'); sky.addColorStop(1, '#eef5fa');
    g.fillStyle = sky; g.fillRect(0, 0, Wc, Hc);
    const sx = x => OX + x * S, sy = y => OY - y * S;
    // apa
    g.fillStyle = '#2d6f96'; g.beginPath(); g.moveTo(0, Hc);
    for (let px = 0; px <= Wc; px += 6) { const x = (px - OX) / S; g.lineTo(px, sy(eta(x))); }
    g.lineTo(Wc, Hc); g.fill();
    // corabia îndoită (deformare exagerată)
    const def = x => k * 0.9 * (1 - Math.pow(2 * x / L, 2)); // m, exagerat
    const deckY = x => 6.4 + s + def(x) + (Math.abs(2 * x / L) > 0.8 ? (Math.abs(2 * x / L) - 0.8) * 8 : 0);
    const botY = x => keelY + s + def(x) + (Math.abs(2 * x / L) > 0.85 ? (Math.abs(2 * x / L) - 0.85) * 18 : 0);
    g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(sx(x), sy(deckY(x))) : g.moveTo(sx(x), sy(deckY(x))));
    for (let i = N - 1; i >= 0; i--) g.lineTo(sx(xs[i]), sy(botY(xs[i])));
    g.closePath(); g.fillStyle = 'rgba(40,30,20,.92)'; g.fill();
    // banda galbenă
    g.strokeStyle = '#c9a14a'; g.lineWidth = 5; g.beginPath(); xs.forEach((x, i) => { const y = deckY(x) - 3; i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y)); }); g.stroke();
    // puntea și chila colorate: albastru = întindere, roșu = compresiune
    const colOf = sgn => { const a = clamp(Math.abs(k), 0, 1); return sgn > 0 ? `rgba(37,99,235,${0.35 + 0.65 * a})` : `rgba(220,38,38,${0.35 + 0.65 * a})`; };
    g.lineWidth = 8; g.strokeStyle = colOf(k); g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(sx(x), sy(deckY(x))) : g.moveTo(sx(x), sy(deckY(x)))); g.stroke();
    g.strokeStyle = colOf(-k); g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(sx(x), sy(botY(x))) : g.moveTo(sx(x), sy(botY(x)))); g.stroke();
    // săgeți pentru întindere/compresiune pe punte
    if (Math.abs(k) > 0.15) {
      const tens = k > 0; const y = deckY(0) + 2.2;
      g.fillStyle = tens ? '#1d4ed8' : '#b91c1c'; g.font = '700 22px "Segoe UI"'; g.textAlign = 'center';
      g.fillText(tens ? '⟵   puntea se întinde   ⟶' : '⟶   puntea se strânge   ⟵', OX, sy(y + 1.6));
      g.fillStyle = tens ? '#b91c1c' : '#1d4ed8'; g.font = '700 16px "Segoe UI"';
      g.fillText(tens ? '⟶  chila se strânge  ⟵' : '⟵  chila se întinde  ⟶', OX, sy(botY(0) - 2.3));
    }
    // catargele și straiurile
    for (const [mx, h] of [[-12, 30], [1.5, 40], [14, 36]]) {
      const by = deckY(mx), slope = (deckY(mx + 1) - deckY(mx - 1)) / 2;
      g.strokeStyle = '#7a5432'; g.lineWidth = 4; g.beginPath(); g.moveTo(sx(mx), sy(by)); g.lineTo(sx(mx - slope * h), sy(by + h * 0.8)); g.stroke();
    }
    // forțele: greutatea (în jos) și împingerea apei (în sus) pe bucăți
    for (let i = 2; i < N - 1; i += 4) {
      const x = xs[i];
      const yb = botY(x);
      const lb = b[i] * 9, lq = q[i] * 9;
      if (lb > 3) arrow(g, sx(x) + 5, sy(yb) + lb, sx(x) + 5, sy(yb), '#16a34a', 3);
      arrow(g, sx(x) - 5, sy(deckY(x)) - 4, sx(x) - 5, sy(deckY(x)) - 4 + lq, '#dc2626', 3);
    }
    // eticheta
    const mode = Math.abs(k) < 0.15 ? 'flat' : k > 0 ? 'hog' : 'sag';
    g.fillStyle = 'rgba(15,23,42,.78)'; g.fillRect(12, 12, 330, 56);
    g.fillStyle = '#fff'; g.font = '700 20px "Segoe UI"'; g.textAlign = 'left';
    g.fillText(mode === 'hog' ? 'COCOAȘĂ (hogging)' : mode === 'sag' ? 'ȘA (sagging)' : 'echilibru', 24, 40);
    g.font = '13px "Segoe UI"'; g.fillText(mode === 'hog' ? 'creasta valului e la mijloc, capetele atârnă' : mode === 'sag' ? 'creste la capete, mijlocul atârnă' : 'apa ține corabia uniform', 24, 60);
    g.font = '12px "Segoe UI"'; g.textAlign = 'right'; g.fillStyle = '#334155'; g.fillText('🔴 greutatea   🟢 împingerea apei   (deformarea e mărită de multe ori)', Wc - 12, Hc - 10);
    if (mode !== lastMode) {
      lastMode = mode;
      $('#bSay').innerHTML = mode === 'hog'
        ? '<b>Cocoașă:</b> valul ține corabia doar la mijloc. Capetele, grele, atârnă în jos și corabia se îndoaie ca o cocoașă. <b>Puntea se întinde</b>, iar <b>chila se strânge</b>. După ani de navigație, multe corăbii de lemn rămâneau „cocoșate” de-a binelea!'
        : mode === 'sag'
          ? '<b>Șa:</b> două creste țin corabia la capete, iar mijlocul, încărcat, atârnă. Acum <b>puntea se strânge</b> și <b>chila se întinde</b>. Așa, de câteva ori pe minut, pe fiecare val.'
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
  const Wc = cv.width = 960, Hc = cv.height = 620;
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
  // vedere laterală, scară: 11 px / m
  const S = 11.5, OX = 480, OY = 470; // OY = linia apei
  const sx = x => OX + x * S, sy = y => OY - y * S;
  const KE = -6.2, KS = KE + 1.25, DK = [5.1, 2.4, -0.8], TOP = 5.1 + 21, MT = 5.1 + 33;
  let last = performance.now(), t = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; stepT += dt;
    if (auto) { autoT += dt; if (autoT > 6) { autoT = 0; if (step < BUILD.length - 1) go(step + 1); else { auto = false; $('#mAuto').textContent = '▶ Arată tot'; } } }
    const e = k => clamp((stepT - k) / 1.2, 0, 1); // animația pasului curent
    const show = i => step >= i, now_ = i => step === i;
    // fundal: secțiune prin corabie, văzută din lateral
    g.fillStyle = '#e8eef3'; g.fillRect(0, 0, Wc, Hc);
    g.fillStyle = '#2d6f96'; g.fillRect(0, OY, Wc, Hc - OY);
    // corpul (o porțiune, tăiată)
    g.fillStyle = '#3a2a1a'; g.fillRect(sx(-16), sy(6.4), 32 * S, (6.4 - KE) * S);
    g.fillStyle = '#7a5434'; g.fillRect(sx(-15.6), sy(6.0), 31.2 * S, (6.0 - KE - 0.9) * S);
    // chila, coastele
    g.fillStyle = now_(0) ? '#f59e0b' : '#1d140b'; g.fillRect(sx(-16), sy(KE + 0.3), 32 * S, 1.0 * S);
    for (let x = -15; x <= 15; x += 1.2) { g.fillStyle = now_(0) ? `rgba(245,158,11,${0.4 + 0.4 * e(0)})` : '#4a321c'; g.fillRect(sx(x), sy(6.0), 0.45 * S, (6.0 - KE - 0.3) * S); }
    g.fillStyle = now_(0) ? '#fbbf24' : '#5a3d22'; g.fillRect(sx(-16), sy(KS), 32 * S, (KS - KE - 0.3) * S);
    // punțile
    for (const y of DK) { g.fillStyle = '#9a7650'; g.fillRect(sx(-16), sy(y), 32 * S, 0.35 * S); }
    // lăcașul piciorului
    if (show(1)) { g.fillStyle = now_(1) ? '#fbbf24' : '#2e1f10'; g.fillRect(sx(-1.3), sy(KS + 0.9), 2.6 * S, 0.9 * S); g.fillStyle = '#120c06'; g.fillRect(sx(-0.4), sy(KS + 0.9), 0.8 * S, 0.7 * S); }
    // catargul de jos (coboară în lăcaș la pasul 1)
    if (show(1)) {
      const drop = now_(1) ? (1 - e(0.2)) * 6 : 0;
      const mx = 0, w = 0.9;
      g.fillStyle = '#c69a5c'; g.fillRect(sx(mx - w / 2), sy(TOP + drop), w * S, (TOP - KS) * S);
      g.fillStyle = '#a8804a'; g.fillRect(sx(-0.38), sy(KS + drop + 0.0), 0.76 * S, 0.7 * S); // cepul
      if (show(3)) { // bucățile și cercurile de fier
        g.strokeStyle = 'rgba(80,55,30,.7)'; g.lineWidth = 1.5;
        for (const dx of [-0.22, 0.0, 0.22]) { g.beginPath(); g.moveTo(sx(dx), sy(TOP)); g.lineTo(sx(dx), sy(KS + 0.7)); g.stroke(); }
        const nh = now_(3) ? Math.floor(e(0.2) * 12) : 12;
        for (let i = 0; i < nh; i++) { const y = DK[0] + 1.2 + i * 1.3; if (y > TOP - 1) break; g.fillStyle = now_(3) ? '#f59e0b' : '#333'; g.fillRect(sx(-0.55), sy(y), 1.1 * S, 0.3 * S); }
      }
    }
    // partenerii și penele
    if (show(2)) for (const y of DK) {
      g.fillStyle = now_(2) ? '#fbbf24' : '#2e1f10'; g.fillRect(sx(-1.3), sy(y + 0.15), 2.6 * S, 0.65 * S);
      const k = now_(2) ? e(0.3) : 1;
      g.fillStyle = '#e2c290';
      for (const sd of [-1, 1]) { const x0 = sd * (0.45 + (1 - k) * 1.5); g.beginPath(); g.moveTo(sx(x0), sy(y + 0.5 + (1 - k) * 2)); g.lineTo(sx(x0 + sd * 0.25), sy(y + 0.5 + (1 - k) * 2)); g.lineTo(sx(x0), sy(y - 0.4 + (1 - k) * 2)); g.closePath(); g.fill(); }
      if (now_(2) && k < 1) { g.fillStyle = '#555'; g.fillRect(sx(1.6), sy(y + 2.6 + Math.abs(Math.sin(t * 10)) * 1.2), 0.5 * S, 0.9 * S); }
    }
    // gabia + gabierul + cuiul
    if (show(4)) {
      g.fillStyle = '#3a2716'; g.fillRect(sx(-3.2), sy(TOP + 0.2), 6.4 * S, 0.5 * S);
      const rise = now_(4) ? e(0.2) : 1;
      const tb = TOP - 3 + rise * 0, tt = TOP - 3 + (MT - TOP + 3) * (0.35 + 0.65 * rise);
      g.fillStyle = now_(4) ? '#f59e0b' : '#c69a5c'; g.fillRect(sx(0.55), sy(tt), 0.55 * S, (tt - tb) * S);
      g.fillStyle = '#2e1f10'; g.fillRect(sx(-0.6), sy(TOP + 2.3), 1.9 * S, 0.5 * S); // capacul
      if (!now_(4) || e(1.4) > 0) { g.fillStyle = '#666'; const fx = now_(4) ? lerp(3.5, 0.35, e(1.4)) : 0.35; g.fillRect(sx(fx), sy(TOP - 2.8), 1.1 * S, 0.3 * S); }
    }
    // wanturile cu ochi și parâmă; lanțuri și podine
    const chainX = [-3.4, -1.7, 0, 1.7, 3.4];
    const wind = step === 8;
    const tensC = wind ? `rgba(37,99,235,${0.6 + 0.4 * Math.sin(t * 3) ** 2})` : '#3b2a1a';
    if (show(5)) {
      const k = now_(5) ? e(0.2) : 1;
      for (const cx of chainX) {
        const fy = DK[0] + 1.6;
        g.strokeStyle = now_(5) ? '#f59e0b' : tensC; g.lineWidth = wind ? 3 : 2;
        g.beginPath(); g.moveTo(sx(0.1), sy(TOP - 0.6)); g.lineTo(sx(lerp(0.1, cx * 1.7, k)), sy(lerp(TOP - 0.6, fy, k))); g.stroke();
        if (k >= 1) { g.fillStyle = '#111'; g.beginPath(); g.arc(sx(cx * 1.7), sy(fy), 5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(sx(cx * 1.7), sy(fy - 0.9), 5, 0, Math.PI * 2); g.fill(); }
      }
      // detaliul cu ochii de lemn (lupa)
      if (now_(5)) {
        const bx = 760, by = 300, r = 95;
        g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#7a5a2a'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill(); g.stroke();
        const dy1 = by - 35, dy2 = by + 35 - e(1.0) * 14;
        for (const dy of [dy1, dy2]) { g.fillStyle = '#4a321c'; g.beginPath(); g.arc(bx, dy, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; for (const a of [-1, 0, 1]) { g.beginPath(); g.arc(bx + a * 11, dy + (a === 0 ? -6 : 4), 4, 0, Math.PI * 2); g.fill(); } }
        g.strokeStyle = '#c9a26b'; g.lineWidth = 2; g.beginPath();
        for (const a of [-1, 0, 1]) { g.moveTo(bx + a * 11, dy1 + (a === 0 ? -6 : 4)); g.lineTo(bx + a * 11, dy2 + (a === 0 ? -6 : 4)); } g.stroke();
        g.fillStyle = '#334155'; g.font = '12px "Segoe UI"'; g.textAlign = 'center'; g.fillText('parâma trece de 6 ori → forța × 6', bx, by + r - 12);
        g.strokeStyle = '#7a5a2a'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(bx - r, by); g.lineTo(sx(chainX[4] * 1.7) + 8, sy(DK[0] + 1.2)); g.stroke(); g.setLineDash([]);
      }
    }
    if (show(6)) for (const cx of chainX) {
      g.strokeStyle = now_(6) ? '#f59e0b' : '#555'; g.lineWidth = 3; g.setLineDash([4, 2]);
      g.beginPath(); g.moveTo(sx(cx * 1.7), sy(DK[0] + 0.7)); g.lineTo(sx(cx * 1.7), sy(DK[0] - 1.6)); g.stroke(); g.setLineDash([]);
      g.fillStyle = now_(6) ? '#fbbf24' : '#2e1f10'; g.fillRect(sx(cx * 1.7 - 0.6), sy(DK[0] + 0.8), 1.2 * S, 0.35 * S);
    }
    // straiuri și pataraine (triunghiuri)
    if (show(7)) {
      const k = now_(7) ? e(0.2) : 1;
      g.strokeStyle = now_(7) ? '#f59e0b' : (wind ? '#64748b' : '#3b2a1a'); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(sx(0.1), sy(TOP - 0.4)); g.lineTo(sx(lerp(0.1, 15.5, k)), sy(lerp(TOP - 0.4, 6.0, k))); g.stroke();
      g.beginPath(); g.moveTo(sx(0.8), sy(MT - 0.6)); g.lineTo(sx(lerp(0.8, -15.5, k)), sy(lerp(MT - 0.6, 6.4, k))); g.stroke();
      if (now_(7) && k >= 1) { g.fillStyle = 'rgba(250,204,21,.25)'; g.beginPath(); g.moveTo(sx(0), sy(TOP)); g.lineTo(sx(15.5), sy(6)); g.lineTo(sx(0), sy(6)); g.closePath(); g.fill(); g.beginPath(); g.moveTo(sx(0.8), sy(MT - 0.6)); g.lineTo(sx(-15.5), sy(6.4)); g.lineTo(sx(0.4), sy(6.4)); g.closePath(); g.fill(); }
    }
    // vântul: compresiune în catarg, săgeți până la chilă
    if (wind) {
      for (let i = 0; i < 6; i++) { const y = ((t * 4 + i * 1.3) % 8); g.fillStyle = 'rgba(37,99,235,.8)'; g.font = '700 26px "Segoe UI"'; g.textAlign = 'center'; g.fillText('➜', sx(-14 + y * 1.5) - 300, sy(TOP + 6 - i * 1.6)); }
      for (let i = 0; i < 5; i++) { const y = TOP - ((t * 6 + i * 6) % (TOP - KS)); arrow(g, sx(1.6), sy(y + 1.8), sx(1.6), sy(y), '#dc2626', 3); }
      g.fillStyle = '#b91c1c'; g.font = '700 14px "Segoe UI"'; g.textAlign = 'left'; g.fillText('compresiune: catargul e apăsat până în chilă', sx(2.2), sy(KS + 3));
      g.fillStyle = '#1d4ed8'; g.fillText('întindere: wanturile trag', sx(6.5), sy(TOP - 6));
    }
    g.fillStyle = '#334155'; g.font = '12px "Segoe UI"'; g.textAlign = 'left'; g.fillText('secțiune prin mijlocul corăbiei, văzută din lateral · prova este în dreapta', 12, Hc - 10);
  }
  requestAnimationFrame(loop);
}

// ============================================================ 4. de ce triunghiuri?
function initTriangle(root) {
  const cv = root.querySelector('#cvTri'); const g = cv.getContext('2d');
  const Wc = cv.width = 960, Hc = cv.height = 260;
  const $ = s => root.querySelector(s);
  let push = 0, diag = false;
  $('#triPush').addEventListener('input', e => push = +e.target.value / 100);
  $('#triDiag').addEventListener('change', e => diag = e.target.checked);
  function loop() {
    requestAnimationFrame(loop);
    if (!root.offsetParent) return;
    g.fillStyle = '#f1f5f9'; g.fillRect(0, 0, Wc, Hc);
    g.fillStyle = '#8b6b4a'; g.fillRect(0, Hc - 30, Wc, 30);
    const base = Hc - 30, s = 150;
    // pătratul articulat
    const shear = diag ? push * 4 : push * 95;
    const sq = [[120, base], [120 + s, base], [120 + s + shear, base - s], [120 + shear, base - s]];
    bars(g, sq, true);
    if (diag) { g.strokeStyle = '#7a5432'; g.lineWidth = 9; g.beginPath(); g.moveTo(...sq[0]); g.lineTo(...sq[2]); g.stroke(); pins(g, [sq[0], sq[2]]); }
    if (push > 0.02) arrow(g, sq[3][0] - 70, sq[3][1], sq[3][0] - 8, sq[3][1], '#2563eb', 5, 'împing');
    // triunghiul
    const tri = [[620, base], [620 + s * 1.2, base], [620 + s * 0.6 + push * 3, base - s]];
    bars(g, tri, true);
    if (push > 0.02) arrow(g, tri[2][0] - 70, tri[2][1], tri[2][0] - 8, tri[2][1], '#2563eb', 5, 'împing');
    g.fillStyle = '#0f172a'; g.font = '700 16px "Segoe UI"'; g.textAlign = 'center';
    g.fillText(diag ? 'pătrat cu diagonală = 2 triunghiuri: rezistă!' : push > 0.3 ? 'pătratul se strâmbă!' : 'pătrat', 120 + s / 2 + 40, 24);
    g.fillText('triunghiul nu se strâmbă', 620 + s * 0.6, 24);
  }
  requestAnimationFrame(loop);
}
function bars(g, pts) {
  g.strokeStyle = '#a57a48'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
  pins(g, pts);
}
function pins(g, pts) { g.fillStyle = '#334155'; for (const p of pts) { g.beginPath(); g.arc(p[0], p[1], 6, 0, Math.PI * 2); g.fill(); } }

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
