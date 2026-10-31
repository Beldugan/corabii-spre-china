// Pornirea aplicației: taburi, temă, inițializarea secțiunilor la prima deschidere.
import { ShipViewer } from './ships3d.js';
import { SHIP_INFO, PARTS } from './shipdata.js';
import { initManeuver } from './maneuver.js';
import { initWinds } from './map.js';
import { initVoyage } from './voyage.js';
import { initHistory } from './history.js';
import { initGame } from './game.js';
import { initProblem } from './problem.js';
import { refresh } from './progress.js';

const $ = s => document.querySelector(s);
const inited = {};
const viewers = {};

// imagini fixe ale corăbiilor, randate o singură dată
let thumbViewer = null; const thumbCache = {};
function getThumb(id) {
  if (thumbCache[id]) return thumbCache[id];
  thumbCache[id] = new Promise(res => {
    setTimeout(() => {
      try {
        if (!thumbViewer) {
          const host = document.createElement('div');
          Object.assign(host.style, { position: 'fixed', left: '-2000px', top: '0', width: '480px', height: '300px' });
          document.body.appendChild(host);
          thumbViewer = new ShipViewer(host, { thumbs: true });
        }
        res(thumbViewer.snapshot(id, 480, 300));
      } catch (e) { res(null); }
    }, 50);
  });
  return thumbCache[id];
}

function partHTML(key) { const p = PARTS[key]; return p ? `<b>${p.ro}</b><br>${p.d}` : ''; }

const INIT = {
  man(root) {
    initManeuver(root);
    const v = viewers.parts = new ShipViewer($('#v3dParts'), { onPart: k => { $('#partInfo1').innerHTML = partHTML(k); } });
    v.setShip('hindostan'); v.setLabels(true); v.start();
    $('#partsUnder').addEventListener('change', e => v.setUnderwater(e.target.checked));
    $('#partsShip').addEventListener('change', e => { v.setShip(e.target.value); v.setLabels(true); });
  },
  ships(root) {
    const v = viewers.ships = new ShipViewer($('#v3d'), { onPart: k => { $('#partInfo2').innerHTML = partHTML(k); $('#partInfo2').classList.remove('hidden'); } });
    const show = id => {
      root.querySelectorAll('[data-ship]').forEach(b => b.setAttribute('aria-pressed', b.dataset.ship === id));
      if (id === 'compare') { v.setCompare(); $('#shipInfo').innerHTML = '<h3>Toate patru, una lângă alta</h3><p>Așa poți compara mărimile. Pe chei sunt un autobuz londonez cu etaj (11 m lungime) și Eva (1,30 m). Cutty Sark este cea mai lungă, dar carraca „Madre de Deus” era cea mai înaltă și mai grea.</p>'; return; }
      v.setShip(id); v.setLabels($('#tLabels').checked);
      const I = SHIP_INFO[id];
      $('#shipInfo').innerHTML = `<h3>${I.name} <small>· ${I.type} · ${I.year}</small></h3>
        <table class="data">${I.facts.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('')}</table>
        <p>${I.story}</p><p class="say"><b>Ce o face specială:</b> ${I.special}</p>`;
      $('#partInfo2').classList.add('hidden');
    };
    root.querySelectorAll('[data-ship]').forEach(b => b.addEventListener('click', () => show(b.dataset.ship)));
    $('#tSails').addEventListener('change', e => v.setSails(e.target.checked));
    $('#tLabels').addEventListener('change', e => v.setLabels(e.target.checked));
    $('#tUnder').addEventListener('change', e => v.setUnderwater(e.target.checked));
    $('#tAuto').addEventListener('change', e => v.setAuto(e.target.checked));
    root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => v.view(b.dataset.view)));
    $('#tFull').addEventListener('click', () => v.toggleFull());
    show('cutty'); v.start();
    root.querySelectorAll('[data-ship] img').forEach(img => getThumb(img.dataset.id).then(u => { if (u) img.src = u; }));
  },
  wind(root) { initWinds(root); },
  hist(root) { initHistory(root, getThumb); },
  voy(root) { initVoyage(root, getThumb); },
  game(root) { initGame(root); },
  prob(root) { initProblem(root); },
};

function openTab(key) {
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === key));
  document.querySelectorAll('section.page').forEach(s => s.classList.toggle('hidden', s.id !== 'p-' + key));
  for (const k in viewers) { if ((k === 'parts' && key === 'man') || (k === 'ships' && key === 'ships')) { viewers[k].resize(); viewers[k].start(); } else viewers[k].stop(); }
  const root = $('#p-' + key);
  if (!inited[key]) { inited[key] = true; try { INIT[key](root); } catch (e) { console.error(e); root.insertAdjacentHTML('afterbegin', `<p class="say warn">Această secțiune nu a putut porni pe acest dispozitiv (${e.message}).</p>`); } }
  try { history.replaceState(null, '', '#' + key); } catch (e) { /* */ }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));

// tema deschisă / întunecată
$('#themeBtn').addEventListener('click', () => {
  const r = document.documentElement; const cur = r.getAttribute('data-theme');
  const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark ? 'light' : 'dark');
});
refresh();
const start = (location.hash || '#man').slice(1);
openTab(INIT[start] ? start : 'man');
