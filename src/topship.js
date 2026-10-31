// Desenul unei corăbii cu trei catarge văzută de sus (folosit în manevre, joc și hartă).
import { D2R, angDiff } from './sailing.js';

export function braceSide(heading, windFrom) { return angDiff(heading, windFrom) >= 0 ? 1 : -1; }

export function drawShipTop(ctx, x, y, heading, len, o = {}) {
  const brace = o.brace ?? 0, side = o.side ?? 1, fill = o.fill ?? 1, t = o.t ?? 0;
  const beam = len * 0.24;
  const hullCol = o.hull || '#1d1a17', deckCol = o.deck || '#b38b5d', sailCol = o.sail || '#f3ead6';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading * D2R);
  // umbra pe apă
  if (o.shadow !== false) {
    ctx.save();
    ctx.translate(len * 0.06, len * 0.08);
    ctx.fillStyle = 'rgba(0,20,40,.28)';
    hullPath(ctx, len, beam * 1.05); ctx.fill();
    ctx.restore();
  }
  // corpul
  ctx.fillStyle = hullCol; hullPath(ctx, len, beam); ctx.fill();
  // puntea
  ctx.fillStyle = deckCol; hullPath(ctx, len * 0.9, beam * 0.78); ctx.fill();
  // scândurile punții
  ctx.save(); hullPath(ctx, len * 0.9, beam * 0.78); ctx.clip();
  ctx.strokeStyle = 'rgba(60,35,15,.35)'; ctx.lineWidth = Math.max(0.5, len / 160);
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * beam * 0.11, -len / 2); ctx.lineTo(i * beam * 0.11, len / 2); ctx.stroke(); }
  ctx.restore();
  // dunetă (puntea de la pupa) și castelul din față
  ctx.fillStyle = 'rgba(120,80,45,.9)';
  ctx.fillRect(-beam * 0.36, len * 0.3, beam * 0.72, len * 0.14);
  // bompresul
  ctx.strokeStyle = '#5b4026'; ctx.lineWidth = Math.max(1.2, len / 45);
  ctx.beginPath(); ctx.moveTo(0, -len * 0.45); ctx.lineTo(0, -len * 0.72); ctx.stroke();
  // focul (pânza triunghiulară din față)
  ctx.fillStyle = shade(sailCol, 0.92);
  ctx.beginPath(); ctx.moveTo(0, -len * 0.7); ctx.lineTo(side * beam * 0.18 * fill, -len * 0.42); ctx.lineTo(0, -len * 0.32); ctx.closePath(); ctx.fill();
  // catargele cu vergi și pânze
  const masts = [{ p: -0.24, w: 0.95 }, { p: 0.0, w: 1.05 }, { p: 0.22, w: 0.8 }];
  masts.forEach((m, mi) => {
    const my = m.p * len, w = beam * 2.15 * m.w;
    const br = o.braces ? o.braces[mi] : brace, sd = o.sides ? o.sides[mi] : side;
    const backed = o.backed && o.backed[mi];
    ctx.save(); ctx.translate(0, my); ctx.rotate(-br * sd * D2R);
    const bulge = len * 0.11 * fill * (backed ? -0.7 : 1);
    const luff = o.luff ? Math.sin(t * 22 + m.p * 9) * len * 0.035 : 0;
    // pânza
    const g = ctx.createLinearGradient(0, -bulge, 0, len * 0.03);
    g.addColorStop(0, sailCol); g.addColorStop(1, shade(sailCol, 0.78));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(-w * 0.25, -bulge * 1.15 + luff, 0, -bulge - luff);
    ctx.quadraticCurveTo(w * 0.25, -bulge * 1.15 + luff, w / 2, 0);
    ctx.quadraticCurveTo(0, len * 0.025, -w / 2, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,40,.45)'; ctx.lineWidth = Math.max(0.5, len / 200); ctx.stroke();
    // verga
    ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = Math.max(1, len / 70);
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
    ctx.restore();
    // catargul (punct)
    ctx.fillStyle = '#3b2a1a'; ctx.beginPath(); ctx.arc(0, my, Math.max(1.2, len / 40), 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function hullPath(ctx, len, beam) {
  const L = len / 2, B = beam / 2;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.bezierCurveTo(B * 0.9, -L * 0.62, B * 1.02, -L * 0.15, B, L * 0.2);
  ctx.bezierCurveTo(B * 0.98, L * 0.6, B * 0.8, L * 0.92, B * 0.62, L);
  ctx.lineTo(-B * 0.62, L);
  ctx.bezierCurveTo(-B * 0.8, L * 0.92, -B * 0.98, L * 0.6, -B, L * 0.2);
  ctx.bezierCurveTo(-B * 1.02, -L * 0.15, -B * 0.9, -L * 0.62, 0, -L);
  ctx.closePath();
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

// dâra de spumă din urma corăbiei
export function drawWake(ctx, pts, width = 10) {
  if (pts.length < 2) return;
  for (let i = 1; i < pts.length; i++) {
    const a = i / pts.length;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
    ctx.lineWidth = width * (0.4 + (1 - a) * 1.6);
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
}

// O busolă cu săgeata vântului (folosită în manevre și joc)
export function drawCompass(ctx, cx, cy, r, heading, windFrom, o = {}) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(245,238,220,.92)'; ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a2a14'; ctx.font = `700 ${Math.round(r * 0.26)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lbl = ['N', 'E', 'S', 'V'];
  for (let i = 0; i < 4; i++) { const a = i * 90 * D2R; ctx.fillText(lbl[i], Math.sin(a) * r * 0.72, -Math.cos(a) * r * 0.72); }
  ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 1;
  for (let i = 0; i < 32; i++) {
    const a = i * 11.25 * D2R, l = i % 8 === 0 ? 0.0 : i % 4 === 0 ? 0.12 : 0.07;
    if (!l) continue;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * (0.95 - l), -Math.cos(a) * r * (0.95 - l)); ctx.lineTo(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95); ctx.stroke();
  }
  // vântul (săgeată albastră care intră în busolă dinspre direcția vântului)
  if (windFrom != null) {
    const a = windFrom * D2R;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath(); ctx.moveTo(-r * 0.05, -r * 1.3); ctx.lineTo(r * 0.05, -r * 1.3); ctx.lineTo(r * 0.05, -r * 0.78); ctx.lineTo(r * 0.15, -r * 0.78); ctx.lineTo(0, -r * 0.55); ctx.lineTo(-r * 0.15, -r * 0.78); ctx.lineTo(-r * 0.05, -r * 0.78); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // acul = direcția corăbiei
  ctx.save(); ctx.rotate(heading * D2R);
  ctx.fillStyle = '#b91c1c';
  ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.lineTo(r * 0.09, 0); ctx.lineTo(-r * 0.09, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.beginPath(); ctx.moveTo(0, r * 0.45); ctx.lineTo(r * 0.07, 0); ctx.lineTo(-r * 0.07, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c08a2b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2); ctx.fill();
  if (o.target != null) { // un semn pe marginea busolei spre ținta următoare
    const a = o.target * D2R;
    ctx.fillStyle = '#16a34a';
    ctx.beginPath(); ctx.arc(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95, r * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// valuri desenate pe apă (vedere de sus), cu deplasare după cameră
export function drawSea(ctx, W, H, camX, camY, t, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top || '#1f5f86'); g.addColorStop(1, o.bot || '#174d70');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const cell = 90;
  const x0 = Math.floor(camX / cell) - 1, y0 = Math.floor(camY / cell) - 1;
  const nx = Math.ceil(W / cell) + 2, ny = Math.ceil(H / cell) + 2;
  ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const gx = x0 + i, gy = y0 + j;
    const h = hash(gx, gy);
    const px = gx * cell + h * cell - camX, py = gy * cell + hash(gy, gx) * cell - camY;
    const ph = t * 1.4 + h * 10;
    const s = 0.5 + 0.5 * Math.sin(ph);
    ctx.strokeStyle = `rgba(200,230,250,${0.08 + 0.18 * s})`;
    const w = 10 + 14 * h;
    ctx.beginPath(); ctx.moveTo(px - w, py); ctx.quadraticCurveTo(px, py - 4 - 3 * s, px + w, py); ctx.stroke();
  }
}
function hash(a, b) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }
