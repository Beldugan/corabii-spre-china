// Stelele câștigate (păstrate în browser, dacă se poate).
const KEY = 'corabii-spre-china-v1';
let mem = {};
try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { mem = {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* fără stocare */ } }

export function getStars(id) { return (mem.stars && mem.stars[id]) || 0; }
export function addStars(id, n) {
  mem.stars = mem.stars || {};
  if (n > (mem.stars[id] || 0)) { mem.stars[id] = n; save(); }
  refresh();
}
export function total() { return Object.values(mem.stars || {}).reduce((a, b) => a + b, 0); }
export function getFlag(k) { return mem[k]; }
export function setFlag(k, v) { mem[k] = v; save(); }
export function refresh() { const el = document.getElementById('starTotal'); if (el) el.textContent = total(); }
export function resetAll() { mem = {}; save(); refresh(); }
