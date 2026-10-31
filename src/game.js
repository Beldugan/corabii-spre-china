// Academia navigatorilor: 5 misiuni (control fin + gândire).
import { Boat, D2R, angDiff, offWind, optimalBrace, norm360, clamp, polar } from './sailing.js';
import { drawShipTop, drawSea, drawWake, drawCompass } from './topship.js';
import { flagSVG, FLAG_LETTERS } from './flags.js';
import { getStars, addStars, getFlag, setFlag } from './progress.js';

const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']; // chei interne
const DIRC = { n: 'N', ne: 'NE', e: 'E', se: 'SE', s: 'S', sw: 'SV', w: 'V', nw: 'NV' }; // prescurtarea afișată (RO: V = vest)
const DIRN = { n: 'nord', ne: 'nord-est', e: 'est', se: 'sud-est', s: 'sud', sw: 'sud-vest', w: 'vest', nw: 'nord-vest' };
const dirName = b => DIRS[Math.round(norm360(b) / 45) % 8];

export const LEVELS = [
  { id: 'g1', n: 1, title: 'Prinde vântul', badge: 'Marinar', icon: '🛢️', sub: 'Adună 8 butoaie plutitoare. Vântul își schimbă direcția: reglează vergile!', skill: 'control fin cu mâna · înțelegerea vântului' },
  { id: 'g2', n: 2, title: 'Geamandurile din ceață', badge: 'Cârmaci', icon: '🌫️', sub: 'Pe ceață vezi doar aproape. Găsește 7 geamanduri numai cu busola!', skill: 'citirea busolei · direcții · orientare' },
  { id: 'g3', n: 3, title: 'Intrarea în port', badge: 'Ofițer de cart', icon: '⚓', sub: 'Portul e exact în direcția din care bate vântul. Urcă în zig-zag printre stânci.', skill: 'planificare · zig-zag (virare) · atenție' },
  { id: 'g4', n: 4, title: 'Semnalele cu steaguri', badge: 'Semnalist', icon: '🚩', sub: 'Ține minte steagurile și ridică-le pe catarg în aceeași ordine. Apoi trimite și citește mesaje.', skill: 'memorie · coduri · tragere cu mouse-ul/degetul' },
  { id: 'g5', n: 5, title: 'Marea cursă a ceaiului', badge: 'Căpitan de cliper', icon: '🏆', sub: 'Cursa din 1866! Treci prin 6 porți înaintea rivalului Taeping.', skill: 'tot ce ai învățat, sub presiunea timpului' },
];

export function initGame(root) {
  const $ = s => root.querySelector(s);
  const menu = $('#gMenu'), play = $('#gPlay'), flagBox = $('#gFlags'), sea = $('#gSea');
  const cv = $('#cvGame'), g = cv.getContext('2d');
  const W = cv.width = 960, H = cv.height = 600;
  const wheelCv = $('#cvWheel'), wg = wheelCv.getContext('2d'); wheelCv.width = wheelCv.height = 200;
  const braceIn = $('#gBrace'), msg = $('#gMsg');
  let L = null; // nivelul curent (motorul de navigație)
  let wheelAng = 0, keyR = 0, keyB = 0, paused = false;

  function renderMenu() {
    const unlockedAll = getFlag('unlockAll');
    menu.innerHTML = LEVELS.map((lv, i) => {
      const prev = i === 0 || getStars(LEVELS[i - 1].id) > 0 || unlockedAll;
      const s = getStars(lv.id);
      return `<button class="lvl ${prev ? '' : 'locked'}" data-lvl="${lv.id}" ${prev ? '' : 'disabled'}>
        <span class="ic">${prev ? lv.icon : '🔒'}</span><span class="tt"><b>${lv.n}. ${lv.title}</b><small>${lv.sub}</small><small class="sk">Exersezi: ${lv.skill}</small></span>
        <span class="st">${'⭐'.repeat(s)}${'☆'.repeat(3 - s)}</span></button>`;
    }).join('') + `<div class="controls"><button class="btn ghost" id="gUnlock">👩‍🏫 Profesor: deblochează toate misiunile</button></div>`;
    menu.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => start(b.dataset.lvl)));
    $('#gUnlock').addEventListener('click', () => { setFlag('unlockAll', true); renderMenu(); });
    const badges = LEVELS.filter(l => getStars(l.id) > 0).map(l => `<span class="badge">🎖️ ${l.badge}</span>`).join('');
    $('#gBadges').innerHTML = badges || '<span class="muted">Încă nu ai insigne. Începe cu misiunea 1!</span>';
  }

  function show(which) { menu.parentElement.classList.toggle('hidden', which !== 'menu'); play.classList.toggle('hidden', which !== 'sea'); flagBox.classList.toggle('hidden', which !== 'flags'); }

  function start(id) {
    const lv = LEVELS.find(l => l.id === id);
    if (id === 'g4') { show('flags'); startFlags(lv); return; }
    show('sea'); L = makeLevel(id); paused = false;
    wheelAng = 0; braceIn.value = 30; L.boat.brace = 30;
    $('#gTitle').textContent = `Misiunea ${lv.n}: ${lv.title}`;
    banner(L.intro, 6);
    play.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function banner(text, sec = 4) { msg.innerHTML = text; msg.classList.remove('hidden'); clearTimeout(banner.t); banner.t = setTimeout(() => msg.classList.add('hidden'), sec * 1000); }

  // -------------------------------------------- comenzi
  const keys = {};
  window.addEventListener('keydown', e => {
    if (play.classList.contains('hidden')) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  // roata cârmei: se trage în cerc cu mouse-ul sau degetul
  let wDrag = null;
  const wPt = e => { const r = wheelCv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 200 - 100, (e.clientY - r.top) / r.height * 200 - 100]; };
  wheelCv.addEventListener('pointerdown', e => { const [x, y] = wPt(e); wDrag = { a0: Math.atan2(y, x), w0: wheelAng }; wheelCv.setPointerCapture(e.pointerId); });
  wheelCv.addEventListener('pointermove', e => {
    if (!wDrag) return; const [x, y] = wPt(e); let a = Math.atan2(y, x);
    let d = a - wDrag.a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    wheelAng = clamp(wheelAng + d * 180 / Math.PI, -150, 150); wDrag.a0 = a;
  });
  wheelCv.addEventListener('pointerup', () => wDrag = null);
  wheelCv.addEventListener('dblclick', () => wheelAng = 0);
  $('#gCenter').addEventListener('click', () => wheelAng = 0);
  $('#gPause').addEventListener('click', () => { paused = !paused; $('#gPause').textContent = paused ? '▶ Continuă' : '⏸ Pauză'; });
  $('#gRestart').addEventListener('click', () => L && start(L.id));
  root.querySelectorAll('.gBack').forEach(b => b.addEventListener('click', () => { L = null; renderMenu(); show('menu'); }));
  $('#gHint').addEventListener('change', () => {});

  function drawWheel() {
    wg.clearRect(0, 0, 200, 200);
    wg.save(); wg.translate(100, 100); wg.rotate(wheelAng * D2R);
    wg.strokeStyle = '#6b4423'; wg.lineWidth = 14; wg.beginPath(); wg.arc(0, 0, 66, 0, Math.PI * 2); wg.stroke();
    wg.strokeStyle = '#8b5a2b'; wg.lineWidth = 8; wg.beginPath(); wg.arc(0, 0, 66, 0, Math.PI * 2); wg.stroke();
    for (let i = 0; i < 8; i++) {
      wg.save(); wg.rotate(i * Math.PI / 4);
      wg.strokeStyle = '#7a4f26'; wg.lineWidth = 7; wg.beginPath(); wg.moveTo(0, 0); wg.lineTo(0, -92); wg.stroke();
      wg.fillStyle = i === 0 ? '#c08a2b' : '#7a4f26'; wg.beginPath(); wg.ellipse(0, -88, 6, 10, 0, 0, Math.PI * 2); wg.fill();
      wg.restore();
    }
    wg.fillStyle = '#c08a2b'; wg.beginPath(); wg.arc(0, 0, 14, 0, Math.PI * 2); wg.fill();
    wg.restore();
    wg.fillStyle = 'rgba(15,23,42,.75)'; wg.fillRect(40, 186, 120, 12);
    wg.fillStyle = '#facc15'; const r = clamp(wheelAng / 120, -1, 1); wg.fillRect(100, 186, r * 60, 12);
  }

  // -------------------------------------------- nivelurile
  function poly(cx, cy, r, n, seed, wob = 0.3) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const k = 1 + wob * Math.sin(i * 2.7 + seed) * Math.cos(i * 1.3 + seed * 2); p.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.8]); } return p; }

  function makeLevel(id) {
    const base = { id, t: 0, hits: 0, wake: [], items: [], islands: [], rocks: [], gates: [], done: false, shake: 0, announce: [] };
    if (id === 'g1') {
      const lv = { ...base, w: 2200, h: 1600, windFrom: 0, boat: new Boat({ x: 1100, y: 800, heading: 90 }) };
      lv.shifts = [[30, 315], [60, 45], [90, 270], [120, 20], [150, 300], [180, 60]];
      const ang = [100, 160, 210, 250, 300, 40, 130, 330];
      lv.items = ang.map((a, i) => ({ x: 1100 + Math.sin(a * D2R) * (420 + (i % 3) * 140), y: 800 - Math.cos(a * D2R) * (420 + (i % 3) * 140), got: false }));
      lv.islands = [poly(300, 250, 120, 12, 1), poly(1950, 1350, 140, 12, 3)];
      lv.intro = '🛢️ <b>Prinde vântul!</b> Rotește <b>roata cârmei</b> (sau săgețile ← →) și reglează <b>vergile</b> cu glisorul (sau ↑ ↓) până când bara „Pânze” e verde. Adună toate cele 8 butoaie.';
      lv.goal = () => `Butoaie: ${lv.items.filter(b => b.got).length} / ${lv.items.length}`;
      lv.target = () => { const b = lv.items.filter(b => !b.got).sort((a, c) => dist(a, lv.boat) - dist(c, lv.boat))[0]; return b; };
      lv.stars = () => lv.t < 150 ? 3 : lv.t < 240 ? 2 : 1;
      return lv;
    }
    if (id === 'g2') {
      const lv = { ...base, w: 2600, h: 2000, windFrom: 330, boat: new Boat({ x: 300, y: 1700, heading: 45 }), fog: true, next: 0 };
      lv.items = [[700, 1500], [1250, 1650], [1700, 1250], [1500, 750], [2100, 450], [1400, 300], [700, 600]].map(([x, y], i) => ({ x, y, n: i + 1, got: false }));
      lv.islands = [poly(1050, 1100, 170, 14, 5), poly(2150, 1600, 150, 12, 2), poly(400, 300, 130, 12, 7)];
      lv.rocks = [{ x: 1900, y: 900, r: 26 }, { x: 900, y: 450, r: 22 }, { x: 1300, y: 1950, r: 25 }];
      lv.intro = '🌫️ <b>Ceață deasă!</b> Vezi doar în jurul corăbiei. Citește pe busolă <b>în ce direcție</b> e geamandura următoare (punctul verde) și îndreaptă prova într-acolo.';
      lv.goal = () => { const b = lv.items[lv.next]; if (!b) return 'Gata!'; const br = bearing(lv.boat, b); return `Geamandura ${b.n}: spre <b>${DIRN[dirName(br)]}</b> (${DIRC[dirName(br)]}, ${Math.round(br)}°), la ${Math.round(dist(lv.boat, b) / 10) * 10} m`; };
      lv.target = () => lv.items[lv.next];
      lv.stars = () => lv.t < 200 ? 3 : lv.t < 300 ? 2 : 1;
      return lv;
    }
    if (id === 'g3') {
      const lv = { ...base, w: 1800, h: 3000, windFrom: 0, boat: new Boat({ x: 900, y: 2800, heading: 300 }), wobble: 8 };
      const left = [[0, 0], [520, 0], [480, 380], [380, 700], [470, 1050], [330, 1400], [420, 1800], [300, 2200], [380, 2600], [250, 3000], [0, 3000]];
      const right = [[1800, 0], [1280, 0], [1330, 380], [1430, 760], [1320, 1150], [1470, 1500], [1360, 1900], [1500, 2300], [1420, 2650], [1550, 3000], [1800, 3000]];
      lv.islands = [left, right];
      lv.rocks = [[760, 2350, 30], [1080, 2050, 26], [650, 1700, 28], [1000, 1450, 34], [800, 1150, 24], [1150, 900, 30], [700, 700, 26], [1000, 520, 22]].map(([x, y, r]) => ({ x, y, r }));
      lv.harbor = { x: 900, y: 170, r: 90 };
      lv.intro = '⚓ <b>Portul e sus, iar vântul bate exact de acolo!</b> Nu poți merge drept: mergi în zig-zag (la vânt strâns, apoi virezi). Ferește-te de stânci!';
      lv.goal = () => `Distanța până la port: ${Math.round(dist(lv.boat, lv.harbor) / 10) * 10} m · Atingeri: ${lv.hits}`;
      lv.target = () => lv.harbor;
      lv.stars = () => lv.hits <= 1 && lv.t < 260 ? 3 : lv.hits <= 4 ? 2 : 1;
      return lv;
    }
    if (id === 'g5') {
      const lv = { ...base, w: 3200, h: 2400, windFrom: 45, boat: new Boat({ x: 300, y: 2150, heading: 0 }), next: 0 };
      lv.rival = new Boat({ x: 380, y: 2210, heading: 0, maxSpeed: 108 }); lv.rival.tack = 1; lv.rival.next = 0; lv.rival.wake = [];
      lv.islands = [poly(1000, 1500, 230, 14, 2), poly(2050, 1700, 200, 14, 4), poly(1700, 800, 230, 14, 6), poly(2950, 1150, 150, 12, 8)];
      lv.rocks = [{ x: 1400, y: 1150, r: 28 }, { x: 2450, y: 1350, r: 26 }, { x: 600, y: 900, r: 26 }];
      const G = [[700, 1900], [1500, 1950], [2600, 2050], [2650, 600], [1150, 350], [400, 1300]];
      lv.gates = G.map(([x, y], i) => ({ x, y, n: i + 1, a: [x - 85, y], b: [x + 85, y], vert: i === 2 || i === 5 }));
      lv.gates.forEach(gt => { if (gt.vert) { gt.a = [gt.x, gt.y - 85]; gt.b = [gt.x, gt.y + 85]; } });
      lv.shifts = [[40, 30], [80, 70], [120, 20], [160, 60]];
      lv.intro = '🏆 <b>Marea cursă a ceaiului, 1866!</b> Tu ești cliperul <b>Ariel</b>. Trece prin cele 6 porți (între cele două geamanduri) înaintea cliperului <b>Taeping</b>. Atenție: vântul se schimbă!';
      lv.goal = () => `Poarta ${Math.min(lv.next + 1, 6)} din 6 · Taeping: poarta ${Math.min(lv.rival.next + 1, 6)}`;
      lv.target = () => lv.gates[lv.next];
      lv.stars = () => lv.won ? 3 : lv.gap < 20 ? 2 : 1;
      return lv;
    }
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const bearing = (a, b) => norm360(Math.atan2(b.x - a.x, -(b.y - a.y)) / D2R);
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  function hitsLand(lv, x, y, pad = 0) {
    if (lv.islands.some(p => inPoly(x, y, p))) return true;
    return lv.rocks.some(r => Math.hypot(x - r.x, y - r.y) < r.r + 12 + pad);
  }
  function cross(p, q, a, b) { // segmentul p-q taie segmentul a-b?
    const d = (x1, y1, x2, y2) => x1 * y2 - y1 * x2;
    const r = [q.x - p.x, q.y - p.y], s = [b[0] - a[0], b[1] - a[1]];
    const den = d(r[0], r[1], s[0], s[1]); if (Math.abs(den) < 1e-9) return false;
    const t = d(a[0] - p.x, a[1] - p.y, s[0], s[1]) / den, u = d(a[0] - p.x, a[1] - p.y, r[0], r[1]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  function steerAI(lv, B, dt) {
    const gt = lv.gates[B.next]; if (!gt) { B.rudder = 0; return; }
    const brg = bearing(B, gt), w = lv.windFrom;
    let want = brg;
    if (offWind(brg, w) < 64) {
      const h1 = norm360(w + 64), h2 = norm360(w - 64);
      const d1 = Math.abs(angDiff(brg, h1)), d2 = Math.abs(angDiff(brg, h2));
      if (B.tack === 1 && d1 > d2 + 18) B.tack = -1; else if (B.tack === -1 && d2 > d1 + 18) B.tack = 1;
      want = B.tack === 1 ? h1 : h2;
    }
    // evită uscatul
    const ax = B.x + Math.sin(B.heading * D2R) * 150, ay = B.y - Math.cos(B.heading * D2R) * 150;
    if (hitsLand(lv, ax, ay, 20)) { B.avoid = 1.2; }
    if (B.avoid > 0) { B.avoid -= dt; want = norm360(B.heading + 70 * (B.tack || 1)); }
    B.rudder = clamp(angDiff(B.heading, want) / 25, -1, 1);
    B.brace = optimalBrace(offWind(B.heading, w));
  }

  function collide(lv, B, isPlayer) {
    const hx = Math.sin(B.heading * D2R), hy = -Math.cos(B.heading * D2R);
    const pts = [[B.x + hx * 30, B.y + hy * 30], [B.x, B.y], [B.x - hx * 28, B.y - hy * 28]];
    if (pts.some(([x, y]) => hitsLand(lv, x, y))) {
      B.x -= B.vx * 0.12 + hx * 14; B.y -= B.vy * 0.12 + hy * 14; B.speed = 0;
      if (isPlayer) { lv.hits++; lv.shake = 0.4; banner('💥 <b>Bum!</b> Ai atins uscatul sau stâncile. Întoarce corabia și mergi mai departe.', 2.5); }
      return true;
    }
    return false;
  }

  // -------------------------------------------- bucla
  let last = performance.now(), tt = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    if (!L || play.classList.contains('hidden') || !root.offsetParent) return;
    const lv = L, B = lv.boat;
    if (!paused && !lv.done) {
      lv.t += dt;
      // comenzi
      if (keys['arrowleft'] || keys['a']) wheelAng = clamp(wheelAng - 160 * dt, -150, 150);
      if (keys['arrowright'] || keys['d']) wheelAng = clamp(wheelAng + 160 * dt, -150, 150);
      if (keys['arrowup'] || keys['w']) braceIn.value = Math.min(65, +braceIn.value + 40 * dt);
      if (keys['arrowdown'] || keys['s']) braceIn.value = Math.max(0, +braceIn.value - 40 * dt);
      B.rudder = clamp(wheelAng / 120, -1, 1); B.brace = +braceIn.value;
      // vântul
      if (lv.shifts && lv.shifts.length && lv.t > lv.shifts[0][0]) {
        const [, nw] = lv.shifts.shift(); lv.windTarget = nw;
        banner(`🌬️ <b>Vântul s-a schimbat!</b> Acum bate dinspre <b>${DIRN[dirName(nw)]}</b>. Verifică pânzele!`, 3.5);
      }
      if (lv.windTarget != null) { const d = angDiff(lv.windFrom, lv.windTarget); lv.windFrom = norm360(lv.windFrom + clamp(d, -25 * dt, 25 * dt)); if (Math.abs(d) < 0.5) lv.windTarget = null; }
      const wf = lv.wobble ? norm360(lv.windFrom + Math.sin(lv.t * 0.4) * lv.wobble) : lv.windFrom;
      const px = B.x, py = B.y;
      B.update(dt, wf, 1);
      B.x = clamp(B.x, 30, lv.w - 30); B.y = clamp(B.y, 30, lv.h - 30);
      collide(lv, B, true);
      lv.wake.push({ x: B.x - Math.sin(B.heading * D2R) * 30, y: B.y + Math.cos(B.heading * D2R) * 30 }); if (lv.wake.length > 60) lv.wake.shift();
      // obiectivele
      if (lv.id === 'g1') lv.items.forEach(b => { if (!b.got && dist(b, B) < 42) { b.got = true; banner(`🛢️ Ai prins un butoi! Mai sunt ${lv.items.filter(x => !x.got).length}.`, 2); } });
      if (lv.id === 'g1' && lv.items.every(b => b.got)) win(lv);
      if (lv.id === 'g2') { const b = lv.items[lv.next]; if (b && dist(b, B) < 48) { b.got = true; lv.next++; if (lv.next >= lv.items.length) win(lv); else banner(`✅ Geamandura ${b.n}! Următoarea: spre <b>${DIRN[dirName(bearing(B, lv.items[lv.next]))]}</b>.`, 3); } }
      if (lv.id === 'g3' && dist(B, lv.harbor) < lv.harbor.r) win(lv);
      if (lv.id === 'g5') {
        const gt = lv.gates[lv.next];
        if (gt && cross({ x: px, y: py }, B, gt.a, gt.b)) { lv.next++; if (lv.next >= lv.gates.length) { lv.won = !lv.rivalDone; lv.gap = lv.rivalDone ? lv.t - lv.rivalDone : 0; win(lv); } else banner(`🚩 Poarta ${gt.n}!`, 1.5); }
        const R = lv.rival;
        if (!lv.rivalDone) {
          steerAI(lv, R, dt);
          const rx = R.x, ry = R.y; R.update(dt, wf, 1); collide(lv, R, false);
          const rg = lv.gates[R.next]; if (rg && cross({ x: rx, y: ry }, R, rg.a, rg.b)) { R.next++; if (R.next >= lv.gates.length) { lv.rivalDone = lv.t; banner('😮 Taeping a terminat cursa! Mai poți termina și tu.', 3); } }
          R.wake.push({ x: R.x - Math.sin(R.heading * D2R) * 30, y: R.y + Math.cos(R.heading * D2R) * 30 }); if (R.wake.length > 60) R.wake.shift();
        }
      }
    }
    render(lv, dt);
    drawWheel();
  }
  requestAnimationFrame(loop);

  function win(lv) {
    lv.done = true;
    const s = lv.stars(); addStars(lv.id, s);
    const lvd = LEVELS.find(l => l.id === lv.id);
    const learned = {
      g1: 'Când vântul se schimbă, trebuie să rotești vergile din nou. Marinarii trăgeau de frânghiile numite „brațe” zi și noapte.',
      g2: 'Pe ceață, navigatorii aveau încredere doar în busolă, în viteză și în timp. Așa se făcea „navigația estimată” (dead reckoning).',
      g3: 'O corabie nu poate merge drept în vânt. Ajunge totuși acolo mergând în zig-zag: asta se numește a „bordeja”.',
      g5: 'În 1866, Ariel și Taeping au plecat din China în aceeași zi și au ajuns la Londra după 99 de zile, la diferență de doar câteva minute!',
    }[lv.id];
    $('#gWin').innerHTML = `<h3>${'⭐'.repeat(s)}${'☆'.repeat(3 - s)} Misiune îndeplinită!</h3>
      <p>Timp: <b>${Math.floor(lv.t / 60)} min ${Math.round(lv.t % 60)} s</b>${lv.hits ? ` · atingeri: ${lv.hits}` : ''}${lv.id === 'g5' ? (lv.won ? ' · <b>Ai câștigat cursa!</b>' : ` · Taeping a ajuns cu ${Math.round(lv.gap)} s înainte`) : ''}</p>
      <p>🎖️ Insigna: <b>${lvd.badge}</b></p><p class="muted"><b>Ai descoperit:</b> ${learned}</p>
      <div class="controls"><button class="btn" id="gNext">Misiunea următoare ➜</button><button class="btn ghost" id="gAgain">↻ Mai încearcă o dată, pentru mai multe stele</button></div>`;
    $('#gWin').classList.remove('hidden');
    const idx = LEVELS.findIndex(l => l.id === lv.id);
    $('#gNext').addEventListener('click', () => { $('#gWin').classList.add('hidden'); const nx = LEVELS[idx + 1]; if (nx) start(nx.id); else { renderMenu(); show('menu'); } });
    $('#gAgain').addEventListener('click', () => { $('#gWin').classList.add('hidden'); start(lv.id); });
  }

  function render(lv, dt) {
    const B = lv.boat;
    let camX = clamp(B.x - W / 2, 0, lv.w - W), camY = clamp(B.y - H / 2, 0, lv.h - H);
    if (lv.shake > 0) { lv.shake -= dt; camX += (Math.random() - 0.5) * 12; camY += (Math.random() - 0.5) * 12; }
    drawSea(g, W, H, camX, camY, tt);
    g.save(); g.translate(-camX, -camY);
    // marginea lumii
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([10, 10]); g.lineWidth = 3; g.strokeRect(10, 10, lv.w - 20, lv.h - 20); g.setLineDash([]);
    // insule
    for (const p of lv.islands) drawIsland(g, p);
    for (const r of lv.rocks) drawRock(g, r, tt);
    if (lv.harbor) drawHarbor(g, lv.harbor, tt);
    // butoaie / geamanduri / porți
    if (lv.id === 'g1') lv.items.filter(b => !b.got).forEach(b => drawBarrel(g, b, tt));
    if (lv.id === 'g2') lv.items.forEach((b, i) => { if (i >= lv.next) drawBuoy(g, b.x, b.y, b.n, i === lv.next ? '#16a34a' : '#dc2626', tt); });
    if (lv.id === 'g5') lv.gates.forEach((gt, i) => { if (i >= lv.next) { const c = i === lv.next ? '#16a34a' : '#f59e0b'; drawBuoy(g, gt.a[0], gt.a[1], gt.n, c, tt); drawBuoy(g, gt.b[0], gt.b[1], gt.n, c, tt); if (i === lv.next) { g.strokeStyle = 'rgba(134,239,172,.6)'; g.setLineDash([8, 8]); g.lineWidth = 3; g.beginPath(); g.moveTo(...gt.a); g.lineTo(...gt.b); g.stroke(); g.setLineDash([]); } } });
    // rivalul
    if (lv.rival) { drawWake(g, lv.rival.wake, 8); drawShipTop(g, lv.rival.x, lv.rival.y, lv.rival.heading, 64, { brace: lv.rival.brace, side: angDiff(lv.rival.heading, lv.windFrom) >= 0 ? 1 : -1, fill: 0.3 + 0.7 * lv.rival.eff, hull: '#24432f', t: tt }); g.fillStyle = '#fff'; g.font = '700 13px "Segoe UI"'; g.textAlign = 'center'; g.fillText('Taeping', lv.rival.x, lv.rival.y - 48); }
    drawWake(g, lv.wake, 9);
    const side = angDiff(B.heading, lv.windFrom) >= 0 ? 1 : -1;
    drawShipTop(g, B.x, B.y, B.heading, 64, { brace: B.brace, side, fill: B.pol > 0 ? 0.25 + 0.75 * B.eff : 0.25, luff: B.pol === 0 || B.eff < 0.3, t: tt });
    g.restore();
    // ceața
    if (lv.fog) {
      const sx = B.x - camX, sy = B.y - camY;
      const fg = g.createRadialGradient(sx, sy, 140, sx, sy, 300);
      fg.addColorStop(0, 'rgba(225,232,238,0)'); fg.addColorStop(1, 'rgba(225,232,238,.97)');
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
    }
    // vântul (dungi)
    windStreaks(g, lv.windFrom, dt);
    // săgeată spre țintă, când e în afara ecranului (nu și pe ceață)
    const tg = lv.target && lv.target();
    if (tg && !lv.fog) {
      const sx = tg.x - camX, sy = tg.y - camY;
      if (sx < 0 || sy < 0 || sx > W || sy > H) {
        const a = Math.atan2(sy - H / 2, sx - W / 2), ex = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 40), ey = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 40);
        g.save(); g.translate(ex, ey); g.rotate(a); g.fillStyle = 'rgba(250,204,21,.9)'; g.beginPath(); g.moveTo(22, 0); g.lineTo(-10, -13); g.lineTo(-10, 13); g.closePath(); g.fill(); g.restore();
      }
    }
    // tabloul de bord
    g.fillStyle = 'rgba(15,23,42,.72)'; g.fillRect(10, 10, 560, 34);
    g.fillStyle = '#fff'; g.font = '15px "Segoe UI"'; g.textAlign = 'left';
    g.fillText(stripTags(lv.goal()), 20, 32);
    g.fillStyle = 'rgba(15,23,42,.72)'; g.fillRect(10, H - 70, 300, 60);
    g.fillStyle = '#fff'; g.font = '700 22px "Segoe UI"'; g.fillText(`${B.knots().toFixed(1)} noduri`, 20, H - 40);
    g.font = '13px "Segoe UI"'; g.fillText(`⏱ ${Math.floor(lv.t / 60)}:${String(Math.floor(lv.t % 60)).padStart(2, '0')}`, 200, H - 43);
    g.fillText('Pânze:', 20, H - 20);
    g.fillStyle = '#334155'; g.fillRect(70, H - 31, 160, 13);
    const ef = B.pol > 0 ? B.eff : 0; g.fillStyle = ef > 0.85 ? '#22c55e' : ef > 0.5 ? '#facc15' : '#ef4444'; g.fillRect(70, H - 31, 160 * ef, 13);
    if ($('#gHint').checked && B.pol > 0 && ef < 0.85) {
      const opt = optimalBrace(offWind(B.heading, lv.windFrom));
      g.fillStyle = '#fde68a'; g.fillText(B.brace < opt ? '↑ rotește vergile mai mult' : '↓ rotește vergile mai puțin', 238, H - 20);
    } else if (B.pol === 0) { g.fillStyle = '#fca5a5'; g.fillText('În vânt! Întoarce prova.', 238, H - 20); }
    drawCompass(g, W - 80, 100, 58, B.heading, lv.windFrom, { target: tg ? bearing(B, tg) : null });
    g.fillStyle = '#fff'; g.font = '12px "Segoe UI"'; g.textAlign = 'center'; g.fillText('🔵 vântul  🔴 prova  🟢 ținta', W - 80, 185);
    // mini-harta
    const mw = 150, mh = mw * lv.h / lv.w, mx = W - mw - 10, my = H - mh - 10;
    if (!lv.fog) {
      g.fillStyle = 'rgba(15,23,42,.6)'; g.fillRect(mx, my, mw, mh);
      const k = mw / lv.w;
      g.fillStyle = '#d8c48f'; for (const p of lv.islands) { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(mx + x * k, my + y * k) : g.moveTo(mx + x * k, my + y * k)); g.fill(); }
      if (tg) { g.fillStyle = '#22c55e'; g.beginPath(); g.arc(mx + tg.x * k, my + tg.y * k, 4, 0, Math.PI * 2); g.fill(); }
      if (lv.rival) { g.fillStyle = '#86efac'; g.fillRect(mx + lv.rival.x * k - 2, my + lv.rival.y * k - 2, 4, 4); }
      g.fillStyle = '#facc15'; g.beginPath(); g.arc(mx + B.x * k, my + B.y * k, 4, 0, Math.PI * 2); g.fill();
    }
    if (paused) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '700 34px "Segoe UI"'; g.textAlign = 'center'; g.fillText('Pauză', W / 2, H / 2); }
  }
  const streaks = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: 18 + Math.random() * 30, v: 0.6 + Math.random() * 0.7 }));
  function windStreaks(g2, wf, dt) {
    const a = (wf + 180) * D2R, dx = Math.sin(a), dy = -Math.cos(a);
    g2.save(); g2.strokeStyle = 'rgba(255,255,255,.28)'; g2.lineWidth = 1.5;
    for (const p of streaks) {
      p.x += dx * 170 * p.v * dt; p.y += dy * 170 * p.v * dt;
      if (p.x < -40) p.x += W + 80; if (p.x > W + 40) p.x -= W + 80; if (p.y < -40) p.y += H + 80; if (p.y > H + 40) p.y -= H + 80;
      g2.beginPath(); g2.moveTo(p.x, p.y); g2.lineTo(p.x - dx * p.l, p.y - dy * p.l); g2.stroke();
    }
    g2.restore();
  }

  // -------------------------------------------- misiunea 4: steagurile
  function startFlags(lv) {
    const rounds = [
      { type: 'mem', k: 3 }, { type: 'mem', k: 4 }, { type: 'mem', k: 5 },
      { type: 'spell', word: 'CEAI' }, { type: 'read', word: 'CHINA', opts: ['CHINA', 'CHAIN', 'CHINO', 'CINA'] }, { type: 'mem', k: 6 },
    ];
    let r = 0, mistakes = 0, target = [], slots = [], palette = [];
    const area = $('#flagArea'), info = $('#flagInfo'), say = $('#flagSay');
    $('#flagRound').textContent = '';
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function next() {
      if (r >= rounds.length) return finish();
      const R = rounds[r];
      $('#flagRound').textContent = `Runda ${r + 1} din ${rounds.length}`;
      say.className = 'say'; say.innerHTML = '';
      if (R.type === 'mem') {
        target = shuffle(FLAG_LETTERS.slice()).slice(0, R.k);
        info.innerHTML = `<b>Ține minte!</b> Căpitanul ridică ${R.k} steaguri pe catarg. Privește-le cu atenție, de sus în jos.`;
        area.innerHTML = mastHTML(target, true);
        let left = 2 + R.k * 1.2;
        const cd = document.createElement('div'); cd.className = 'countdown'; area.appendChild(cd);
        const iv = setInterval(() => { cd.textContent = `⏳ ${Math.ceil(left)} s`; left -= 0.25; if (left <= 0) { clearInterval(iv); build(R, shuffle(target.concat(shuffle(FLAG_LETTERS.filter(f => !target.includes(f))).slice(0, Math.max(3, 9 - R.k))))); } }, 250);
      } else if (R.type === 'spell') {
        target = R.word.split('');
        info.innerHTML = `<b>Trimite un mesaj!</b> Nava vecină întreabă ce ai în cală. Scrie <b>${R.word}</b> (ceai) cu steaguri: fiecare steag este o literă. Folosește tabelul de coduri.`;
        build(R, shuffle(FLAG_LETTERS.slice()).filter(f => !target.includes(f)).slice(0, 8).concat(target).sort(), true);
      } else if (R.type === 'read') {
        target = R.word.split('');
        info.innerHTML = '<b>Citește mesajul!</b> O navă din port ți-a trimis acest semnal. Folosește tabelul de coduri: ce scrie?';
        area.innerHTML = mastHTML(target, true) + codebook() + `<div class="opts">${shuffle(R.opts.slice()).map(o => `<button class="btn ghost" data-ans="${o}">${o}</button>`).join('')}</div>`;
        area.querySelectorAll('[data-ans]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.ans === R.word) { say.className = 'say good'; say.innerHTML = '✅ Corect: <b>CHINA</b>! Mergem în China după ceai.'; r++; setTimeout(next, 1600); }
          else { mistakes++; b.disabled = true; say.className = 'say warn'; say.innerHTML = 'Nu chiar. Caută fiecare steag în tabel, unul câte unul, de sus în jos.'; }
        }));
      }
    }
    function mastHTML(list, show) {
      return `<div class="mast"><div class="pole"></div>${list.map(l => `<div class="hoist">${show ? flagSVG(l, 76) : ''}</div>`).join('')}</div>`;
    }
    function codebook() { return `<div class="codebook">${FLAG_LETTERS.map(l => `<span>${flagSVG(l, 34)}<b>${l}</b></span>`).join('')}</div>`; }
    function build(R, pal, withCode) {
      palette = pal; slots = target.map(() => null);
      area.innerHTML = `<div class="flagplay"><div class="mast drop">${target.map((_, i) => `<div class="hoist slot" data-slot="${i}"><span class="num">${i + 1}</span></div>`).join('')}<div class="pole"></div></div>
        <div class="right"><p class="muted">Trage fiecare steag pe catarg (sau apasă pe el ca să-l pui pe primul loc liber). Apasă pe un steag de pe catarg ca să-l dai jos.</p>
        <div class="palette">${palette.map((l, i) => `<button class="pflag" data-i="${i}" data-l="${l}">${flagSVG(l, 64)}${withCode ? `<b>${l}</b>` : ''}</button>`).join('')}</div>
        ${withCode ? codebook() : ''}
        <div class="controls"><button class="btn" id="flagCheck">✔ Verifică</button></div></div></div>`;
      const put = (i, l) => { slots[i] = l; const el = area.querySelector(`[data-slot="${i}"]`); el.innerHTML = `<span class="num">${i + 1}</span>${flagSVG(l, 76)}`; el.classList.add('full'); };
      area.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => { const i = +el.dataset.slot; slots[i] = null; el.innerHTML = `<span class="num">${i + 1}</span>`; el.classList.remove('full'); }));
      area.querySelectorAll('.pflag').forEach(b => {
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          const ghost = b.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost);
          const mv = ev => { ghost.style.left = ev.clientX - 34 + 'px'; ghost.style.top = ev.clientY - 24 + 'px'; };
          mv(e); let moved = false;
          const onMove = ev => { moved = true; mv(ev); };
          const onUp = ev => {
            window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); ghost.remove();
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const slot = el && el.closest('.slot');
            if (slot && moved) put(+slot.dataset.slot, b.dataset.l);
            else if (!moved || !slot) { const free = slots.indexOf(null); if (free >= 0 && !moved) put(free, b.dataset.l); }
          };
          window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
        });
      });
      $('#flagCheck').addEventListener('click', () => {
        if (slots.includes(null)) { say.className = 'say warn'; say.innerHTML = 'Mai ai locuri goale pe catarg.'; return; }
        const wrong = slots.filter((l, i) => l !== target[i]).length;
        if (!wrong) { say.className = 'say good'; say.innerHTML = R.type === 'spell' ? '✅ Mesaj trimis: <b>C-E-A-I</b>! Nava vecină a răspuns cu steagul C („Da”).' : '✅ Perfect! Ai ținut minte toate steagurile, în ordine.'; r++; setTimeout(next, 1500); }
        else { mistakes++; say.className = 'say warn'; say.innerHTML = `${wrong} ${wrong === 1 ? 'steag nu e' : 'steaguri nu sunt'} la locul potrivit. ${R.type === 'mem' ? 'Uite-le din nou pentru 3 secunde…' : 'Verifică literele în tabel.'}`;
          if (R.type === 'mem') { const ov = document.createElement('div'); ov.className = 'peek'; ov.innerHTML = mastHTML(target, true); area.appendChild(ov); setTimeout(() => ov.remove(), 3000); } }
      });
    }
    function finish() {
      const s = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1; addStars('g4', s);
      area.innerHTML = `<div class="win"><h3>${'⭐'.repeat(s)}${'☆'.repeat(3 - s)} Misiune îndeplinită!</h3><p>Greșeli: ${mistakes}. 🎖️ Insigna: <b>Semnalist</b></p>
        <p class="muted"><b>Ai descoperit:</b> Înainte de radio, corăbiile „vorbeau” cu steaguri. Fiecare steag este o literă, dar are și un înțeles special: steagul P, „Blue Peter”, înseamnă „plecăm curând, toți marinarii la bord!”. Clipere ca Cutty Sark își anunțau numele cu steaguri când treceau pe lângă un far, iar vestea ajungea apoi prin telegraf la Londra.</p>
        <div class="controls"><button class="btn" id="fNext">Misiunea 5 ➜</button><button class="btn ghost" id="fAgain">↻ Încă o dată</button></div></div>`;
      $('#fNext').addEventListener('click', () => start('g5'));
      $('#fAgain').addEventListener('click', () => start('g4'));
    }
    next();
  }

  renderMenu(); show('menu');
}

function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }
function drawIsland(g, p) {
  g.save();
  const path = () => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
  path(); g.strokeStyle = 'rgba(120,220,220,.25)'; g.lineWidth = 60; g.lineJoin = 'round'; g.stroke();
  path(); g.strokeStyle = 'rgba(160,235,230,.35)'; g.lineWidth = 26; g.stroke();
  path(); g.fillStyle = '#e4d29e'; g.fill();
  // interiorul verde
  const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length;
  g.beginPath(); p.forEach(([x, y], i) => { const X = cx + (x - cx) * 0.78, Y = cy + (y - cy) * 0.78; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath();
  const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 300); gr.addColorStop(0, '#4f7a3a'); gr.addColorStop(1, '#6f9a4a'); g.fillStyle = gr; g.fill();
  // palmieri / copaci
  for (let i = 0; i < p.length; i += 2) { const X = cx + (p[i][0] - cx) * 0.45, Y = cy + (p[i][1] - cy) * 0.45; g.fillStyle = '#2f5a25'; g.beginPath(); g.arc(X, Y, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3f7030'; g.beginPath(); g.arc(X - 3, Y - 3, 9, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
function drawRock(g, r, t) {
  g.save();
  g.strokeStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(t * 3 + r.x)})`; g.lineWidth = 4;
  g.beginPath(); g.arc(r.x, r.y, r.r + 8 + Math.sin(t * 2 + r.y) * 2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#4b5563'; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * 0.8, 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6b7280'; g.beginPath(); g.ellipse(r.x - r.r * 0.25, r.y - r.r * 0.25, r.r * 0.55, r.r * 0.4, 0.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
function drawHarbor(g, h, t) {
  g.save();
  g.fillStyle = '#8d8579'; g.fillRect(h.x - 260, h.y - 160, 520, 60); g.fillRect(h.x - 260, h.y - 160, 40, 200); g.fillRect(h.x + 220, h.y - 160, 40, 200);
  g.fillStyle = '#7a5a3a'; for (let i = 0; i < 6; i++) g.fillRect(h.x - 200 + i * 75, h.y - 100, 20, 60);
  // farul
  g.fillStyle = '#f8fafc'; g.beginPath(); g.arc(h.x + 240, h.y + 60, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#dc2626'; g.beginPath(); g.arc(h.x + 240, h.y + 60, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(255,240,150,${0.25 + 0.2 * Math.sin(t * 3)})`; g.beginPath(); g.moveTo(h.x + 240, h.y + 60); g.arc(h.x + 240, h.y + 60, 160, t % (Math.PI * 2), t % (Math.PI * 2) + 0.4); g.fill();
  g.strokeStyle = 'rgba(134,239,172,.8)'; g.setLineDash([10, 8]); g.lineWidth = 3; g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.font = '700 18px "Segoe UI"'; g.textAlign = 'center'; g.fillText('⚓ PORTUL', h.x, h.y + 6);
  g.restore();
}
function drawBarrel(g, b, t) {
  const y = b.y + Math.sin(t * 2 + b.x) * 2;
  g.save(); g.translate(b.x, y); g.rotate(Math.sin(t + b.y) * 0.3);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(0, 0, 24, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8b5a2b'; g.beginPath(); g.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3f2a14'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-8, -10); g.lineTo(-8, 10); g.moveTo(8, -10); g.lineTo(8, 10); g.stroke();
  g.restore();
}
function drawBuoy(g, x, y, n, col, t) {
  const bob = Math.sin(t * 2.5 + x) * 2;
  g.save(); g.translate(x, y + bob);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 22 + Math.sin(t * 3) * 2, 0, Math.PI * 2); g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = '700 14px "Segoe UI"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, 1);
  g.restore();
}
