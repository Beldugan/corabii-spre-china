// Simularea călătoriei spre China pe harta reală, zi cu zi.
import { makeProjection, makeBase, WindParticles, drawPlaces, MAP_W, MAP_H, windDirName } from './map.js';
import { ROUTES, MONTHS, haversineNm, windAt, WIND_ZONES, PLACES } from './geo.js';
import { drawShipTop } from './topship.js';
import { addStars } from './progress.js';

const DECISIONS = {
  dold: {
    q: 'Înaintea noastră sunt calmele ecuatoriale (doldrums), unde aproape nu bate vântul. Pe unde trecem?',
    opts: [
      { t: 'Aproape de coasta Africii: pe hartă pare drumul cel mai scurt.', ok: false, fb: 'Ne-am apropiat prea mult de Africa. Curentul Guineei ne-a tras în golf, iar acolo calmul e foarte lat. Am stat pe loc două săptămâni, sub soare, cu apa de băut pe rație.', pen: 14 },
      { t: 'Spre vest: trecem Ecuatorul pe la 25–30° vest, unde fâșia de calm e mai îngustă.', ok: true, fb: 'Bună alegere! Așa făceau toți căpitanii pricepuți. Am trecut calmele în doar câteva zile.' },
    ],
  },
  cape: {
    q: 'Trebuie să ocolim Africa. Cum trecem de Capul Bunei Speranțe?',
    opts: [
      { t: 'Aproape de țărm, ca să vedem uscatul și să fim în siguranță.', ok: false, fb: 'Lângă țărm curentul Agulhas curge împotriva noastră, iar vântul de vest ridică valuri uriașe. O furtună ne-a rupt o vergă. Am pierdut o săptămână cu reparațiile.', pen: 7 },
      { t: 'Coborâm spre sud, la 40° sud, unde suflă „Patruzecile urlătoare”.', ok: true, fb: 'Corect! Vânturile puternice de vest ne duc spre est foarte repede. E frig și sunt valuri mari, dar mergem cu peste 250 de mile pe zi.' },
    ],
  },
  monsoon: {
    q: 'Musonul de nord-est bate exact din direcția Chinei! Ce facem?',
    opts: [
      { t: 'Luptăm direct împotriva vântului, în zig-zag, prin Marea Chinei de Sud.', ok: false, fb: 'Mergem foarte încet: facem zig-zag zile întregi și câștigăm doar câțiva kilometri pe zi.', factor: 0.4 },
      { t: 'Ocolim pe la est, prin strâmtorile Indoneziei și pe lângă Filipine („drumul de est”).', ok: true, fb: 'Așa făceau căpitanii când musonul era împotrivă: un drum mai lung, dar cu vânturi mai bune. Mergem mai repede!', factor: 0.75 },
    ],
  },
};

function zoneFactor(lon, lat, month, st) {
  if (lat > -1 && lat < 33 && lon > 104 && lon < 126) {
    if (month >= 4 && month <= 8) return { f: 1.15, k: 'monsoonSW' };
    return { f: st.monFactor || 0.45, k: 'monsoonNE' };
  }
  if (lon > 103 && lon < 111 && lat > -8 && lat <= -1) return { f: 0.6, k: 'sunda' };
  if (lat > 43) return { f: 0.6, k: 'westN' };
  if (lat > 27) return { f: 0.8, k: 'horseN' };
  if (lat > 8) return { f: 1.0, k: 'tradeNE' };
  if (lat > -2 && lon < 15) return { f: 0.3, k: 'doldrums' };
  if (lat > -25) return { f: 0.85, k: 'tradeSE' };
  if (lat > -35) return { f: 0.75, k: 'horseS' };
  return { f: 1.4, k: 'forties' };
}

export function initVoyage(root, getThumb) {
  const cv = root.querySelector('#cvVoyage'); const g = cv.getContext('2d');
  cv.width = MAP_W; cv.height = MAP_H;
  const proj = makeProjection(); const base = makeBase(proj);
  const parts = new WindParticles(proj, base, 600);
  const $ = s => root.querySelector(s);
  const log = $('#vLog'), modal = $('#vModal');
  let st = null, playing = false, dps = 3;

  function setup(shipId) {
    const R = ROUTES[shipId];
    const pts = R.pts.map(p => ({ ...p }));
    let cum = 0; pts[0].d = 0;
    for (let i = 1; i < pts.length; i++) { cum += haversineNm(pts[i - 1].p, pts[i].p); pts[i].d = cum; }
    const m = +$('#vMonth').value;
    const start = new Date(R.start.getFullYear(), m, R.start.getMonth() === m ? R.start.getDate() : 1);
    st = { id: shipId, R, pts, total: cum, dist: 0, prevDist: 0, day: 0, frac: 1, stop: 0, stuck: 0, next: 1, start, done: false, stars: 0, decided: {}, monFactor: null, speed: 0, zone: 'westN', trail: [] };
    log.innerHTML = '';
    addLog(0, `⚓ ${pts[0].n}: ${pts[0].ev}`);
    $('#vTitle').textContent = R.label;
    $('#vEnd').classList.add('hidden');
    hud();
  }
  function date(day) { const d = new Date(st.start); d.setDate(d.getDate() + day); return d; }
  function fmt(d) { return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
  function addLog(day, text, cls = '') {
    const li = document.createElement('li'); li.className = cls;
    li.innerHTML = `<span class="d">Ziua ${day} · ${fmt(date(day))}</span> ${text}`;
    log.prepend(li);
  }
  function posAt(dist) {
    const P = st.pts; let i = 1;
    while (i < P.length - 1 && P[i].d < dist) i++;
    const a = P[i - 1], b = P[i]; const k = Math.max(0, Math.min(1, (dist - a.d) / Math.max(1e-6, b.d - a.d)));
    return { lon: a.p[0] + (b.p[0] - a.p[0]) * k, lat: a.p[1] + (b.p[1] - a.p[1]) * k, i };
  }
  function hud() {
    const p = posAt(st.dist);
    const w = windAt(p.lon, p.lat, monthSeason(date(st.day).getMonth()));
    $('#vDay').textContent = st.day;
    $('#vDate').textContent = fmt(date(st.day));
    $('#vDist').textContent = `${Math.round(st.dist).toLocaleString('ro-RO')} mile`;
    $('#vKm').textContent = `${Math.round(st.dist * 1.852).toLocaleString('ro-RO')} km`;
    $('#vSpeed').textContent = st.stop > 0 ? 'în port' : st.stuck > 0 ? 'calm / reparații' : `${st.speed.toFixed(1)} noduri`;
    $('#vWind').textContent = `${WIND_ZONES[w.zone].name.replace(/ \(.*/, '')} · dinspre ${windDirName(w.u, w.v)}`;
    $('#vProg').style.width = `${(100 * st.dist / st.total).toFixed(1)}%`;
  }
  function monthSeason(m) { return m >= 4 && m <= 8 ? 'summer' : 'winter'; }

  function dayStep() {
    if (st.done) return;
    st.prevDist = st.dist; st.day++;
    if (st.stop > 0) { st.stop--; st.speed = 0; hud(); return; }
    if (st.stuck > 0) { st.stuck--; st.speed = 0.4; st.dist += 8; hud(); return; }
    const p = posAt(st.dist);
    const month = date(st.day).getMonth();
    const z = zoneFactor(p.lon, p.lat, month, st);
    st.zone = z.k;
    st.speed = st.R.base * z.f * (0.8 + Math.random() * 0.4);
    st.dist = Math.min(st.total, st.dist + st.speed * 24);
    // am trecut de un punct al traseului?
    while (st.next < st.pts.length && st.pts[st.next].d <= st.dist) {
      const wp = st.pts[st.next];
      if (wp.n || wp.ev) addLog(st.day, `${wp.stop ? '⚓' : '🧭'} <b>${wp.n || ''}</b>${wp.ev ? ': ' + wp.ev : ''}${wp.stop ? ` <i>(oprire ${wp.stop} zile)</i>` : ''}`);
      if (wp.stop) { st.stop = wp.stop; st.dist = wp.d; }
      if (wp.decision) { st.dist = wp.d; st.next++; ask(wp.decision); return; }
      st.next++;
    }
    if (st.dist >= st.total - 0.5) finish();
    hud();
  }
  function ask(key) {
    if (key === 'monsoon') {
      const m = date(st.day).getMonth();
      if (m >= 4 && m <= 8) { addLog(st.day, '🌬️ <b>Musonul de sud-vest</b> bate din spate și ne împinge direct spre China. Ce noroc că am plecat la momentul potrivit!', 'good'); st.stars++; hud(); return; }
    }
    pause();
    const D = DECISIONS[key];
    modal.querySelector('.q').textContent = D.q;
    const box = modal.querySelector('.opts'); box.innerHTML = '';
    D.opts.forEach(o => {
      const b = document.createElement('button'); b.textContent = o.t;
      b.addEventListener('click', () => {
        st.decided[key] = o.ok;
        if (o.ok) st.stars++;
        if (o.pen) st.stuck += o.pen;
        if (o.factor) st.monFactor = o.factor;
        addLog(st.day, `${o.ok ? '✅' : '⚠️'} ${o.fb}`, o.ok ? 'good' : 'bad');
        modal.classList.add('hidden'); play();
      });
      box.appendChild(b);
    });
    modal.classList.remove('hidden');
  }
  function finish() {
    st.done = true; pause();
    const months = (st.day / 30.4).toFixed(1).replace('.', ',');
    const km = Math.round(st.total * 1.852);
    const real = st.id === 'cutty'
      ? 'Cliperele de ceai făceau de obicei între 100 și 120 de zile până în China.'
      : 'Ambasada lordului Macartney a plecat în septembrie 1792 și a ajuns în China abia în iunie 1793: aproape 9 luni, cu opriri lungi.';
    $('#vEnd').innerHTML = `<h3>🎉 Am ajuns în China!</h3>
      <p>Călătoria a durat <b>${st.day} de zile</b> (cca ${months} luni). Am parcurs <b>${Math.round(st.total).toLocaleString('ro-RO')} de mile marine</b>, adică <b>${km.toLocaleString('ro-RO')} km</b>: cam ${(km / 40075 * 100).toFixed(0)}% din ocolul Pământului!</p>
      <p>${real}</p>
      <p>Decizii bune ale căpitanului: <b>${'⭐'.repeat(st.stars)}${'☆'.repeat(Math.max(0, 3 - st.stars))}</b></p>
      <p class="muted">Încearcă și cu altă lună de plecare: ce se întâmplă dacă ajungi în Marea Chinei de Sud iarna?</p>`;
    $('#vEnd').classList.remove('hidden');
    addStars('voyage-' + st.id, st.stars);
  }
  function play() { if (st.done) setup(st.id); playing = true; $('#vPlay').textContent = '⏸ Pauză'; }
  function pause() { playing = false; $('#vPlay').textContent = '▶ Pornește'; }

  // butoane
  root.querySelectorAll('[data-vship]').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('[data-vship]').forEach(x => x.setAttribute('aria-pressed', x === b));
    $('#vMonth').value = ROUTES[b.dataset.vship].start.getMonth();
    pause(); setup(b.dataset.vship);
  }));
  $('#vMonth').innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  $('#vMonth').value = 1;
  $('#vMonth').addEventListener('change', () => { pause(); setup(st.id); });
  $('#vPlay').addEventListener('click', () => playing ? pause() : play());
  $('#vReset').addEventListener('click', () => { pause(); setup(st.id); });
  root.querySelectorAll('[data-dps]').forEach(b => b.addEventListener('click', () => { dps = +b.dataset.dps; root.querySelectorAll('[data-dps]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  setup('cutty');
  if (getThumb) root.querySelectorAll('[data-vship] img').forEach(img => getThumb(img.dataset.id).then(u => { if (u) img.src = u; }));

  const routeNames = new Set(['Londra', 'Madeira', 'Capul Verde', 'Rio de Janeiro', 'Capul Bunei Speranțe', 'Str. Sunda', 'Batavia', 'Macao', 'Canton', 'Shanghai', 'Tristan da Cunha']);
  let last = performance.now(), acc = 0, t = 0;
  const loop = now => {
    requestAnimationFrame(loop);
    if (!root.offsetParent || now - last < 30) { if (!root.offsetParent) last = now; return; } // cel mult ~30 de cadre pe secundă
    const dt = Math.min(0.06, (now - last) / 1000); last = now; t += dt;
    if (playing) { acc += dt * dps; while (acc >= 1 && playing) { acc -= 1; dayStep(); } }
    const frac = playing ? acc : 1;
    const d = st.prevDist + (st.dist - st.prevDist) * Math.min(1, frac);
    parts.season = monthSeason(date(st.day).getMonth());
    g.drawImage(base.canvas, 0, 0);
    parts.step(dt * 0.6); parts.draw(g, 0.45);
    // traseul planificat
    g.save(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([3, 6]); g.lineWidth = 2;
    g.beginPath(); st.pts.forEach((p, i) => { const q = proj(p.p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); g.restore();
    // drumul făcut
    const cur = posAt(d);
    g.save(); g.strokeStyle = '#ffcf40'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); let started = false;
    for (let i = 0; i < st.pts.length && st.pts[i].d <= d; i++) { const q = proj(st.pts[i].p); started ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); started = true; }
    const cq = proj([cur.lon, cur.lat]); g.lineTo(cq[0], cq[1]); g.stroke(); g.restore();
    drawPlaces(g, proj, PLACES.filter(p => routeNames.has(p.n)), { size: 12 });
    // corabia
    const ahead = posAt(Math.min(st.total, d + 60)), back = posAt(Math.max(0, d - 60));
    const qa = proj([ahead.lon, ahead.lat]), qb = proj([back.lon, back.lat]);
    const hdg = Math.atan2(qa[0] - qb[0], -(qa[1] - qb[1])) * 180 / Math.PI;
    g.save(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cq[0], cq[1], 22 + Math.sin(t * 3) * 3, 0, Math.PI * 2); g.fill(); g.restore();
    drawShipTop(g, cq[0], cq[1], hdg, 34, { brace: 20, fill: st.stop || st.stuck ? 0.25 : 1, luff: st.stuck > 0, t, hull: st.id === 'cutty' ? '#111' : '#2a2016' });
  };
  requestAnimationFrame(loop);
}
