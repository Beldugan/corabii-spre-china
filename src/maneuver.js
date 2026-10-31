// Secțiunea 1: cum se conduce o corabie mare (cursuri față de vânt, vergi, virare, lochul).
import { D2R, angDiff, offWind, polar, optimalBrace, trimEff, pointOfSail, clamp, lerp, norm360 } from './sailing.js';
import { drawShipTop, drawSea, drawWake } from './topship.js';

function fit(cv) { const r = cv.getBoundingClientRect(); return (e) => [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }

// vântul desenat ca dungi care curg pe ecran
class Streaks {
  constructor(W, H, n = 70) { this.W = W; this.H = H; this.s = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, l: 20 + Math.random() * 40, v: 0.7 + Math.random() * 0.6 })); }
  draw(g, windFrom, dt, alpha = 0.35) {
    const a = (windFrom + 180) * D2R, dx = Math.sin(a), dy = -Math.cos(a);
    g.save(); g.strokeStyle = `rgba(255,255,255,${alpha})`; g.lineWidth = 1.6; g.lineCap = 'round';
    for (const p of this.s) {
      p.x += dx * 160 * p.v * dt; p.y += dy * 160 * p.v * dt;
      if (p.x < -60) p.x += this.W + 120; if (p.x > this.W + 60) p.x -= this.W + 120;
      if (p.y < -60) p.y += this.H + 120; if (p.y > this.H + 60) p.y -= this.H + 120;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - dx * p.l, p.y - dy * p.l); g.stroke();
    }
    g.restore();
  }
}

export function initManeuver(root) {
  initSailExplorer(root);
  initTack(root);
  initLogLine(root);
}

// ---------------------------------------------------------------- 1. cursurile față de vânt
function initSailExplorer(root) {
  const cv = root.querySelector('#cvSail'); const g = cv.getContext('2d');
  const W = cv.width = 960, H = cv.height = 540;
  const head = root.querySelector('#sHead'), brace = root.querySelector('#sBrace'), auto = root.querySelector('#sAuto');
  const say = root.querySelector('#saySail');
  const tiles = { pos: root.querySelector('#sPos'), spd: root.querySelector('#sSpd'), eff: root.querySelector('#sEff') };
  const streaks = new Streaks(W, H);
  const NOGO = 60, cx = W / 2, cy = H / 2 + 20;
  let dragging = false, t = 0, last = performance.now(), sea = 0, wake = [];
  const pt = e => fit(cv)(e);
  cv.addEventListener('pointerdown', e => { dragging = true; cv.setPointerCapture(e.pointerId); move(e); });
  cv.addEventListener('pointermove', e => dragging && move(e));
  cv.addEventListener('pointerup', () => dragging = false);
  function move(e) { const [x, y] = pt(e); head.value = Math.round(norm360(Math.atan2(x - cx, -(y - cy)) / D2R)); }
  root.querySelectorAll('[data-head]').forEach(b => b.addEventListener('click', () => { head.value = b.dataset.head; }));
  let lastKey = '';
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const h = +head.value, a = offWind(h, 0);
    if (auto.checked) brace.value = Math.round(optimalBrace(a));
    const br = +brace.value;
    const pol = polar(a, NOGO), eff = pol > 0 ? Math.max(0, trimEff(a, br)) : 0;
    const kn = 14 * pol * (0.1 + 0.9 * eff);
    sea += kn * dt * 6;
    // marea curge pe lângă corabie
    drawSea(g, W, H, Math.sin(h * D2R) * sea, -Math.cos(h * D2R) * sea, t);
    streaks.draw(g, 0, dt);
    // sectoarele din jurul corăbiei
    for (let d = 0; d < 360; d += 3) {
      const ps = pointOfSail(offWind(d, 0), NOGO);
      g.strokeStyle = ps.col; g.globalAlpha = 0.55; g.lineWidth = 16;
      g.beginPath(); g.arc(cx, cy, 205, (d - 90 - 1.6) * D2R, (d - 90 + 1.6) * D2R); g.stroke();
    }
    g.globalAlpha = 1;
    g.font = '600 13px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff';
    const lab = [[0, 'în vânt ✖'], [72, 'vânt strâns'], [-72, 'vânt strâns'], [100, 'travers'], [-100, 'travers'], [135, 'vânt larg'], [-135, 'vânt larg'], [180, 'pupa']];
    for (const [d, s] of lab) { const r = 232; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.5)'; g.strokeText(s, cx + Math.sin(d * D2R) * r, cy - Math.cos(d * D2R) * r + 4); g.fillText(s, cx + Math.sin(d * D2R) * r, cy - Math.cos(d * D2R) * r + 4); }
    // săgeata vântului
    g.fillStyle = '#93c5fd'; g.strokeStyle = '#1e3a8a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 14, 6); g.lineTo(cx + 14, 6); g.lineTo(cx + 14, 30); g.lineTo(cx + 26, 30); g.lineTo(cx, 54); g.lineTo(cx - 26, 30); g.lineTo(cx - 14, 30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = '700 14px "Segoe UI"'; g.fillText('VÂNTUL', cx + 62, 30);
    // dâra din spate
    const sx = cx - Math.sin(h * D2R) * 70, sy = cy + Math.cos(h * D2R) * 70;
    wake = wake.map(p => ({ x: p.x - Math.sin(h * D2R) * kn * dt * 6, y: p.y + Math.cos(h * D2R) * kn * dt * 6 })).filter(p => Math.hypot(p.x - cx, p.y - cy) < 190);
    if (kn > 0.5) wake.push({ x: sx, y: sy });
    if (wake.length > 40) wake.shift();
    drawWake(g, wake.slice().reverse(), 6 + kn);
    const side = angDiff(h, 0) >= 0 ? 1 : -1;
    drawShipTop(g, cx, cy, h, 150, { brace: br, side, fill: pol > 0 ? 0.2 + 0.8 * eff : 0.25, luff: pol === 0 || eff < 0.3, t });
    // informații
    const ps = pointOfSail(a, NOGO);
    tiles.pos.textContent = `${ps.ro.split(' —')[0]} (${ps.en})`;
    tiles.spd.textContent = `${kn.toFixed(1)} noduri`;
    tiles.eff.textContent = pol === 0 ? 'fâlfâie' : `${Math.round(eff * 100)}% umflate`;
    const key = ps.key + (pol > 0 ? (eff > 0.85 ? 'g' : eff > 0.4 ? 'm' : 'b') : '');
    if (key !== lastKey) {
      lastKey = key;
      const opt = Math.round(optimalBrace(a));
      say.className = 'say' + (eff > 0.85 ? ' good' : pol === 0 ? ' warn' : '');
      say.innerHTML = pol === 0
        ? '<b>În vânt (in irons).</b> O corabie cu pânze pătrate NU poate merge mai aproape de 60–70° de direcția din care bate vântul. Pânzele fâlfâie și corabia se oprește. Întoarce-o!'
        : eff > 0.85 ? `<b>${ps.ro}.</b> Perfect! Pânzele sunt umflate, corabia merge cu ${kn.toFixed(1)} noduri. ${ps.key === 'broad' ? 'Acesta e cursul cel mai rapid pentru o corabie cu pânze pătrate.' : ps.key === 'close' ? 'Mai aproape de vânt nu se poate.' : ps.key === 'run' ? 'Cu vântul exact din spate, pânzele din spate le „ascund” de vânt pe cele din față.' : ''}`
          : `<b>${ps.ro}.</b> Pânzele nu sunt bine reglate. Rotește vergile ${br < opt ? '<b>mai mult</b> (spre dreapta pe glisor)' : '<b>mai puțin</b> (spre stânga pe glisor)'}.`;
    }
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- 2. virarea
const TACK_STEPS = [
  { at: 0, ro: '„Pregătiți de virare!”', en: 'Ready about!', d: 'Toți marinarii merg la frânghiile vergilor (brațe). Corabia merge la vânt strâns.' },
  { at: 3, ro: '„Cârma sub vânt!”', en: 'Helm’s a-lee!', d: 'Cârmaciul rotește roata. Prova urcă spre vânt, iar focurile din față se slăbesc.' },
  { at: 5.6, ro: '„Vergile mari, trageți!”', en: 'Mainsail haul!', d: 'Când prova trece exact prin vânt, se rotesc repede vergile arborelui mare și ale artimonului. Pânzele din față bat pe dos și împing prova mai departe.' },
  { at: 7.6, ro: '„Și cele din față!”', en: 'Let go and haul!', d: 'Se rotesc și vergile trinchetului. Toate pânzele prind vânt pe partea cealaltă.' },
  { at: 9.2, ro: 'Pe noul bord', en: 'On the new tack', d: 'Corabia merge din nou la vânt strâns, în zig-zag spre vânt. Dacă virarea nu reușea, corabia rămânea „în vânt” și pierdea mult timp.' },
];
const WEAR_STEPS = [
  { at: 0, ro: '„Pregătiți de virare prin pupa!”', en: 'Stand by to wear ship!', d: 'Pe vânt foarte tare, sau la corăbii mari și grele, era mai sigur așa.' },
  { at: 2.5, ro: '„Cârma în vânt!”', en: 'Up helm!', d: 'Corabia se îndepărtează de vânt; vergile se rotesc treptat spre poziția dreaptă.' },
  { at: 6.5, ro: 'Vânt din pupa', en: 'Running', d: 'Vântul vine exact din spate. Vergile stau drept, de-a curmezișul corăbiei.' },
  { at: 9.5, ro: '„Brațați vergile!”', en: 'Brace up!', d: 'Corabia continuă să se întoarcă, iar vergile se rotesc pe partea cealaltă.' },
  { at: 13, ro: 'Pe noul bord', en: 'On the new tack', d: 'Am ajuns tot pe bordul celălalt, dar am făcut o buclă mare și am pierdut drum spre vânt.' },
];
function tackState(t) { // vântul din nord; corabia începe la 295°
  let h, br = [60, 60, 60], sd = [1, 1, 1], back = [false, false, false], v;
  if (t < 3) h = 295;
  else if (t < 7.6) h = 295 + (t - 3) / 4.6 * 120;
  else if (t < 9.2) h = 415 + (t - 7.6) / 1.6 * 10;
  else h = 425;
  h = norm360(h);
  const a = offWind(h, 0);
  if (t >= 5.6) { sd[1] = sd[2] = -1; }
  if (t >= 7.6) sd[0] = -1;
  if (t >= 4.5 && t < 7.6) back[0] = true;
  v = t < 3 ? 32 : t < 9.2 ? lerp(32, 8, Math.min(1, (t - 3) / 3)) * (a < 60 ? 0.5 : 1) : Math.min(32, 8 + (t - 9.2) * 10);
  return { h, br, sd, back, v, a };
}
function wearState(t) {
  let h;
  if (t < 2.5) h = 295;
  else if (t < 13) h = 295 - (t - 2.5) / 10.5 * 230;
  else h = 65;
  h = norm360(h);
  const a = offWind(h, 0); const b = optimalBrace(a);
  const sd = angDiff(h, 0) >= 0 ? 1 : -1;
  return { h, br: [b, b, b], sd: [sd, sd, sd], back: [false, false, false], v: 34, a };
}

function initTack(root) {
  const cv = root.querySelector('#cvTack'); const g = cv.getContext('2d');
  const W = cv.width = 960, H = cv.height = 440;
  const list = root.querySelector('#tackSteps');
  const streaks = new Streaks(W, H, 50);
  let mode = 'tack', T = 0, running = false, x = 0, y = 0, trail = [], last = performance.now(), tt = 0;
  function reset(m) {
    mode = m; T = 0; trail = [];
    if (m === 'tack') { x = 560; y = 330; } else { x = 480; y = 150; }
    const S = m === 'tack' ? TACK_STEPS : WEAR_STEPS;
    list.innerHTML = S.map(s => `<li><b>${s.ro}</b> <i>(${s.en})</i><br><span class="muted">${s.d}</span></li>`).join('');
    root.querySelectorAll('[data-tack]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tack === m));
  }
  root.querySelectorAll('[data-tack]').forEach(b => b.addEventListener('click', () => { reset(b.dataset.tack); running = true; }));
  root.querySelector('#tackReplay').addEventListener('click', () => { reset(mode); running = true; });
  reset('tack');
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    const S = mode === 'tack' ? TACK_STEPS : WEAR_STEPS, end = mode === 'tack' ? 12 : 16;
    if (running) { T += dt * 0.8; if (T > end) { running = false; } }
    const s = mode === 'tack' ? tackState(T) : wearState(T);
    if (running) { x += Math.sin(s.h * D2R) * s.v * dt * 0.8 * 1.6; y -= Math.cos(s.h * D2R) * s.v * dt * 0.8 * 1.6; y += 3 * dt; trail.push({ x, y }); }
    drawSea(g, W, H, 0, 0, tt);
    streaks.draw(g, 0, dt, 0.3);
    // dâra
    g.save(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([5, 6]); g.lineWidth = 2;
    g.beginPath(); trail.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); g.restore();
    drawShipTop(g, x, y, s.h, 110, { braces: s.br, sides: s.sd, backed: s.back, fill: s.a < 60 ? 0.3 : 1, luff: s.a < 60, t: tt });
    g.fillStyle = '#93c5fd'; g.font = '700 14px "Segoe UI"'; g.textAlign = 'left'; g.fillText('⬇ VÂNTUL bate dinspre nord', 14, 24);
    let cur = 0; S.forEach((st, i) => { if (T >= st.at) cur = i; });
    [...list.children].forEach((li, i) => { li.classList.toggle('now', i === cur); li.classList.toggle('done', i < cur); });
    g.fillStyle = 'rgba(15,23,42,.72)'; g.fillRect(W - 360, H - 64, 346, 50);
    g.fillStyle = '#fde68a'; g.font = '700 17px Georgia'; g.textAlign = 'center'; g.fillText(S[cur].ro, W - 187, H - 42);
    g.fillStyle = '#fff'; g.font = 'italic 14px Georgia'; g.fillText(S[cur].en, W - 187, H - 22);
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- 3. lochul cu noduri
function initLogLine(root) {
  const cv = root.querySelector('#cvLog'); const g = cv.getContext('2d');
  const W = cv.width = 960, H = cv.height = 260;
  const btn = root.querySelector('#logThrow'), inp = root.querySelector('#logAns'), chk = root.querySelector('#logCheck'), say = root.querySelector('#sayLog');
  let st = { phase: 'idle', speed: 8, t: 0, knots: 0 }, last = performance.now(), tt = 0;
  const DUR = 9; // nisiparnița de 28 de secunde, accelerată la 9 secunde
  btn.addEventListener('click', () => {
    st = { phase: 'run', speed: 4 + Math.floor(Math.random() * 10), t: 0, knots: 0 };
    inp.value = ''; say.className = 'say'; say.innerHTML = 'Numără nodurile de pe frânghie care trec prin mâna marinarului, până se termină nisipul din clepsidră!';
  });
  chk.addEventListener('click', () => {
    if (st.phase !== 'done') { say.innerHTML = 'Mai întâi aruncă lochul și numără nodurile.'; return; }
    const v = +inp.value;
    if (v === st.speed) { say.className = 'say good'; say.innerHTML = `✅ Corect: <b>${st.speed} noduri</b>! Corabia merge cu ${st.speed} mile marine pe oră, adică ${(st.speed * 1.852).toFixed(1).replace('.', ',')} km pe oră. De aici vine cuvântul „nod” pentru viteza vapoarelor!`; }
    else { say.className = 'say warn'; say.innerHTML = `Au trecut <b>${st.speed}</b> noduri, nu ${v || 'niciunul'}. Mai încearcă: privește cu atenție nodurile roșii.`; }
  });
  function loop(now) {
    requestAnimationFrame(loop);
    if (!root.offsetParent) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tt += dt;
    if (st.phase === 'run') { st.t += dt; if (st.t >= DUR) { st.t = DUR; st.phase = 'done'; say.innerHTML += '<br><b>Stop!</b> S-a terminat nisipul. Câte noduri ai numărat? Scrie numărul mai jos.'; } }
    // fundal: marea văzută din lateral
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#bcd7ea'); sky.addColorStop(0.42, '#e3eef5'); sky.addColorStop(0.43, '#2c6688'); sky.addColorStop(1, '#173f5c');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const wy = H * 0.43;
    // valuri
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, wy + 18 + i * 22 + Math.sin(x * 0.03 + tt * 2 + i) * 3); g.stroke(); }
    // pupa corăbiei
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(0, wy - 90); g.lineTo(150, wy - 90); g.lineTo(175, wy - 20); g.lineTo(160, wy + 30); g.lineTo(0, wy + 30); g.closePath(); g.fill();
    g.fillStyle = '#c9a14a'; g.fillRect(0, wy - 70, 158, 10);
    // marinarul
    g.fillStyle = '#1e3a8a'; g.fillRect(118, wy - 140, 22, 50); g.fillStyle = '#e9b896'; g.beginPath(); g.arc(129, wy - 150, 11, 0, Math.PI * 2); g.fill();
    // mulinetă
    g.fillStyle = '#7a5432'; g.beginPath(); g.arc(150, wy - 110, 16, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(150, wy - 110); g.rotate(st.phase === 'run' ? tt * 8 : 0); g.strokeStyle = '#3a2716'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.moveTo(0, -14); g.lineTo(0, 14); g.stroke(); g.restore();
    // frânghia: nodurile pleacă din mâna marinarului spre lochul din apă
    const sp = 66; // pixeli între noduri
    const out = st.phase === 'idle' ? 0 : st.speed * sp * (st.t / DUR);
    const logX = 175 + Math.min(out, W - 260) + 40;
    g.strokeStyle = '#d9c9a3'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(150, wy - 110); g.quadraticCurveTo((150 + logX) / 2, wy - 20, logX, wy + 8); g.stroke();
    // nodurile care au trecut deja
    const passed = Math.floor(out / sp);
    for (let k = 1; k <= passed; k++) {
      const f = 1 - (k * sp) / Math.max(out, 1);
      const px = lerp(150, logX, f), py = (1 - f) * (1 - f) * (wy - 110) + 2 * (1 - f) * f * (wy - 20) + f * f * (wy + 8);
      g.fillStyle = '#dc2626'; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fill();
    }
    // lochul (o scândurică în apă)
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.moveTo(logX - 14, wy + 4); g.lineTo(logX + 14, wy + 4); g.lineTo(logX, wy + 22); g.closePath(); g.fill();
    // clepsidra
    const cx = W - 70, cy = 70, f = st.phase === 'idle' ? 0 : st.t / DUR;
    g.strokeStyle = '#7a5a2a'; g.lineWidth = 4; g.strokeRect(cx - 28, cy - 50, 56, 4); g.strokeRect(cx - 28, cy + 46, 56, 4);
    g.fillStyle = 'rgba(230,240,250,.8)'; g.beginPath(); g.moveTo(cx - 22, cy - 46); g.lineTo(cx + 22, cy - 46); g.lineTo(cx + 3, cy); g.lineTo(cx + 22, cy + 46); g.lineTo(cx - 22, cy + 46); g.lineTo(cx - 3, cy); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e0b04c';
    const top = 1 - f; g.beginPath(); g.moveTo(cx - 20 * top, cy - 40 * top); g.lineTo(cx + 20 * top, cy - 40 * top); g.lineTo(cx, cy - 2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx - 20 * f, cy + 46 - 40 * f); g.lineTo(cx + 20 * f, cy + 46 - 40 * f); g.lineTo(cx + 22, cy + 46); g.lineTo(cx - 22, cy + 46); g.closePath(); g.fill();
    g.fillStyle = '#1e293b'; g.font = '13px "Segoe UI"'; g.textAlign = 'center'; g.fillText('clepsidra: 28 s', cx, cy + 70);
  }
  requestAnimationFrame(loop);
}
