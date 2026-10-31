// Secțiunea 7: problema zilei (în stilul Cangurului) + problema de rezervă, mai grea.

function mcq(box, opts, correct, onRight, fbEl, wrongMsg) {
  box.innerHTML = opts.map((o, i) => `<button data-i="${i}"><b>${'ABCDE'[i]}</b>&nbsp; ${o}</button>`).join('');
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (+b.dataset.i === correct) { b.classList.add('ok'); fbEl.className = 'say good'; onRight(); box.querySelectorAll('button').forEach(x => x.disabled = true); }
    else { b.classList.add('no'); b.disabled = true; fbEl.className = 'say warn'; fbEl.innerHTML = wrongMsg; }
  }));
}

export function initProblem(root) {
  // ---------------- problema 1: catargele din port
  const pic = root.querySelector('#p1pic');
  const boats = Array.from({ length: 12 }, (_, i) => i);
  pic.innerHTML = `<svg viewBox="0 0 900 300" class="harbor">
    <defs><linearGradient id="fogg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8eef3" stop-opacity="1"/><stop offset="0.86" stop-color="#e8eef3" stop-opacity="1"/><stop offset="1" stop-color="#e8eef3" stop-opacity="0"/></linearGradient></defs>
    <rect width="900" height="300" fill="#cfdde7"/><rect y="200" width="900" height="100" fill="#3e6f8f"/>
    ${boats.map(i => { const x = 25 + i * 72, y = 205 + (i % 2) * 22; return `<g transform="translate(${x},${y})"><line x1="22" y1="0" x2="22" y2="-120" stroke="#3a2a1a" stroke-width="3"/><line x1="44" y1="0" x2="44" y2="-140" stroke="#3a2a1a" stroke-width="3"/><path d="M0 0H64L56 16H8Z" fill="#2b2420"/></g>`; }).join('')}
    <rect y="0" width="900" height="196" fill="url(#fogg)"/>
    <g transform="translate(760,30)"><rect x="-6" y="0" width="12" height="150" fill="#5a4026"/><path d="M-30 0H30L22 18H-22Z" fill="#7a5432"/><circle cx="0" cy="-14" r="10" fill="#e9b896"/><rect x="-8" y="-6" width="16" height="10" fill="#1e3a8a"/></g>
    <g transform="translate(560,40)"><rect width="190" height="54" rx="12" fill="#fff" stroke="#334155"/><path d="M190 30L205 40L188 40Z" fill="#fff" stroke="#334155"/><text x="95" y="24" text-anchor="middle" font-size="15" font-family="Segoe UI">Număr 31 de catarge,</text><text x="95" y="44" text-anchor="middle" font-size="15" font-family="Segoe UI">dar ceața le ascunde!</text></g>
  </svg>`;
  const fb1 = root.querySelector('#p1fb');
  mcq(root.querySelector('#p1opts'), ['5', '6', '7', '8', '9'], 2, () => {
    fb1.innerHTML = '✅ <b>Corect: 7 clipere</b> (și 5 joncuri). Verificare: 7 × 3 = 21 și 5 × 2 = 10; 21 + 10 = 31 de catarge, iar 7 + 5 = 12 corăbii.';
    root.querySelector('#p1sol').classList.remove('hidden');
  }, fb1, 'Nu chiar. Verifică: câte catarge ar fi în total cu numărul ăsta de clipere? Poți folosi și ajutoarele.');
  // laboratorul: Eva comută corăbiile între joncă și cliper
  const lab = root.querySelector('#p1lab');
  const kinds = Array(12).fill(2);
  function drawLab() {
    const total = kinds.reduce((a, b) => a + b, 0), cl = kinds.filter(k => k === 3).length;
    lab.querySelector('.boats').innerHTML = kinds.map((k, i) => `<button class="boat ${k === 3 ? 'cl' : 'jk'}" data-i="${i}" title="apasă ca să schimbi">${boatIcon(k)}<small>${k === 3 ? 'cliper' : 'joncă'}</small></button>`).join('');
    lab.querySelector('.sum').innerHTML = `Clipere: <b>${cl}</b> · Joncuri: <b>${12 - cl}</b> · Catarge: <b>${total}</b> ${total === 31 ? '🎯 Exact 31!' : total < 31 ? '(prea puține)' : '(prea multe)'}`;
    lab.querySelectorAll('.boat').forEach(b => b.addEventListener('click', () => { kinds[+b.dataset.i] = kinds[+b.dataset.i] === 2 ? 3 : 2; drawLab(); }));
  }
  drawLab();
  hints(root, 'p1', [
    'Imaginează-ți că toate cele 12 corăbii ar fi joncuri. Câte catarge ar fi atunci?',
    'Dacă toate ar fi joncuri: 12 × 2 = 24 de catarge. Dar marinarul a numărat 31. De unde vin catargele în plus? Când schimbi o joncă într-un cliper, câte catarge adaugi?',
    'Încearcă în laboratorul de mai jos: apasă pe corăbii ca să le schimbi din joncă în cliper, până ajungi la 31 de catarge.',
  ], () => lab.classList.remove('hidden'));

  // ---------------- problema 2: canalul îngust (rezervă, mai grea)
  const svg = root.querySelector('#p2board');
  const COLS = 3, ROWS = 6, cw = 80, ch = 62, ox = 100, oy = 20;
  let path = [0]; // coloana relativă: -1, 0, +1
  const turns = () => { let n = 0; for (let i = 2; i < path.length; i++) if (Math.sign(path[i] - path[i - 1]) !== Math.sign(path[i - 1] - path[i - 2])) n++; return n; };
  const fb2 = root.querySelector('#p2fb'), stat = root.querySelector('#p2stat');
  function draw() {
    const W = ox * 2 + COLS * cw, H = oy * 2 + ROWS * ch + 40;
    let s = `<rect width="${W}" height="${H}" fill="#3e6f8f"/>`;
    // stâncile pe margini
    for (let r = 0; r <= ROWS; r++) for (const sd of [-1, 1]) {
      const x = sd < 0 ? ox - 40 : ox + COLS * cw + 40, y = oy + (ROWS - r) * ch + 20;
      s += `<ellipse cx="${x}" cy="${y}" rx="34" ry="24" fill="#5b6470"/><ellipse cx="${x - 6}" cy="${y - 6}" rx="16" ry="10" fill="#7b8490"/>`;
    }
    // grila
    for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = ox + c * cw, y = oy + (ROWS - r) * ch;
      s += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="rgba(255,255,255,.25)"/>`;
    }
    const cx = c => ox + (c + 1) * cw + cw / 2, cy = r => oy + (ROWS - r) * ch + ch / 2;
    // portul și startul
    s += `<rect x="${ox + cw + 6}" y="${oy + 4}" width="${cw - 12}" height="${ch - 8}" rx="8" fill="#16a34a" opacity=".85"/><text x="${cx(0)}" y="${cy(ROWS) + 6}" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">⚓ PORT</text>`;
    s += `<text x="${cx(0)}" y="${cy(0) + 38}" text-anchor="middle" fill="#fff" font-size="13">START</text>`;
    // vântul
    s += `<g transform="translate(${ox + COLS * cw + 70},${oy + 10})"><text x="0" y="0" fill="#bfdbfe" font-size="13" text-anchor="middle">vântul</text><path d="M-8 8H8V30H16L0 48L-16 30H-8Z" fill="#93c5fd"/></g>`;
    // drumul
    s += `<polyline points="${path.map((c, r) => `${cx(c)},${cy(r)}`).join(' ')}" fill="none" stroke="#fde68a" stroke-width="4" stroke-dasharray="6 5"/>`;
    path.forEach((c, r) => { s += `<circle cx="${cx(c)}" cy="${cy(r)}" r="5" fill="#fde68a"/>`; });
    const r = path.length - 1, c = path[r];
    const hd = r === 0 ? 0 : (path[r] > path[r - 1] ? 45 : -45);
    s += `<g transform="translate(${cx(c)},${cy(r)}) rotate(${hd})"><path d="M0 -20C8 -10 9 6 6 16H-6C-9 6 -8 -10 0 -20Z" fill="#1f1a17"/><rect x="-11" y="-6" width="22" height="3" fill="#f3ead6"/><rect x="-11" y="4" width="22" height="3" fill="#f3ead6"/></g>`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = s;
    const atEnd = path.length - 1 === ROWS;
    stat.innerHTML = `Rânduri urcate: <b>${path.length - 1}</b> din ${ROWS} · Virări (schimbări de direcție): <b>${turns()}</b>` + (atEnd ? (path[ROWS] === 0 ? ' · 🎉 Ai ajuns în port!' : ' · ✖ Portul e în coloana din mijloc') : '');
  }
  function step(d) {
    if (path.length - 1 >= ROWS) return;
    const nc = path[path.length - 1] + d;
    if (Math.abs(nc) > 1) { fb2.className = 'say warn'; fb2.innerHTML = '💥 Acolo sunt stânci! Canalul are doar 3 coloane: corabia trebuie să vireze.'; return; }
    fb2.className = 'say'; fb2.innerHTML = '';
    path.push(nc); draw();
  }
  root.querySelector('#p2L').addEventListener('click', () => step(-1));
  root.querySelector('#p2R').addEventListener('click', () => step(1));
  root.querySelector('#p2U').addEventListener('click', () => { if (path.length > 1) path.pop(); draw(); });
  root.querySelector('#p2X').addEventListener('click', () => { path = [0]; draw(); });
  draw();
  const fb2b = root.querySelector('#p2fb2');
  mcq(root.querySelector('#p2opts'), ['1', '2', '3', '4', '5'], 2, () => {
    fb2b.innerHTML = '✅ <b>Corect: 3 virări.</b>';
    root.querySelector('#p2sol').classList.remove('hidden');
  }, fb2b, 'Nu chiar. Desenează drumul pe tablă și numără virările. Poți găsi un drum cu mai puține?');
  hints(root, 'p2', [
    'Pornești din coloana din mijloc. Poți merge 2 pași la rând în aceeași direcție chiar de la început?',
    'Din mijloc, primul pas te duce lângă stânci, deci imediat trebuie să virezi. După aceea poți merge cel mult 2 pași la rând (de la o margine la cealaltă).',
    'Numără: primul bord are 1 pas, apoi bordurile au cel mult 2 pași. Câte borduri îți trebuie ca să faci 6 pași? Virările sunt cu una mai puține decât bordurile.',
  ]);
}

function hints(root, id, list, onLast) {
  const btn = root.querySelector(`#${id}hint`), box = root.querySelector(`#${id}hints`);
  let k = 0;
  btn.addEventListener('click', () => {
    if (k >= list.length) return;
    const li = document.createElement('li'); li.innerHTML = list[k]; box.appendChild(li); k++;
    if (k === list.length) { btn.disabled = true; if (onLast) onLast(); }
    else btn.textContent = `💡 Încă un ajutor (${k + 1}/${list.length})`;
  });
}

function boatIcon(n) {
  const xs = n === 3 ? [14, 26, 38] : [18, 34];
  const hull = n === 3 ? '<path d="M2 30H52L46 38H8Z" fill="#1c1c1c"/>' : '<path d="M4 28H50L46 38H10Z" fill="#8e1f1a"/><path d="M4 28H14V22H4Z" fill="#8e1f1a"/>';
  return `<svg viewBox="0 0 54 40" width="54" height="40">${xs.map(x => `<line x1="${x}" y1="30" x2="${x}" y2="4" stroke="#5a4026" stroke-width="2.5"/><rect x="${x - 7}" y="8" width="14" height="${n === 3 ? 6 : 14}" fill="${n === 3 ? '#f1e9d6' : '#a0522d'}" opacity=".9"/>`).join('')}${hull}</svg>`;
}
