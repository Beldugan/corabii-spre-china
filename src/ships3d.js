// Modelele 3D ale corăbiilor reale + vizualizatorul (Three.js).
// Unități: metri. x = spre prova, y = în sus, z = spre tribord. Nivelul apei: y = 0.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PARTS, SHIP_INFO } from './shipdata.js';

// planul de tăiere (secțiunea prin corabie), comun tuturor materialelor corăbiilor
export const CLIP_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);
const CLIP = [CLIP_PLANE];
export const INTERIOR_KEYS = new Set(['cala', 'ceai', 'portelan', 'mirodenii', 'hamace', 'bucatarie', 'cabina', 'pompe', 'coaste', 'carlinga', 'balast', 'pereti', 'puntea', 'tun', 'butoaie']);

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- texturi
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.anisotropy = 4;
  return t;
}
function noise(g, w, h, a = 0.05) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 255 * a; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
}
const TEX = {};
function sailTex(kind) {
  if (TEX['sail' + kind]) return TEX['sail' + kind];
  const t = canvasTex(256, 256, (g, w, h) => {
    const base = kind === 'junk' ? '#8c4f2c' : kind === 'old' ? '#e6d9bb' : '#f1e9d6';
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    noise(g, w, h, kind === 'junk' ? 0.12 : 0.05);
    if (kind === 'junk') {
      g.strokeStyle = 'rgba(40,20,10,.55)'; g.lineWidth = 1;
      for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 3, h); g.stroke(); } // rogojina
      g.strokeStyle = '#3a2412'; g.lineWidth = 5;
      for (let i = 1; i < 10; i++) { const y = i * h / 10; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } // șipcile
    } else {
      g.strokeStyle = 'rgba(120,100,70,.28)'; g.lineWidth = 1.2;
      for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } // cusăturile fâșiilor de pânză
      g.strokeStyle = 'rgba(110,90,60,.45)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); // tivul
      g.strokeStyle = 'rgba(110,90,60,.25)'; g.lineWidth = 2;
      for (const y of [h * 0.18, h * 0.3]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } // benzile de terțarolă
      if (kind === 'cross') {
        // crucea Ordinului lui Hristos (Portugalia)
        g.fillStyle = '#b3201c';
        const cx = w / 2, cy = h * 0.52, s = w * 0.3;
        g.beginPath();
        for (let k = 0; k < 4; k++) {
          g.save(); g.translate(cx, cy); g.rotate(k * PI / 2);
          g.moveTo(-s * 0.18, 0); g.lineTo(-s * 0.42, -s); g.lineTo(s * 0.42, -s); g.lineTo(s * 0.18, 0);
          g.restore();
        }
        g.fill();
        g.fillStyle = '#f4ecd8';
        g.fillRect(cx - s * 0.07, cy - s * 0.8, s * 0.14, s * 1.6); g.fillRect(cx - s * 0.8, cy - s * 0.07, s * 1.6, s * 0.14);
      }
    }
  });
  TEX['sail' + kind] = t; return t;
}
function plankTex() { // scândurile corpului (se înmulțesc cu culoarea vopselei)
  if (TEX.plank) return TEX.plank;
  TEX.plank = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    const n = 8, ph = h / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.07})`; g.fillRect(0, i * ph, w, ph);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, i * ph, w, 1.5);
      let x = Math.random() * 120;
      while (x < w) { g.fillRect(x, i * ph, 1.5, ph); x += 110 + Math.random() * 90; }
    }
    noise(g, w, h, 0.07);
  }, { repeat: [1, 1] });
  TEX.plank.wrapS = TEX.plank.wrapT = THREE.RepeatWrapping;
  return TEX.plank;
}
function deckTex() {
  if (TEX.deck) return TEX.deck;
  TEX.deck = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b48a5c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = `hsl(30, 38%, ${44 + Math.random() * 10}%)`; g.fillRect(0, y, w, 15);
      g.fillStyle = 'rgba(40,25,10,.7)'; g.fillRect(0, y + 15, w, 1);
      const off = Math.random() * w; g.fillRect(off, y, 1, 15);
    }
    noise(g, w, h, 0.06);
  }, { repeat: [8, 2] });
  return TEX.deck;
}
function woodTex(col = '#6e4b2a') {
  const k = 'wood' + col; if (TEX[k]) return TEX[k];
  TEX[k] = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    noise(g, w, h, 0.08);
  }, { repeat: [4, 2] });
  return TEX[k];
}
function sternTex(kind) {
  const k = 'stern' + kind; if (TEX[k]) return TEX[k];
  TEX[k] = canvasTex(512, 512, (g, w, h) => {
    if (kind === 'indiaman') {
      g.fillStyle = '#1b2333'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9a24a'; g.fillRect(0, h * 0.08, w, h * 0.03); g.fillRect(0, h * 0.45, w, h * 0.03);
      for (let r = 0; r < 2; r++) {
        const y0 = h * (0.14 + r * 0.36);
        for (let i = 0; i < 7; i++) {
          const x = w * (0.12 + i * 0.11);
          g.fillStyle = '#c9a24a'; g.fillRect(x - 4, y0 - 4, w * 0.075 + 8, h * 0.2 + 8);
          const gr = g.createLinearGradient(0, y0, 0, y0 + h * 0.2);
          gr.addColorStop(0, '#9fc2d8'); gr.addColorStop(1, '#2d4a62');
          g.fillStyle = gr; g.fillRect(x, y0, w * 0.075, h * 0.2);
          g.strokeStyle = '#c9a24a'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x + w * 0.0375, y0); g.lineTo(x + w * 0.0375, y0 + h * 0.2); g.moveTo(x, y0 + h * 0.1); g.lineTo(x + w * 0.075, y0 + h * 0.1); g.stroke();
        }
      }
      g.fillStyle = '#c9a24a'; g.font = 'bold 40px Georgia'; g.textAlign = 'center'; g.fillText('HINDOSTAN', w / 2, h * 0.82);
    } else if (kind === 'cutty') {
      g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d6ad48'; g.font = 'bold 54px Georgia'; g.textAlign = 'center';
      g.fillText('CUTTY SARK', w / 2, h * 0.36); g.font = 'bold 40px Georgia'; g.fillText('LONDON', w / 2, h * 0.5);
      g.strokeStyle = '#d6ad48'; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.1, h * 0.12); g.quadraticCurveTo(w / 2, h * 0.2, w * 0.9, h * 0.12); g.stroke();
    } else if (kind === 'carrack') {
      g.fillStyle = '#5d3d22'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.1);
      g.strokeStyle = 'rgba(0,0,0,.4)'; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = '#e3d6b5'; g.fillRect(w * 0.38, h * 0.12, w * 0.24, h * 0.2);
      g.fillStyle = '#b3201c'; g.fillRect(w * 0.47, h * 0.13, w * 0.06, h * 0.18); g.fillRect(w * 0.4, h * 0.19, w * 0.2, h * 0.05);
      for (let i = 0; i < 4; i++) { g.fillStyle = '#1d1a12'; g.fillRect(w * (0.15 + i * 0.2), h * 0.42, w * 0.08, h * 0.08); }
    } else if (kind === 'junk') {
      g.fillStyle = '#8e1f1a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(w / 2, h * 0.35, w * 0.17, 0, 2 * PI); g.fill();
      g.fillStyle = '#8e1f1a'; g.beginPath(); g.arc(w / 2, h * 0.35, w * 0.12, 0, 2 * PI); g.fill();
      g.fillStyle = '#2f6b45'; g.fillRect(0, h * 0.62, w, h * 0.06); g.fillStyle = '#f2ead3'; g.fillRect(0, h * 0.7, w, h * 0.03);
      g.fillStyle = '#111'; g.fillRect(0, h * 0.75, w, h * 0.25);
    }
  });
  return TEX[k];
}
function flagTex(kind) {
  const k = 'flag' + kind; if (TEX[k]) return TEX[k];
  TEX[k] = canvasTex(256, 160, (g, w, h) => {
    if (kind === 'eic') { // steagul Companiei Indiilor de Est înainte de 1801
      for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#c8102e'; g.fillRect(0, i * h / 13, w, h / 13 + 1); }
      unionOld(g, 0, 0, w * 0.42, h * 7 / 13);
    } else if (kind === 'red') { // Red Ensign (marina comercială)
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h); unionJack(g, 0, 0, w / 2, h / 2);
    } else if (kind === 'christ') {
      g.fillStyle = '#f3ecd8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b3201c'; g.fillRect(w * 0.42, h * 0.1, w * 0.16, h * 0.8); g.fillRect(w * 0.2, h * 0.38, w * 0.6, h * 0.24);
    } else if (kind === 'junk') {
      g.fillStyle = '#c8241c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4c542'; g.fillRect(0, 0, w, h * 0.22); g.fillRect(0, h * 0.78, w, h * 0.22);
    } else if (kind === 'pennantR') { g.fillStyle = '#c8102e'; g.fillRect(0, 0, w, h); }
  });
  return TEX[k];
}
function unionOld(g, x, y, w, h) { // steagul Uniunii 1606–1801 (Anglia + Scoția)
  g.fillStyle = '#012169'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = h * 0.2;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(x + w * 0.4, y, w * 0.2, h); g.fillRect(x, y + h * 0.33, w, h * 0.34);
  g.fillStyle = '#c8102e'; g.fillRect(x + w * 0.45, y, w * 0.1, h); g.fillRect(x, y + h * 0.4, w, h * 0.2);
}
function unionJack(g, x, y, w, h) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#012169'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = h * 0.2;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
  g.strokeStyle = '#c8102e'; g.lineWidth = h * 0.07;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + h); g.moveTo(x + w, y); g.lineTo(x, y + h); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(x + w * 0.42, y, w * 0.16, h); g.fillRect(x, y + h * 0.33, w, h * 0.34);
  g.fillStyle = '#c8102e'; g.fillRect(x + w * 0.455, y, w * 0.09, h); g.fillRect(x, y + h * 0.4, w, h * 0.2);
  g.restore();
}

// ---------------------------------------------------------------- materiale
const MAT = {};
function mat(key, make) { return MAT[key] || (MAT[key] = make()); }
const M = {
  wood: () => mat('wood', () => new THREE.MeshStandardMaterial({ color: 0x7a5432, roughness: 0.85, map: woodTex('#7a5432') })),
  darkWood: () => mat('dwood', () => new THREE.MeshStandardMaterial({ color: 0x3a2716, roughness: 0.85 })),
  mast: (c = 0xa57a48) => mat('mast' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  black: () => mat('black', () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 })),
  rope: () => mat('rope', () => new THREE.LineBasicMaterial({ color: 0x2b2118, transparent: true, opacity: 0.85 })),
  sail: (kind) => mat('sail' + kind, () => new THREE.MeshStandardMaterial({ map: sailTex(kind), side: THREE.DoubleSide, roughness: 0.95 })),
  furled: () => mat('furl', () => new THREE.MeshStandardMaterial({ color: 0xe0d5bb, roughness: 1 })),
  deck: () => mat('deck', () => new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.9, side: THREE.DoubleSide })),
  deckIn: () => mat('deckIn', () => new THREE.MeshStandardMaterial({ map: deckTex(), color: 0xc9b496, roughness: 0.95, side: THREE.DoubleSide })),
  inWood: () => mat('inWood', () => new THREE.MeshStandardMaterial({ color: 0x6a4a2c, map: woodTex('#8a6440'), roughness: 0.9, side: THREE.DoubleSide })),
  copper: () => mat('copper', () => new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.8 })),
  iron: () => mat('iron', () => new THREE.MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.5, metalness: 0.6 })),
  brass: () => mat('brass', () => new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.3, metalness: 0.85 })),
  glass: () => mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.05, metalness: 0.2, emissive: 0x1a2a33 })),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.6 })),
  white: () => mat('white', () => new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.7 })),
  red: () => mat('red', () => new THREE.MeshStandardMaterial({ color: 0x8e1f1a, roughness: 0.7 })),
};

// ---------------------------------------------------------------- corpul
function makeHull(H) {
  const { L, B, F, draft } = H;
  const tm = H.tm ?? 0.52;
  const halfDeck = t => t < tm
    ? B / 2 * (H.trS + (1 - H.trS) * (1 - Math.pow((tm - t) / tm, H.pa)))
    : B / 2 * ((H.trB || 0) + (1 - (H.trB || 0)) * (1 - Math.pow((t - tm) / (1 - tm), H.pf)));
  const halfLow = t => t < tm
    ? B / 2 * (1 - Math.pow((tm - t) / tm, H.paLow)) * 0.97
    : B / 2 * (1 - Math.pow((t - tm) / (1 - tm), H.pfLow)) * 0.97;
  const deckH = t => F + (t < 0.5 ? H.sheerS * Math.pow((0.5 - t) / 0.5, 2.2) : H.sheerB * Math.pow((t - 0.5) / 0.5, 2));
  const stemS = H.stemStart ?? 0.86;
  const keelY = t => {
    let y = -draft;
    if (t > stemS) { const s = (t - stemS) / (1 - stemS); y = -draft + (deckH(1) * (H.stemTop ?? 0.9) + draft) * Math.pow(s, H.stemPow ?? 2.2); }
    if (H.sternRise && t < 0.12) y = lerp(-draft * (1 - H.sternRise), -draft, t / 0.12);
    return y;
  };
  const g = v => {
    let r = Math.pow(Math.max(0, 1 - Math.pow(v, H.k)), 0.5);
    if (H.tumble) r *= 1 - H.tumble * Math.pow(Math.max(0, 1 - v / 0.45), 2);
    return r;
  };
  const halfAt = (t, v) => lerp(halfDeck(t), halfLow(t), smooth(0.12, 0.75, v)) * g(v);
  const zAt = (t, y) => { // jumătatea lățimii corpului la o anumită înălțime
    const d = deckH(t), k = keelY(t);
    const v = clamp((d - y) / Math.max(0.01, d - k), 0, 1);
    return halfAt(t, v);
  };
  const NU = 72, NV = 26;
  const pos = [], col = [], idx = [], uvs = [];
  const c = new THREE.Color();
  for (let i = 0; i <= NU; i++) {
    const t = i / NU, x = (t - 0.5) * L, d = deckH(t), k = keelY(t);
    for (let j = 0; j <= 2 * NV; j++) {
      const side = j < NV ? -1 : 1;
      const v = j <= NV ? j / NV : (2 * NV - j) / NV;
      const y = d + (k - d) * v;
      const z = side * halfAt(t, v);
      pos.push(x, y, z); uvs.push(x / 10, y / 2.6);
      c.set(H.color(t, y, d - y, side));
      col.push(c.r, c.g, c.b);
    }
  }
  const row = 2 * NV + 1;
  for (let i = 0; i < NU; i++) for (let j = 0; j < 2 * NV; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const hull = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: plankTex(), roughness: 0.62, side: THREE.FrontSide }));
  hull.castShadow = true; hull.receiveShadow = true;
  // pereții de lemn văzuți din interior (bordajul interior)
  const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: H.inside || 0x7a5434, map: plankTex(), roughness: 0.85, side: THREE.BackSide }));
  inner.receiveShadow = true;
  // „masca” liniei de plutire: ascunde apa din interiorul corpului (altfel corabia pare plină cu apă)
  const wl = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; wl.push(new THREE.Vector2((t - 0.5) * L, -(zAt(t, 0.05) + 0.02))); }
  for (let i = 60; i >= 0; i--) { const t = i / 60; wl.push(new THREE.Vector2((t - 0.5) * L, zAt(t, 0.05) + 0.02)); }
  const mask = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(wl)), new THREE.MeshBasicMaterial({ colorWrite: false }));
  mask.rotation.x = -PI / 2; mask.position.y = 0.7; mask.renderOrder = 999; mask.userData.noClip = true;

  // fața de la pupa (oglinda) și, la joncă, fața de la prova
  function endFace(t, tex) {
    const pts = [];
    for (let j = 0; j <= 2 * NV; j++) {
      const side = j < NV ? -1 : 1, v = j <= NV ? j / NV : (2 * NV - j) / NV;
      const d = deckH(t), k = keelY(t);
      pts.push(new THREE.Vector2(side * halfAt(t, v), d + (k - d) * v));
    }
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    let zmin = 1e9, zmax = -1e9, ymin = 1e9, ymax = -1e9;
    pts.forEach(p => { zmin = Math.min(zmin, p.x); zmax = Math.max(zmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); });
    const x = (t - 0.5) * L;
    const P = [], UV = [];
    pts.forEach(p => { P.push(x, p.y, p.x); UV.push((p.x - zmin) / (zmax - zmin), (p.y - Math.max(ymin, 0)) / (ymax - Math.max(ymin, 0))); });
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    gg.setIndex(tris.flat()); gg.computeVertexNormals();
    const m = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.6 }));
    m.castShadow = true;
    return m;
  }
  const group = new THREE.Group();
  group.add(hull); group.add(inner); group.add(mask);
  if (H.sternTex) group.add(endFace(0, sternTex(H.sternTex)));
  if (H.trB) group.add(endFace(1, sternTex('junk')));

  // puntea
  const bw = H.bulwark ?? 1.0;
  const dp = [], duv = [], di = [];
  for (let i = 0; i <= NU; i++) {
    const t = i / NU, x = (t - 0.5) * L, y = deckH(t) - bw, z = zAt(t, y) * 0.98;
    dp.push(x, y, -z, x, y, z); duv.push(t * 8, 0, t * 8, 1);
    if (i < NU) { const a = i * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  dg.setAttribute('uv', new THREE.Float32BufferAttribute(duv, 2));
  dg.setIndex(di); dg.computeVertexNormals();
  const deck = new THREE.Mesh(dg, M.deck()); deck.receiveShadow = true;
  group.add(deck);
  // copastia (marginea de sus a parapetului)
  const railPts = [];
  for (let s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= NU; i++) { const t = i / NU; pts.push(new THREE.Vector3((t - 0.5) * L, deckH(t) + 0.05, s * zAt(t, deckH(t)))); }
    railPts.push(pts);
    const curve = new THREE.CatmullRomCurve3(pts);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, NU, 0.12, 5, false), H.railMat || M.darkWood());
    group.add(rail);
  }
  // chila
  const keel = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.5, 0.45), M.darkWood());
  keel.position.set(-L * 0.03, -draft - 0.2, 0); group.add(keel);

  return { group, halfDeck, deckH, keelY, zAt, bw, L, B };
}

// ---------------------------------------------------------------- pânze
// petic de pânză cu burtă, din 4 colțuri (A, B, C, D) – pentru triunghi D = C
function sailPatch(A, B, C, D, belly, material, n = 8) {
  const pos = [], uv = [], idx = [];
  const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A)).normalize();
  if (belly.dir) nrm.copy(belly.dir);
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / n;
    const p = new THREE.Vector3()
      .addScaledVector(A, (1 - u) * (1 - v)).addScaledVector(D, u * (1 - v))
      .addScaledVector(B, (1 - u) * v).addScaledVector(C, u * v);
    p.addScaledVector(nrm, belly.amt * Math.sin(PI * u) * Math.sin(PI * clamp(v * 0.9 + 0.1, 0, 1)));
    pos.push(p.x, p.y, p.z); uv.push(u, v);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = true;
  return m;
}
function squareSail(wTop, wBot, h, belly, material) {
  const g = new THREE.PlaneGeometry(1, 1, 10, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = 0.5 - p.getY(i);
    const w = lerp(wTop, wBot, v);
    const roach = v > 0.98 ? (1 - Math.pow(2 * u, 2)) * h * 0.05 : 0;
    p.setXYZ(i, belly * h * 0.13 * Math.sin(PI * (v * 0.9 + 0.08)) * (1 - 0.55 * Math.pow(2 * u, 2)), -v * h + roach, u * w);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material); m.castShadow = true;
  return m;
}
function cyl(r1, r2, len, material, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, seg), material);
  m.castShadow = true; return m;
}

// ---------------------------------------------------------------- construcția unei corăbii
export function buildShip(id) {
  const S = SPECS[id];
  const ship = new THREE.Group(); ship.name = id;
  const hullO = makeHull(S.hull);
  ship.add(hullO.group);
  const { deckH, zAt, halfDeck, L, bw } = hullO;
  const tx = t => (t - 0.5) * L;
  const anchors = {};
  const sails = [], furled = [], flags = [], lines = [];
  const seg = (a, b) => { lines.push(a.x, a.y, a.z, b.x, b.y, b.z); };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // suprastructuri (castele, dunete, cabine)
  for (const b of (S.blocks || [])) {
    const pts = [];
    const N = 14, yb = b.y0 != null ? b.y0 : deckH((b.t0 + b.t1) / 2) - bw;
    for (let i = 0; i <= N; i++) { const t = lerp(b.t0, Math.min(1, b.t1), i / N); pts.push([tx(t), zAt(t, yb + 0.2) * (b.inset ?? 0.98)]); }
    if (b.over) pts.push([tx(1) + b.over, 0]);
    const shape = new THREE.Shape();
    pts.forEach((p, i) => i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1]));
    for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], pts[i][1]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h, bevelEnabled: false });
    const m = new THREE.Mesh(geo, b.mat ? b.mat() : M.wood());
    m.rotation.x = -PI / 2; m.position.y = yb + (b.lift || 0);
    m.castShadow = true; m.receiveShadow = true;
    ship.add(m);
    // balustrada de sus
    const top = yb + (b.lift || 0) + b.h;
    const rail = pts.map(p => V(p[0], top + 0.6, p[1])).concat(pts.slice().reverse().map(p => V(p[0], top + 0.6, -p[1])));
    rail.push(rail[0].clone());
    const rc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 60, 0.08, 4, true), M.darkWood());
    ship.add(rc);
    for (let i = 0; i < rail.length - 1; i += 2) seg(rail[i], V(rail[i].x, top, rail[i].z));
    if (b.anchor) anchors[b.anchor] = V(tx((b.t0 + b.t1) / 2), top - b.h / 2, zAt((b.t0 + b.t1) / 2, top - 0.5));
    if (b.cabin) { // ferestre / uși pe pereții cabinelor
      for (let s of [-1, 1]) for (let i = 1; i < 4; i++) {
        const t = lerp(b.t0, b.t1, i / 4);
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), M.gold());
        w.position.set(tx(t), yb + b.h * 0.55, s * zAt(t, yb + 0.2) * (b.inset ?? 0.98) + s * 0.05);
        ship.add(w);
      }
    }
  }
  // case pe punte (cliper)
  for (const h of (S.houses || [])) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L * (h.t1 - h.t0), h.h, h.w), h.mat ? h.mat() : M.wood());
    m.position.set(tx((h.t0 + h.t1) / 2), deckH((h.t0 + h.t1) / 2) - bw + h.h / 2, 0); m.castShadow = true; m.receiveShadow = true;
    ship.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L * (h.t1 - h.t0) + 0.3, 0.15, h.w + 0.3), M.darkWood());
    roof.position.copy(m.position); roof.position.y += h.h / 2; ship.add(roof);
  }
  // bărci
  for (const b of (S.boats || [])) {
    const boat = new THREE.Group();
    const bg = new THREE.SphereGeometry(1, 16, 8, 0, 2 * PI, PI / 2, PI / 2);
    const bm = new THREE.Mesh(bg, M.white()); bm.scale.set(b.len / 2, 0.8, 1.1); bm.castShadow = true;
    boat.add(bm);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(1, 16), M.wood()); inside.rotation.x = -PI / 2; inside.scale.set(b.len / 2 * 0.95, 1.05, 1); boat.add(inside);
    boat.position.set(tx(b.t), deckH(b.t) - bw + (b.y || 1.6), b.z || 0);
    ship.add(boat);
    anchors.barci = boat.position.clone().add(V(0, 0.6, 0));
  }

  // catargele
  const mastTops = [], yardInfo = [];
  S.masts.forEach((mDef, mi) => {
    const mg = new THREE.Group();
    const mx = tx(mDef.t), baseY = deckH(mDef.t) - bw;
    mg.position.set(mx, baseY, 0);
    mg.rotation.z = (mDef.rake || 0) * PI / 180;
    ship.add(mg);
    const toShip = (y, z = 0, x = 0) => { const r = mg.rotation.z; return V(mx + x * Math.cos(r) - y * Math.sin(r), baseY + x * Math.sin(r) + y * Math.cos(r), z); };
    let y = 0; const heads = [];
    const R0 = mDef.r || 0.45;
    mDef.segs.forEach((len, si) => {
      const r1 = R0 * Math.pow(0.62, si), r2 = r1 * 0.72;
      const c = cyl(r1, r2, len, M.mast(S.mastColor));
      c.position.y = y + len / 2; mg.add(c);
      const top = y + len;
      heads.push(top);
      if (si < mDef.segs.length - 1) {
        // gabia / crucetele
        const rad = si === 0 ? (mDef.topR || 2.2) : (mDef.topR || 2.2) * 0.55;
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.85, si === 0 && S.roundTops ? 1.4 : 0.25, 18, 1, S.roundTops && si === 0), S.roundTops && si === 0 ? M.wood() : M.darkWood());
        plat.position.y = top - (si === 0 && S.roundTops ? 0.5 : 1.2); plat.position.x = -rad * (S.roundTops && si === 0 ? 0.25 : 0.45); plat.castShadow = true; mg.add(plat);
        if (S.roundTops && si === 0) { const fl = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.85, 18), M.darkWood()); fl.rotation.x = -PI / 2; fl.position.y = top - 1.15; fl.position.x = -rad * 0.25; mg.add(fl); }
        if (mi === S.mainIndex && si === 0) anchors.gabie = toShip(top - 0.6, rad);
        y = top - (si === 0 ? 2.6 : 2.0); // suprapunerea (dublura) catargelor
      } else {
        const truck = new THREE.Mesh(new THREE.SphereGeometry(Math.min(0.3, r2 * 1.6), 8, 6), M.darkWood()); truck.position.y = top; mg.add(truck);
      }
    });
    const mastTop = heads[heads.length - 1];
    mastTops.push({ mx, baseY, heads, toShip, mg });
    if (mi === S.mainIndex) anchors.catarg = toShip(heads[0] * 0.35, 0.6);

    // vergi și pânze pătrate
    const yards = mDef.yards || [];
    yards.forEach((yd, k) => {
      const yg = new THREE.Group(); yg.position.y = yd.h; yg.position.x = 0.7; mg.add(yg);
      yg.userData.brace = 0;
      const yr = yd.r || Math.max(0.12, yd.w * 0.012);
      const yc = cyl(yr * 0.5, yr, yd.w / 2, M.mast(S.yardColor || S.mastColor), 6);
      yc.rotation.x = PI / 2; yc.position.z = yd.w / 4; yg.add(yc);
      const yc2 = yc.clone(); yc2.rotation.x = -PI / 2; yc2.position.z = -yd.w / 4; yg.add(yc2);
      // mantilele (lifts): de la capetele vergii la catarg
      const above = Math.min(mastTop, yd.h + 3.5) - yd.h;
      const lg = new THREE.BufferGeometry().setFromPoints([V(0, above, 0), V(0, 0, yd.w / 2 - 0.3), V(0, above, 0), V(0, 0, -yd.w / 2 + 0.3)]);
      yg.add(new THREE.LineSegments(lg, M.rope()));
      if (yd.sail !== false) {
        let foot, wBot;
        if (k === 0) { foot = yd.foot ?? 4; wBot = yd.w * (yd.footW ?? 1.0); }
        else { foot = yards[k - 1].h + 0.5; wBot = yards[k - 1].w * 0.93; }
        const h = yd.h - foot;
        const s = squareSail(yd.w * 0.93, wBot, h, 1, M.sail(yd.cross ? 'cross' : S.sailKind || 'std'));
        s.position.y = -0.25; yg.add(s); sails.push(s);
        const f = cyl(0.35, 0.35, yd.w * 0.85, M.furled(), 8); f.rotation.x = PI / 2; f.position.y = -0.35; f.visible = false; yg.add(f); furled.push(f);
        if (mi === S.mainIndex && k === 0) { anchors.verga = toShip(yd.h + 0.4, yd.w / 2 - 0.5); }
        if (mi === S.mainIndex && k === 1) { anchors.panza = toShip(yd.h - h * 0.5, 0, 1.0); }
      }
      yg.userData.isYard = true;
      // parâmele de picior (footropes) pe care stau marinarii, cu scărițele lor
      const fr = [];
      for (const sd of [-1, 1]) {
        let prev = null;
        for (let i = 0; i <= 6; i++) {
          const zz = sd * (0.6 + (yd.w / 2 - 0.9) * i / 6), sag = -1.0 - 0.25 * Math.sin(PI * i / 6);
          const pt = V(0.25, sag, zz); if (prev) fr.push(prev, pt); prev = pt;
          if (i % 2 === 1) fr.push(V(0.1, 0, zz), pt);
        }
      }
      yg.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fr), M.rope()));
      yardInfo.push({ mi, h: yd.h, w: yd.w, toShip: (y, z) => toShip(y, z, 0.7) });
    });

    // wanturile (shrouds) cu treptele lor (ratlines)
    const chainY = deckH(mDef.t) - 0.2, chainZ = halfDeck(mDef.t) + 0.35;
    for (const s of ((mDef.shrouds ?? 5) >= 2 ? [-1, 1] : [])) {
      const top = toShip(heads[0] - 2.4, s * 0.5);
      const feet = [];
      const n = mDef.shrouds || 5;
      for (let i = 0; i < n; i++) {
        const fx = mx - 2.6 + i * (3.2 / (n - 1));
        const foot = V(fx, chainY, s * chainZ);
        seg(top, foot); feet.push(foot);
      }
      // trepte
      const steps = Math.floor((heads[0] - 2.4 - (chainY - baseY)) / 0.9);
      for (let r = 1; r < steps; r++) {
        const f = r / steps;
        for (let i = 0; i < n - 1; i++) seg(feet[i].clone().lerp(top, f), feet[i + 1].clone().lerp(top, f));
      }
      if (mi === S.mainIndex && s === 1) anchors.wanturi = feet[2].clone().lerp(top, 0.45);
      // wanturile gabierului (de la catargul 2 la marginea gabiei)
      if (heads.length > 1) {
        const t2 = toShip(heads[1] - 1.6, s * 0.3);
        const rad = mDef.topR || 2.2;
        for (let i = 0; i < 3; i++) seg(t2, toShip(heads[0] - 1.2, s * rad * 0.95, -0.8 + i * 0.8));
      }
      // pataraine (backstays) spre bordaj, la pupa catargului
      for (let h = 1; h < heads.length; h++) seg(toShip(heads[h] - 0.6, 0), V(mx - 4 - h * 1.5, chainY, s * chainZ));
    }
  });

  // bompresul
  let bowTip = null, bowsprit = S.bowsprit;
  if (bowsprit) {
    const base = V(tx(1) - (bowsprit.inboard || 3), deckH(1) - (bowsprit.drop || 0.6), 0);
    const ang = bowsprit.angle * PI / 180;
    const dir = V(Math.cos(ang), Math.sin(ang), 0);
    const len = bowsprit.len;
    const bs = cyl(bowsprit.r || 0.45, (bowsprit.r || 0.45) * 0.55, len, M.mast(S.mastColor));
    bs.position.copy(base).addScaledVector(dir, len / 2);
    bs.quaternion.setFromUnitVectors(V(0, 1, 0), dir); ship.add(bs);
    bowTip = base.clone().addScaledVector(dir, len);
    anchors.bompres = base.clone().addScaledVector(dir, len * 0.55).add(V(0, 0.6, 0));
    bowsprit._base = base; bowsprit._dir = dir;
    // straiuri de la catargul din față la bompres
    const fm = mastTops[0];
    seg(fm.toShip(fm.heads[0] - 2.2), base.clone().addScaledVector(dir, len * 0.35));
    if (bowsprit.martingale) seg(bowTip, V(tx(1) - 0.5, deckH(1) - 3.5, 0));
    // pânza de sub bompres (civadiera, la corăbiile vechi)
    if (bowsprit.sprit) {
      const p = base.clone().addScaledVector(dir, len * bowsprit.sprit.at);
      const yg = new THREE.Group(); yg.position.copy(p); ship.add(yg);
      const yc = cyl(0.12, 0.2, bowsprit.sprit.w, M.mast(S.mastColor), 6); yc.rotation.x = PI / 2; yc.position.y = -0.6; yg.add(yc);
      const s = squareSail(bowsprit.sprit.w * 0.9, bowsprit.sprit.w, bowsprit.sprit.h, 0.8, M.sail(S.sailKind || 'std'));
      s.position.y = -0.8; yg.add(s); sails.push(s);
      const f = cyl(0.3, 0.3, bowsprit.sprit.w * 0.8, M.furled(), 8); f.rotation.x = PI / 2; f.position.y = -0.9; f.visible = false; yg.add(f); furled.push(f);
    }
  }
  // focurile (pânze triunghiulare între catargul din față și bompres)
  for (const j of (S.jibs || [])) {
    const fm = mastTops[0];
    const tack = bowsprit._base.clone().addScaledVector(bowsprit._dir, bowsprit.len * j.at);
    const head = fm.toShip(j.h);
    seg(tack, head);
    const clew = tack.clone().lerp(head, 0.0).add(V(-(tack.x - head.x) * j.clew, -(tack.y - fm.baseY) * 0.15 + 1.0, 0));
    clew.y = Math.max(clew.y, deckH(0.85) + 1);
    const a = tack.clone().lerp(head, 0.04), b = tack.clone().lerp(head, 0.94);
    const s = sailPatch(a, b, b.clone().lerp(clew, 0.06), clew, { amt: 0.9, dir: V(0, 0, 1) }, M.sail(S.sailKind || 'std'));
    ship.add(s); sails.push(s);
    if (!anchors.foc) anchors.foc = a.clone().lerp(b, 0.35).lerp(clew, 0.3);
  }
  // velele estai (între catarge)
  for (const st of (S.staysails || [])) {
    const fA = mastTops[st.from], fB = mastTops[st.to];
    const head = fA.toShip(st.h), tack = fB.toShip(st.foot);
    seg(head, tack);
    const clew = V(head.x + 0.2 * (tack.x - head.x), tack.y + 0.3, 0);
    const s = sailPatch(tack.clone().lerp(head, 0.05), tack.clone().lerp(head, 0.95), head.clone().lerp(clew, 0.9), clew, { amt: 0.6, dir: V(0, 0, 1) }, M.sail(S.sailKind || 'std'), 6);
    ship.add(s); sails.push(s);
  }
  // straiurile dintre catarge
  for (let i = 1; i < mastTops.length; i++) {
    const a = mastTops[i], b = mastTops[i - 1];
    for (let h = 0; h < a.heads.length; h++) {
      const top = a.toShip(a.heads[h] - (h === 0 ? 2.4 : 0.8));
      const targetH = Math.max(1.5, (h === 0 ? 0.25 : 0.5) * b.heads[Math.min(h, b.heads.length - 1)]);
      seg(top, b.toShip(targetH));
    }
  }
  // straiurile catargului din față spre vârful bompresului
  if (bowTip) { const fm = mastTops[0]; for (let h = 1; h < fm.heads.length; h++) seg(fm.toShip(fm.heads[h] - 0.6), bowsprit._base.clone().addScaledVector(bowsprit._dir, bowsprit.len * (0.6 + 0.2 * h))); }

  // randa / brigantina (gaff sail)
  if (S.spanker) {
    const sp = S.spanker, m = mastTops[sp.mast];
    const gaffIn = m.toShip(sp.gaffH, 0, -0.5), gaffOut = gaffIn.clone().add(V(-sp.gaffLen * Math.cos(sp.gaffAng * PI / 180), sp.gaffLen * Math.sin(sp.gaffAng * PI / 180), 0));
    const boomIn = m.toShip(sp.boomH, 0, -0.5), boomOut = boomIn.clone().add(V(-sp.boomLen, 0.3, 0));
    const gc = cyl(0.14, 0.2, sp.gaffLen, M.mast(S.yardColor || S.mastColor), 6); gc.position.copy(gaffIn).lerp(gaffOut, 0.5); gc.quaternion.setFromUnitVectors(V(0, 1, 0), gaffOut.clone().sub(gaffIn).normalize()); ship.add(gc);
    const bc = cyl(0.16, 0.22, sp.boomLen, M.mast(S.yardColor || S.mastColor), 6); bc.position.copy(boomIn).lerp(boomOut, 0.5); bc.quaternion.setFromUnitVectors(V(0, 1, 0), V(-1, 0.02, 0)); ship.add(bc);
    const s = sailPatch(boomIn, gaffIn, gaffOut, boomOut, { amt: 0.8, dir: V(0, 0, 1) }, M.sail(S.sailKind || 'std'));
    ship.add(s); sails.push(s);
    anchors.randa = boomIn.clone().lerp(gaffOut, 0.5);
    if (sp.flag) addFlag(gaffOut.clone().add(V(-0.1, -0.2, 0)), sp.flag, 3.2, 2);
  }
  // pânzele latine (carracă)
  for (const lt of (S.lateens || [])) {
    const m = mastTops[lt.mast];
    const lo = m.toShip(lt.h, 0, lt.fwd), hi = m.toShip(lt.h + lt.rise, 0, -lt.aft);
    const yc = cyl(0.14, 0.26, lo.distanceTo(hi), M.mast(S.mastColor), 6);
    yc.position.copy(lo).lerp(hi, 0.5); yc.position.z = 0.5; yc.quaternion.setFromUnitVectors(V(0, 1, 0), hi.clone().sub(lo).normalize()); ship.add(yc);
    const clew = V(hi.x + (lo.x - hi.x) * 0.1, deckH(S.masts[lt.mast].t) + lt.clewY, 0.5);
    const a = lo.clone().add(V(0, -0.2, 0.5)), b = hi.clone().add(V(0, -0.2, 0.5));
    const s = sailPatch(a, b, b.clone().lerp(clew, 0.02), clew, { amt: 1.0, dir: V(0, 0, 1) }, M.sail(S.sailKind || 'std'));
    ship.add(s); sails.push(s);
    if (!anchors.latina) anchors.latina = a.clone().lerp(b, 0.5).lerp(clew, 0.35);
  }
  // pânzele joncii (cu șipci de bambus)
  for (const jk of (S.junkSails || [])) {
    const m = mastTops[jk.mast];
    const A = m.toShip(jk.bottom, 0.6, jk.fwd), B = m.toShip(jk.top, 0.6, jk.fwd * 0.6);
    const C = m.toShip(jk.top + jk.peak, 0.6, -jk.wTop), D = m.toShip(jk.bottom - 0.5, 0.6, -jk.wBot);
    const s = sailPatch(D, C, B, A, { amt: 0.7, dir: V(0, 0, 1) }, M.sail('junk'), 10);
    ship.add(s); sails.push(s);
    // șipcile ca bețe reale
    for (let i = 0; i <= jk.battens; i++) {
      const f = i / jk.battens;
      const p1 = A.clone().lerp(B, f), p2 = D.clone().lerp(C, f);
      const bc = cyl(0.07, 0.07, p1.distanceTo(p2) * 0.92, M.darkWood(), 4);
      bc.position.copy(p1).lerp(p2, 0.5); bc.position.z += 0.25; bc.quaternion.setFromUnitVectors(V(0, 1, 0), p2.clone().sub(p1).normalize());
      ship.add(bc); sails.push(bc);
      if (i % 3 === 0) seg(p2.clone().add(V(0, 0, 0.3)), V(p2.x - 3, deckH(Math.max(0, (p2.x / L) + 0.45)) - bw + 0.5, 0)); // scotele (sheets)
    }
    if (!anchors.sipci) anchors.sipci = A.clone().lerp(C, 0.5).add(V(0, 0, 1));
  }

  // cârma
  const R = S.rudder || {};
  const rud = new THREE.Mesh(new THREE.BoxGeometry(R.chord || 2.2, (R.top || 2) + S.hull.draft + (R.deep || 0), 0.35), M.darkWood());
  rud.position.set(tx(0) - (R.chord || 2.2) / 2 + 0.6, ((R.top || 2) - S.hull.draft - (R.deep || 0)) / 2, 0);
  rud.castShadow = true; ship.add(rud);
  anchors.carma = V(tx(0) - (R.chord || 2.2) / 2, -S.hull.draft * 0.45, 0.4);
  anchors.chila = V(0, -S.hull.draft - 0.3, 0.3);
  anchors.corp = V(tx(0.42), 0.6, zAt(0.42, 0.6) + 0.1);
  anchors.prova = V(tx(0.97), deckH(0.97) - 1.2, zAt(0.97, deckH(0.97) - 1.2) + 0.2);
  anchors.pupa = V(tx(0.005) - 0.2, deckH(0.0) - 1.6, 0);

  // timona
  if (S.wheel) {
    const wy = deckH(S.wheel.t) - bw + (S.wheel.lift || 0);
    const wg = new THREE.Group(); wg.position.set(tx(S.wheel.t), wy + 1.2, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.06, 6, 20), M.wood()); wg.add(ring);
    for (let i = 0; i < 8; i++) { const sp = cyl(0.04, 0.04, 1.8, M.wood(), 4); sp.rotation.z = i * PI / 8; wg.add(sp); }
    wg.rotation.y = PI / 2; ship.add(wg);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), M.darkWood()); post.position.set(tx(S.wheel.t) - 0.3, wy + 0.6, 0); ship.add(post);
    anchors.timona = wg.position.clone().add(V(0, 0.8, 0));
  }
  // porturile de tun
  for (const row of (S.gunports || [])) {
    for (let t = row.t0; t <= row.t1 + 1e-6; t += row.dt) {
      const y = deckH(t) - row.rel;
      for (const s of [-1, 1]) {
        const z = zAt(t, y);
        const p = new THREE.Mesh(new THREE.BoxGeometry(row.size, row.size * 0.9, 0.2), row.mat ? row.mat() : M.black());
        p.position.set(tx(t), y, s * (z + 0.02));
        const z2 = zAt(Math.min(1, t + 0.01), y);
        p.rotation.y = -s * Math.atan2(z2 - z, L * 0.01);
        ship.add(p);
        if (row.lids) { const lid = new THREE.Mesh(new THREE.BoxGeometry(row.size * 1.05, 0.08, row.size * 0.9), M.red()); lid.position.set(tx(t), y + row.size * 0.5, s * (z + row.size * 0.45)); lid.rotation.x = s * 0.5; ship.add(lid); }
      }
    }
    anchors.porturi = V(tx((row.t0 + row.t1) / 2 + 0.03), deckH(0.5) - row.rel, zAt(0.5, deckH(0.5) - row.rel) + 0.3);
  }
  // ochii joncii
  if (S.oculus) {
    for (const s of [-1, 1]) {
      const t = S.oculus.t, y = deckH(t) - S.oculus.rel, z = zAt(t, y);
      const e = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), M.white()); e.add(w);
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), M.black()); p.position.z = 0.02; p.position.x = 0.15; e.add(p);
      e.position.set(tx(t), y, s * (z + 0.06));
      const z2 = zAt(t + 0.01, y);
      e.rotation.y = (s > 0 ? 0 : PI) - s * Math.atan2(z2 - z, L * 0.01);
      ship.add(e);
      if (s === 1) anchors.ochi = e.position.clone().add(V(0, 0.4, 0.3));
    }
  }
  // decor: galeriile laterale de la pupa
  if (S.quarterGallery) {
    for (const s of [-1, 1]) {
      const t = 0.035, y = deckH(t) - 2.4;
      const q = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.9), M.gold());
      q.position.set(tx(t), y, s * (zAt(t, y) + 0.3)); ship.add(q);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.95), new THREE.MeshStandardMaterial({ color: 0x5d86a3, roughness: 0.2, metalness: 0.3 }));
      gl.position.copy(q.position); gl.position.y += 0.3; ship.add(gl);
    }
  }
  // steaguri
  function addFlag(pos, kind, w = 3, h = 2) {
    const g = new THREE.PlaneGeometry(w, h, 12, 6); g.translate(-w / 2, -h / 2, 0);
    const f = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.copy(pos); f.userData.base = g.attributes.position.array.slice(); f.userData.w = w;
    ship.add(f); flags.push(f);
    if (!anchors.steag) anchors.steag = pos.clone().add(V(-w / 2, -h / 2 + 0.4, 0));
    return f;
  }
  for (const fl of (S.flags || [])) {
    let p;
    if (fl.mast != null) { const m = mastTops[fl.mast]; p = m.toShip(m.heads[m.heads.length - 1] + 0.1); }
    else { p = V(tx(0) - 1.5, deckH(0) + fl.y, 0); const staff = cyl(0.08, 0.06, fl.y + 1, M.mast(S.mastColor), 5); staff.position.set(p.x + 0.05, deckH(0) + fl.y / 2 - 0.4, 0); staff.rotation.z = 0.25; ship.add(staff); p.x -= fl.y * 0.25; }
    addFlag(p, fl.kind, fl.w || 3, fl.h || 2);
  }

  // ---------------- interiorul ----------------
  const inside = addInterior(ship, hullO, S, anchors, mastTops);
  // ---------------- detalii ----------------
  const DT = S.details || {};
  addExteriorDetails(ship, hullO, S, anchors, mastTops, yardInfo, seg);
  // brâiele (wales): scânduri groase în relief de-a lungul corpului
  for (const rel of (DT.wales || [])) for (const sd of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = 0.015 + 0.97 * i / 40, y = deckH(t) - rel; pts.push(V(tx(t), y, sd * (zAt(t, y) + 0.05))); }
    ship.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.14, 4, false), DT.waleMat ? DT.waleMat() : M.darkWood()));
  }
  // podinele wanturilor (channels) și „ochii” (deadeyes)
  S.masts.forEach((mDef, mi) => {
    if ((mDef.shrouds ?? 5) < 2) return;
    const t = mDef.t, y = deckH(t) - 0.55;
    for (const sd of [-1, 1]) {
      const z = zAt(t, y);
      const ch = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 0.75), M.darkWood());
      ch.position.set(tx(t) - 1.0, y, sd * (z + 0.3)); ship.add(ch);
      const n = mDef.shrouds || 5;
      for (let i = 0; i < n; i++) {
        const de = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 10), M.black());
        de.rotation.x = PI / 2; de.position.set(tx(t) - 2.6 + i * (3.2 / (n - 1)), deckH(t) + 0.15, sd * (halfDeck(t) + 0.38)); ship.add(de);
        seg(de.position.clone(), V(de.position.x, y - 1.1, sd * (zAt(t, y - 1.1) + 0.05))); // lanțurile
      }
    }
    // balustrada cu cavile la piciorul catargului (fife rail)
    const fr = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 2.2), M.darkWood());
    fr.position.set(tx(t), deckH(t) - bw + 0.45, 0);
    const frIn = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.8), M.deck()); frIn.position.copy(fr.position); frIn.position.y += 0.05;
    ship.add(fr); ship.add(frIn);
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) { const pin = cyl(0.04, 0.04, 0.45, M.darkWood(), 4); pin.position.set(tx(t) - 0.8 + i * 0.32, deckH(t) - bw + 1.1, sd * 1.05); ship.add(pin); }
  });
  // ancorele, atârnate la prova
  if (DT.anchor) {
    const sz = DT.anchor;
    for (const sd of [-1, 1]) {
      const t = 0.9, y = deckH(t) - 0.8 - sz * 0.45, z = zAt(t, y);
      const a = makeAnchor(sz, DT.woodAnchor);
      a.position.set(tx(t), y, sd * (z + 0.45)); a.rotation.z = 0.12; a.rotation.y = sd * 0.15;
      ship.add(a);
      const cat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 1.6), M.darkWood());
      cat.position.set(tx(0.9), deckH(0.9) - 0.4, sd * (halfDeck(0.9) + 0.4)); ship.add(cat);
      seg(cat.position.clone().add(V(0, 0, sd * 0.7)), a.position.clone().add(V(0, sz * 0.5, 0)));
    }
    anchors.ancora = V(tx(0.9), deckH(0.9) - 0.8 - sz * 0.45, zAt(0.9, deckH(0.9) - 1.5) + 0.9);
  }
  // tunurile ieșite prin porturi
  for (const row of (S.gunports || [])) {
    if (!row.guns) continue;
    for (let t = row.t0; t <= row.t1 + 1e-6; t += row.dt) {
      const y = deckH(t) - row.rel;
      for (const sd of [-1, 1]) {
        const g = cyl(row.size * 0.22, row.size * 0.16, row.size * 1.9, M.black(), 10);
        g.rotation.x = PI / 2; g.position.set(tx(t), y - row.size * 0.08, sd * (zAt(t, y) + row.size * 0.75)); ship.add(g);
      }
    }
  }
  // tunuri pe punte, pe afet (dunetă)
  for (const dg of (DT.deckGuns || [])) for (const sd of [-1, 1]) {
    const y = deckH(dg.t) - bw + (dg.lift || 0);
    const gun = makeCannon(); gun.position.set(tx(dg.t), y, sd * (zAt(dg.t, y + 0.5) - 1.1)); gun.rotation.y = sd > 0 ? 0 : PI; ship.add(gun);
  }
  // cabestanul
  if (DT.capstan != null) {
    const t = DT.capstan, y = deckH(t) - bw;
    const c1 = cyl(0.55, 0.42, 1.1, M.wood(), 12); c1.position.set(tx(t), y + 0.55, 0); ship.add(c1);
    const c2 = cyl(0.6, 0.6, 0.2, M.darkWood(), 12); c2.position.set(tx(t), y + 1.15, 0); ship.add(c2);
    for (let i = 0; i < 4; i++) { const bar = cyl(0.05, 0.05, 3.2, M.wood(), 4); bar.rotation.z = PI / 2; bar.rotation.y = i * PI / 4; bar.position.set(tx(t), y + 1.05, 0); ship.add(bar); }
    anchors.cabestan = V(tx(t), y + 1.6, 0.3);
  }
  // trapele cu grătare
  for (const t of (DT.hatches || [])) {
    const y = deckH(t) - bw;
    const h = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 2.6), M.darkWood()); h.position.set(tx(t), y + 0.22, 0); ship.add(h);
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3, 1, 1), new THREE.MeshStandardMaterial({ map: gratingTex(), roughness: 0.9 }));
    gr.rotation.x = -PI / 2; gr.position.set(tx(t), y + 0.46, 0); ship.add(gr);
  }
  // figura de provă
  if (DT.figure) {
    const f = new THREE.Group();
    const m = DT.figure === 'gold' ? M.gold() : M.white();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.4, 4, 10), m); f.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), m); head.position.y = 1.15; f.add(head);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.9, 3, 6), m); arm.position.set(0.25, 1.2, 0); arm.rotation.z = -0.9; f.add(arm);
    f.position.set(tx(1) - 0.1, deckH(1) - 1.9, 0); f.rotation.z = -0.75; ship.add(f);
    anchors.figura = f.position.clone().add(V(0.6, 0.5, 0.4));
  }
  // felinarele de la pupa
  for (let i = 0; i < (DT.lanterns || 0); i++) {
    const z = DT.lanterns === 1 ? 0 : (i - (DT.lanterns - 1) / 2) * 2.6;
    const ln = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0x6b4a10, roughness: 0.2 }));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.5, 6), M.gold()); cap.position.y = 0.7;
    ln.add(glass, cap);
    const t = DT.lanternT ?? 0.01, top = deckH(t) + (DT.lanternY || 1.2);
    ln.position.set(tx(t) - 0.4, top, z); ship.add(ln);
    const post = cyl(0.06, 0.06, DT.lanternY || 1.2, M.gold(), 4); post.position.set(tx(t) - 0.4, top - (DT.lanternY || 1.2) / 2 - 0.4, z); ship.add(post);
  }
  // brațele vergilor (braces): frânghii trase spre pupa
  for (const y of yardInfo) {
    const aft = mastTops[y.mi + 1];
    for (const sd of [-1, 1]) {
      const arm = y.toShip(y.h, sd * (y.w / 2 - 0.2));
      const to = aft ? aft.toShip(Math.max(3, y.h * 0.55), sd * 0.4) : V(tx(0.03), deckH(0.03) + 0.2, sd * halfDeck(0.03));
      seg(arm, to);
    }
  }
  // echipajul: marinari pe punte și pe vergi
  if (DT.crew) {
    const rnd = mulberry(7 + L);
    const occupied = S.masts.map(m => tx(m.t));
    let placed = 0, guard = 0;
    while (placed < DT.crew && guard++ < 400) {
      const t = 0.12 + rnd() * 0.76, x = tx(t);
      if (occupied.some(mx => Math.abs(mx - x) < 2.2)) continue;
      const y = deckH(t) - bw, half = zAt(t, y + 0.3) - 0.9;
      if (half < 0.8) continue;
      const p = makeSailor(rnd, DT.hat); p.position.set(x, y + (blockLift(S, t) || 0), (rnd() * 2 - 1) * half); p.rotation.y = rnd() * PI * 2;
      ship.add(p); placed++;
    }
    // trei marinari strâng pânza pe verga mare
    const main = yardInfo.filter(y => y.mi === S.mainIndex);
    if (main.length > 1) {
      const yd = main[1];
      for (const zz of [-0.32, 0.18, 0.36]) {
        const p = makeSailor(rnd, DT.hat); const pos = yd.toShip(yd.h - 1.75, zz * yd.w); p.position.copy(pos); p.position.x -= 0.6; p.rotation.y = PI / 2; ship.add(p);
      }
    }
    // cârmaciul la timonă
    if (S.wheel) { const p = makeSailor(rnd, DT.hat); p.position.set(tx(S.wheel.t) - 1.0, deckH(S.wheel.t) - bw + (S.wheel.lift || 0), 0); p.rotation.y = 0; ship.add(p); }
    anchors.marinar = V(tx(0.6), deckH(0.6) - bw + 2.2, 1.5);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  ship.add(new THREE.LineSegments(lg, M.rope()));

  ship.userData = { id, sails, furled, flags, anchors, length: L + (bowsprit ? bowsprit.len * Math.cos(bowsprit.angle * PI / 180) : 0), hull: S.hull, height: Math.max(...mastTops.map(m => m.baseY + m.heads[m.heads.length - 1])) };
  ship.userData.inside = inside;
  ship.traverse(o => {
    if (o.isMesh && !o.userData.noShadow) o.castShadow = true;
    if ((o.isMesh || o.isLine || o.isInstancedMesh) && !o.userData.noClip) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { m.clippingPlanes = CLIP; m.clipShadows = true; });
    }
  });
  return ship;
}


function blockLift(S, t) { let h = 0; for (const b of (S.blocks || [])) if (t >= b.t0 && t <= b.t1 && !b.over) h = Math.max(h, (b.lift || 0) + b.h); return h; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gratingTex() {
  if (TEX.grate) return TEX.grate;
  TEX.grate = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1a120a'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a6a44'; for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 5, h); g.fillRect(0, i * 16, w, 5); } });
  return TEX.grate;
}
function makeAnchor(s, wood) {
  const g = new THREE.Group();
  const m = wood ? M.darkWood() : M.black();
  const shank = cyl(s * 0.05, s * 0.04, s, m, 6); g.add(shank);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(s * 0.33, s * 0.035, 5, 12, PI * 0.8), m);
  arm.rotation.z = PI + PI * 0.1; arm.position.y = -s * 0.2; g.add(arm);
  for (const sd of [-1, 1]) { const fl = new THREE.Mesh(new THREE.ConeGeometry(s * 0.09, s * 0.22, 4), m); fl.position.set(sd * s * 0.31, -s * 0.33, 0); fl.rotation.z = sd * 0.5; g.add(fl); }
  const stock = new THREE.Mesh(new THREE.BoxGeometry(s * 0.09, s * 0.09, s * 0.85), wood ? M.darkWood() : M.wood()); stock.position.y = s * 0.42; g.add(stock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.07, s * 0.015, 5, 10), M.black()); ring.position.y = s * 0.53; g.add(ring);
  return g;
}
function makeCannon() {
  const g = new THREE.Group();
  const car = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.9), M.red()); car.position.y = 0.4; g.add(car);
  for (const x of [-0.4, 0.4]) for (const sd of [-1, 1]) { const w = cyl(0.2, 0.2, 0.1, M.darkWood(), 10); w.rotation.x = PI / 2; w.position.set(x, 0.2, sd * 0.48); g.add(w); }
  const b = cyl(0.18, 0.12, 1.9, M.black(), 10); b.rotation.x = PI / 2; b.position.set(0, 0.75, 0.55); g.add(b);
  return g;
}
const SAILOR_COLS = [0x1e3a8a, 0xf2f2ee, 0x7f1d1d, 0x334155, 0x92400e, 0xe5e7eb];
function makeSailor(rnd, hat) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SAILOR_COLS[Math.floor(rnd() * SAILOR_COLS.length)], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: rnd() < 0.5 ? 0xe8e2d0 : 0x1f2937, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: hat === 'cone' ? 0xd9a77a : 0xe9b896, roughness: 0.8 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.22), pants); legs.position.y = 0.43; g.add(legs);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 3, 8), shirt); body.position.y = 1.15; g.add(body);
  for (const sd of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 6), shirt); arm.position.set(0, 1.12, sd * 0.27); arm.rotation.x = sd * (0.2 + rnd() * 0.6); g.add(arm); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); head.position.y = 1.62; g.add(head);
  if (hat === 'cone') { const h = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xc8a96a })); h.position.y = 1.78; g.add(h); }
  else if (rnd() < 0.6) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x111827 })); h.position.y = 1.74; g.add(h); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- interiorul corăbiei
function cargoTex(kind) {
  const k = 'cargo' + kind; if (TEX[k]) return TEX[k];
  TEX[k] = canvasTex(128, 128, (g, w, h) => {
    if (kind === 'tea') { // ladă de ceai: lemn deschis, cu ștampilă și caractere
      g.fillStyle = '#c9a26b'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.1);
      g.strokeStyle = '#7a5a33'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
      g.fillStyle = '#2b1d10'; g.font = 'bold 54px "Microsoft YaHei", "SimSun", sans-serif'; g.textAlign = 'center'; g.fillText('茶', w / 2, h * 0.62);
      g.fillStyle = '#b3201c'; g.fillRect(w * 0.7, h * 0.08, w * 0.2, h * 0.2);
    } else if (kind === 'crate') { // ladă cu porțelan
      g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.12);
      g.fillStyle = '#6b4a2a'; for (let i = 0; i < 4; i++) g.fillRect(0, i * h / 4, w, 4);
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.stroke();
      g.fillStyle = '#1d3f8f'; g.beginPath(); g.arc(w * 0.75, h * 0.25, 12, 0, Math.PI * 2); g.fill();
    } else if (kind === 'sack') {
      g.fillStyle = '#9b7d52'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,40,20,.35)';
      for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    } else if (kind === 'cask') {
      g.fillStyle = '#7a5230'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.3)';
      for (let i = 0; i < w; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
      g.fillStyle = '#2b2b2b'; g.fillRect(0, h * 0.12, w, 7); g.fillRect(0, h * 0.82, w, 7);
    } else if (kind === 'hammock') {
      g.fillStyle = '#e4dcc6'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.06);
      g.strokeStyle = 'rgba(120,100,70,.4)'; for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); }
    } else if (kind === 'chart') { // harta de pe masa căpitanului
      g.fillStyle = '#efe2c0'; g.fillRect(0, 0, w, h); noise(g, w, h, 0.05);
      g.strokeStyle = '#8a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 90); g.bezierCurveTo(30, 60, 50, 100, 70, 70); g.bezierCurveTo(90, 40, 100, 60, 118, 30); g.stroke();
      g.strokeStyle = 'rgba(80,60,30,.5)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(i * Math.PI / 4) * 60, 64 + Math.sin(i * Math.PI / 4) * 60); g.stroke(); }
      g.strokeStyle = '#b3201c'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(15, 20); g.lineTo(40, 70); g.lineTo(90, 85); g.lineTo(115, 50); g.stroke();
    }
  });
  return TEX[k];
}

function addInterior(ship, H, S, anchors, mastTops) {
  const IN = S.interior; if (!IN) return null;
  const { deckH, zAt, keelY, L, bw } = H;
  const tx = t => (t - 0.5) * L, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mainY = t => deckH(t) - bw;
  const g = new THREE.Group(); g.name = 'interior'; ship.add(g);
  const rnd = mulberry(31 + Math.round(L));
  const dummy = new THREE.Object3D();
  const decks = (IN.decks || []).slice().sort((a, b) => b - a);
  const floorY = IN.floor;
  const levels = [mainY(0.5)].concat(decks); // tavanele (punțile de deasupra)

  // punțile de jos și podeaua calei
  function strip(y, t0, t1, mat) {
    const P = [], UV = [], I = [], N = 60;
    for (let i = 0; i <= N; i++) { const t = lerp(t0, t1, i / N), z = Math.max(0, zAt(t, y + 0.05) - 0.05); P.push(tx(t), y, -z, tx(t), y, z); UV.push(t * 8, 0, t * 8, 1); if (i < N) { const a = i * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); gg.setIndex(I); gg.computeVertexNormals();
    const m = new THREE.Mesh(gg, mat); m.receiveShadow = true; return m;
  }
  decks.forEach(y => g.add(strip(y, 0.03, 0.97, M.deckIn())));
  g.add(strip(floorY, 0.07, 0.93, M.deckIn()));
  if (decks.length) anchors.puntea = V(tx(0.33), decks[0] + 0.6, zAt(0.33, decks[0] + 1) - 1.2);

  // grinzile punților (instanțe)
  const beams = [];
  for (const yTop of levels) for (let x = tx(0.05); x < tx(0.95); x += 1.25) {
    const t = x / L + 0.5, y = yTop - 0.17, w = 2 * Math.max(0, zAt(t, y) - 0.1);
    if (w > 0.5) beams.push([x, y, w]);
  }
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.darkWood(), beams.length);
  beams.forEach(([x, y, w], i) => { dummy.position.set(x, y, 0); dummy.scale.set(0.24, 0.3, w); dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix); });
  g.add(bm);

  // coastele (frames) care țin corpul, unite într-o singură geometrie
  const ribs = [];
  for (let t = 0.07; t <= 0.93; t += 0.028) {
    const top = mainY(t), bot = keelY(t) + 0.3, pts = [];
    if (top - bot < 1) continue;
    for (let k = 0; k <= 12; k++) { const y = lerp(top, bot, k / 12); pts.push(V(tx(t), y, -Math.max(0.05, zAt(t, y) - 0.17))); }
    for (let k = 12; k >= 0; k--) { const y = lerp(top, bot, k / 12); pts.push(V(tx(t), y, Math.max(0.05, zAt(t, y) - 0.17))); }
    ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.13, 4, false));
  }
  if (ribs.length) { const rm = new THREE.Mesh(mergeGeometries(ribs), M.darkWood()); rm.receiveShadow = true; g.add(rm); anchors.coaste = V(tx(0.21), (floorY + mainY(0.21)) / 2, zAt(0.21, (floorY + mainY(0.21)) / 2) - 0.6); }

  // carlinga (keelson) peste chilă
  const ks = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.55, 0.6), M.darkWood()); ks.position.set(-L * 0.02, -S.hull.draft + 0.45, 0); g.add(ks);
  anchors.carlinga = V(tx(0.6), -S.hull.draft + 0.9, 0.4);
  // catargele coboară până pe chilă
  mastTops.forEach((m, i) => { const r = (S.masts[i].r || 0.45) * 0.95, top = m.baseY, bot = -S.hull.draft + 0.6; const c = cyl(r, r, top - bot, M.mast(S.mastColor)); c.position.set(m.mx, (top + bot) / 2, 0); g.add(c); });

  // balastul: pietre pe fundul calei
  const nb = 320, ball = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1 }), nb);
  for (let i = 0; i < nb; i++) { const t = 0.15 + rnd() * 0.7, y = floorY - 0.2, z = (rnd() * 2 - 1) * Math.max(0.2, zAt(t, y) * 0.7); dummy.position.set(tx(t), y - rnd() * 0.25, z); dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.setScalar(0.7 + rnd() * 0.8); dummy.updateMatrix(); ball.setMatrixAt(i, dummy.matrix); }
  dummy.rotation.set(0, 0, 0); g.add(ball);
  anchors.balast = V(tx(0.5), floorY - 0.2, 0.6);

  // marfa: stive de lăzi, saci și butoaie (instanțe)
  const KIND = {
    tea: { geo: () => new THREE.BoxGeometry(0.58, 0.5, 0.58), mat: () => new THREE.MeshStandardMaterial({ map: cargoTex('tea'), roughness: 0.9 }), sx: 0.6, sy: 0.52, sz: 0.6, key: 'ceai' },
    crate: { geo: () => new THREE.BoxGeometry(0.95, 0.75, 0.95), mat: () => new THREE.MeshStandardMaterial({ map: cargoTex('crate'), roughness: 0.9 }), sx: 1.0, sy: 0.78, sz: 1.0, key: 'portelan' },
    sack: { geo: () => new THREE.SphereGeometry(0.5, 10, 8), mat: () => new THREE.MeshStandardMaterial({ map: cargoTex('sack'), roughness: 1 }), sx: 0.95, sy: 0.48, sz: 0.7, scale: [0.9, 0.5, 0.65], key: 'mirodenii' },
    cask: { geo: () => new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14), mat: () => new THREE.MeshStandardMaterial({ map: cargoTex('cask'), roughness: 0.8 }), sx: 0.75, sy: 1.0, sz: 0.75, key: 'butoaie' },
  };
  for (const c of (IN.cargo || [])) {
    const K = KIND[c.kind], list = [];
    const top = c.y0 + (c.y1 - c.y0) * (c.fill ?? 1);
    for (let y = c.y0 + K.sy / 2; y + K.sy / 2 <= top; y += K.sy)
      for (let x = tx(c.t0); x <= tx(c.t1); x += K.sx) {
        const t = x / L + 0.5, zmax = zAt(t, y - K.sy / 2) - 0.32;
        for (let z = (c.aisle ?? 0.8) + K.sz / 2; z + K.sz / 2 <= zmax; z += K.sz) { list.push([x, y, z]); list.push([x, y, -z]); }
      }
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(K.geo(), K.mat(), list.length);
    list.forEach(([x, y, z], i) => { dummy.position.set(x + (rnd() - 0.5) * 0.04, y, z); dummy.rotation.y = (rnd() - 0.5) * 0.06; if (K.scale) dummy.scale.set(...K.scale); else dummy.scale.set(1, 1, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    im.castShadow = true; im.receiveShadow = true; g.add(im);
    const mid = list[Math.floor(list.length * 0.55)];
    if (!anchors[K.key]) anchors[K.key] = V(mid[0], top + 0.3, Math.abs(mid[2]));
  }
  anchors.cala = V(tx(0.5), (floorY + (decks.length ? decks[decks.length - 1] : mainY(0.5))) / 2 + 0.6, 0);

  // hamacele marinarilor
  if (IN.hammocks) {
    const hm = IN.hammocks, list = [];
    for (let x = tx(hm.t0); x <= tx(hm.t1); x += 2.1) { const t = x / L + 0.5, zmax = zAt(t, hm.y) - 0.9; for (let z = -zmax; z <= zmax; z += 0.62) list.push([x, hm.y, z]); }
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 1.9, 10, 1, true, PI * 0.5, PI); geo.rotateZ(PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: cargoTex('hammock'), side: THREE.DoubleSide, roughness: 1 }), list.length);
    list.forEach(([x, y, z], i) => { dummy.position.set(x, y - 0.25, z); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    g.add(im);
    anchors.hamace = V(tx((hm.t0 + hm.t1) / 2), hm.y - 0.1, 0.3);
  }
  // bucătăria (soba de fier, cu oale de cupru și coș)
  if (IN.stove) {
    const st = IN.stove, x = tx(st.t);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.2), M.iron()); box.position.set(x, st.y + 0.5, 0); g.add(box);
    for (const z of [-0.3, 0.3]) { const pot = cyl(0.25, 0.22, 0.35, M.copper(), 12); pot.position.set(x + 0.2, st.y + 1.18, z); g.add(pot); }
    const ch = cyl(0.15, 0.15, mainY(st.t) + 1.6 - st.y - 1.0, M.iron(), 8); ch.position.set(x - 0.4, (st.y + 1.0 + mainY(st.t) + 1.6) / 2, 0); g.add(ch);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 8), M.iron()); cap.position.set(x - 0.4, mainY(st.t) + 1.75, 0); ship.add(cap);
    anchors.bucatarie = V(x, st.y + 1.3, 0.8);
  }
  // cabina căpitanului: perete cu ușă, masă cu hartă, scaune, cufăr, pat
  if (IN.cabin) {
    const cb = IN.cabin, y = cb.y, xw = tx(cb.t1), half = zAt(cb.t1, y + 1.1) - 0.05;
    for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, half - 0.55), M.inWood()); w.position.set(xw, y + 1.05, sd * (0.55 + (half - 0.55) / 2)); g.add(w); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 1.1), M.inWood()); lintel.position.set(xw, y + 1.95, 0); g.add(lintel);
    const cx = tx((cb.t0 + cb.t1) / 2);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), M.wood()); table.position.set(cx, y + 0.8, 0); g.add(table);
    for (const [dx, dz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) { const lg = cyl(0.05, 0.05, 0.8, M.darkWood(), 6); lg.position.set(cx + dx, y + 0.4, dz); g.add(lg); }
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: cargoTex('chart'), roughness: 0.9 })); chart.rotation.x = -PI / 2; chart.position.set(cx, y + 0.85, 0); g.add(chart);
    const sext = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 4, 12, PI / 3), M.brass()); sext.rotation.x = -PI / 2; sext.position.set(cx + 0.6, y + 0.86, 0.25); g.add(sext);
    for (const [dx, dz] of [[-0.6, -0.95], [0.6, -0.95], [-0.6, 0.95], [0.6, 0.95]]) { const ch = new THREE.Group(); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), M.wood()); seat.position.y = 0.48; const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), M.wood()); back.position.set(0, 0.8, dz > 0 ? 0.22 : -0.22); ch.add(seat, back); ch.position.set(cx + dx, y, dz); g.add(ch); }
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.6), M.darkWood()); chest.position.set(cx + 1.6, y + 0.3, half - 0.6); g.add(chest);
    const bunk = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.9), M.inWood()); bunk.position.set(cx - 1.4, y + 0.6, -(half - 0.7)); g.add(bunk);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb84d, emissiveIntensity: 1.5 })); lamp.position.set(cx, y + 2.0, 0); g.add(lamp);
    anchors.cabina = V(cx, y + 1.3, 0.6);
  }
  // pompele de santină, lângă catargul mare
  const mm = mastTops[S.mainIndex];
  for (const z of [-0.7, 0.7]) { const p = cyl(0.17, 0.17, mainY(0.5) + 1.0 - floorY, M.wood(), 10); p.position.set(mm.mx - 1.3, (mainY(0.5) + 1.0 + floorY) / 2, z); g.add(p); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 1.3), M.iron()); hd.position.set(mm.mx - 1.3, mainY(0.5) + 1.05, z); ship.add(hd); }
  anchors.pompe = V(mm.mx - 1.3, floorY + 1.4, 0.9);
  // scările dintre punți
  const ys = [mainY(0.42)].concat(decks, [floorY]);
  for (let i = 0; i < ys.length - 1; i++) {
    const x0 = tx(0.42) - 0.3, top = ys[i], bot = ys[i + 1], h = top - bot, run = h * 0.55;
    for (const z of [-0.35, 0.35]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, Math.hypot(h, run), 0.08), M.wood()); r.position.set(x0 - run / 2, bot + h / 2, z); r.rotation.z = Math.atan2(run, h); g.add(r); }
    const n = Math.floor(h / 0.3);
    for (let k = 1; k < n; k++) { const f = k / n; const st = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.7), M.wood()); st.position.set(x0 - run * (1 - f), bot + h * f, 0); g.add(st); }
  }
  // tunurile pe puntea de tunuri, în dreptul porturilor
  for (const row of (S.gunports || [])) {
    if (row.inner == null) continue;
    for (let t = row.t0; t <= row.t1 + 1e-6; t += row.dt) for (const sd of [-1, 1]) {
      const y = row.inner, gun = makeCannon(); gun.position.set(tx(t), y, sd * (zAt(t, y + 0.8) - 1.25)); gun.rotation.y = sd > 0 ? 0 : PI; g.add(gun);
    }
    anchors.tun = V(tx((row.t0 + row.t1) / 2), row.inner + 1.0, zAt(0.5, row.inner + 1) - 1.4);
  }
  // pereții etanși ai joncii (o invenție chinezească)
  for (const t of (IN.bulkheads || [])) {
    const pts = [], top = mainY(t), bot = keelY(t);
    for (let k = 0; k <= 14; k++) { const y = lerp(top, bot, k / 14); pts.push(new THREE.Vector2(-Math.max(0, zAt(t, y) - 0.06), y)); }
    for (let k = 14; k >= 0; k--) { const y = lerp(top, bot, k / 14); pts.push(new THREE.Vector2(Math.max(0, zAt(t, y) - 0.06), y)); }
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)); geo.rotateY(PI / 2);
    const w = new THREE.Mesh(geo, M.inWood()); w.position.x = tx(t); g.add(w);
    if (!anchors.pereti) anchors.pereti = V(tx(t) + 0.2, (top + bot) / 2, 0.8);
  }
  // marinari la lucru în interior
  for (let i = 0; i < (IN.crew || 0); i++) {
    const lv = decks.length ? decks[i % decks.length] : floorY;
    const t = 0.3 + rnd() * 0.45, half = zAt(t, lv + 0.5) - 1.6; if (half < 0.4) continue;
    const p = makeSailor(rnd, S.details && S.details.hat); p.position.set(tx(t), lv, (rnd() * 2 - 1) * half); p.rotation.y = rnd() * 6; g.add(p);
  }
  // felinare + lumini calde în interior (aprinse doar la corabia afișată)
  const lights = [];
  const spots = [[0.3, (floorY + (decks[decks.length - 1] ?? mainY(0.5))) / 2 + 0.8], [0.7, (floorY + (decks[decks.length - 1] ?? mainY(0.5))) / 2 + 0.8]];
  decks.forEach(y => spots.push([0.5, y + 2.0]));
  if (IN.cabin) spots.push([(IN.cabin.t0 + IN.cabin.t1) / 2, IN.cabin.y + 1.9]);
  spots.slice(0, 5).forEach(([t, y]) => {
    const l = new THREE.PointLight(0xffc477, 28, 26, 1.6); l.position.set(tx(t), y, 0); ship.add(l); lights.push(l);
    const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa53d, emissiveIntensity: 1.2 }));
    ln.position.set(tx(t), y + 0.2, 0); ln.userData.noShadow = true; g.add(ln);
  });
  ship.userData.lights = lights;

  // pozițiile camerei pentru vizita în interior
  const hy = (floorY + (decks[decks.length - 1] ?? mainY(0.5))) / 2 + 0.5;
  const P = {
    cala: { pos: V(tx(0.3), hy, 0.55), look: V(tx(0.5), hy - 0.4, 0.55) },
    keel: { from: V(tx(0.33), -S.hull.draft - 9, 6), pos: V(tx(0.31), hy - 0.3, 0.55), look: V(tx(0.5), hy - 0.2, 0.55) },
  };
  if (decks.length) P.puntea = { pos: V(tx(0.3), decks[0] + 1.6, 0), look: V(tx(0.65), decks[0] + 1.3, 0) };
  if (IN.cabin) P.cabina = { pos: V(tx(IN.cabin.t1) - 0.4, IN.cabin.y + 1.6, 0), look: V(tx(IN.cabin.t0), IN.cabin.y + 1.0, 0) };
  return P;
}

// ---------------------------------------------------------------- detalii suplimentare pe exterior
function addExteriorDetails(ship, H, S, anchors, mastTops, yardInfo, seg) {
  const { deckH, zAt, halfDeck, L, bw } = H;
  const tx = t => (t - 0.5) * L, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const dummy = new THREE.Object3D();
  // balustrade cu cavile (pinrails) pe interiorul parapetului
  const pins = [];
  for (const sd of [-1, 1]) for (let t = 0.2; t <= 0.85; t += 0.012) {
    const y = deckH(t) - 0.45, z = sd * (zAt(t, y) - 0.25);
    pins.push([tx(t), y, z]);
  }
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.03, 0.45, 5), M.darkWood(), pins.length);
  pins.forEach(([x, y, z], i) => { dummy.position.set(x, y, z); dummy.updateMatrix(); pm.setMatrixAt(i, dummy.matrix); });
  ship.add(pm);
  for (const sd of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const t = 0.2 + 0.65 * i / 30, y = deckH(t) - 0.55; pts.push(V(tx(t), y, sd * (zAt(t, y) - 0.25))); }
    ship.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 4, false), M.wood()));
  }
  // nările ancorei (hawse holes) și lanțul ancorei până la cabestan
  const ht = 0.955, hy = deckH(ht) - 1.0;
  for (const sd of [-1, 1]) {
    const hz = zAt(ht, hy);
    const hole = cyl(0.28, 0.28, 0.3, M.iron(), 12); hole.rotation.x = PI / 2; hole.position.set(tx(ht), hy, sd * hz); ship.add(hole);
    if (S.details && S.details.capstan != null) {
      const ct = S.details.capstan, cy = deckH(ct) - bw + 0.12;
      const curve = new THREE.CatmullRomCurve3([V(tx(ht) - 0.3, deckH(ht) - bw + 0.12, sd * Math.max(0.4, zAt(ht, hy) - 0.8)), V(tx((ht + ct) / 2), cy, sd * 0.9), V(tx(ct) + 0.6, cy, sd * 0.4)]);
      const chain = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.07, 5, false), M.iron()); ship.add(chain);
    }
  }
  // scripeți (blocks) la capetele vergilor
  const blocks = [];
  for (const y of yardInfo) for (const sd of [-1, 1]) blocks.push(y.toShip(y.h - 0.35, sd * (y.w / 2 - 0.4)));
  const bk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.32, 0.16), M.darkWood(), blocks.length);
  blocks.forEach((p, i) => { dummy.position.copy(p); dummy.updateMatrix(); bk.setMatrixAt(i, dummy.matrix); });
  if (blocks.length) ship.add(bk);
  // busola (habitaclul) lângă timonă
  if (S.wheel) {
    const wy = deckH(S.wheel.t) - bw + (S.wheel.lift || 0);
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 10), M.wood()); bin.position.set(tx(S.wheel.t) + 1.4, wy + 0.5, 0); ship.add(bin);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, PI * 2, 0, PI / 2), M.brass()); dome.position.set(tx(S.wheel.t) + 1.4, wy + 1.0, 0); ship.add(dome);
  }
  // clopotul corăbiei
  const bt = 0.86, by = deckH(bt) - bw;
  const belf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), M.wood()); belf.position.set(tx(bt), by + 0.8, 0.5); ship.add(belf);
  const belf2 = belf.clone(); belf2.position.z = -0.5; ship.add(belf2);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.15), M.wood()); bar.position.set(tx(bt), by + 1.6, 0); ship.add(bar);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 0.35, 12, 1, true), M.brass()); bell.position.set(tx(bt), by + 1.32, 0); ship.add(bell);
  // butoaie cu apă pe punte
  const mm = mastTops[S.mainIndex];
  for (let i = 0; i < 3; i++) { const b = cyl(0.33, 0.33, 0.9, new THREE.MeshStandardMaterial({ map: cargoTex('cask'), roughness: 0.8 }), 12); b.position.set(mm.mx + 1.8 + i * 0.75, deckH(0.5) - bw + 0.45, -(halfDeck(0.5) - 1.6)); ship.add(b); }
  // balamalele cârmei
  for (let k = 0; k < 4; k++) { const pin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), M.copper()); pin.position.set(tx(0) + 0.3, -S.hull.draft * 0.85 + k * (S.hull.draft * 0.8 / 3), 0); ship.add(pin); }
}

// ---------------------------------------------------------------- specificațiile
const WAL = (rel, step, w) => (rel % step) < w;
export const SPECS = {
  cutty: {
    hull: {
      L: 64.7, B: 11, F: 2.7, draft: 6.0, sheerB: 1.7, sheerS: 0.9, tm: 0.5, pa: 1.9, pf: 1.55, trS: 0.3, paLow: 1.25, pfLow: 1.15, k: 1.55, tumble: 0.03, stemStart: 0.9, stemPow: 1.6, sternTex: 'cutty', bulwark: 1.2,
      color: (t, y, rel) => y < 0.35 ? '#b8913f' : (rel > 0.38 && rel < 0.5) ? '#d9b04c' : '#151515',
    },
    mastColor: 0xb08a55, yardColor: 0x1c1c1c, mainIndex: 1,
    masts: [
      { t: 0.735, rake: 3, r: 0.42, segs: [19, 14, 13], topR: 2.0, yards: [{ h: 16.5, w: 22.5, foot: 4 }, { h: 21.5, w: 20 }, { h: 26.5, w: 17.5 }, { h: 31.5, w: 14 }, { h: 36, w: 10.5 }] },
      { t: 0.5, rake: 3.5, r: 0.45, segs: [20, 15, 14], topR: 2.1, yards: [{ h: 17.5, w: 23.8, foot: 4 }, { h: 22.5, w: 21.2 }, { h: 28, w: 18.5 }, { h: 33.5, w: 15 }, { h: 38.5, w: 11 }] },
      { t: 0.27, rake: 4, r: 0.36, segs: [16, 12, 10], topR: 1.6, yards: [{ h: 14, w: 17, sail: false }, { h: 18.5, w: 15 }, { h: 23, w: 13 }, { h: 27.5, w: 10 }, { h: 31, w: 7.5 }] },
    ],
    bowsprit: { angle: 11, len: 20, r: 0.42, inboard: 3.5, drop: 0.7, martingale: true },
    jibs: [{ at: 0.3, h: 17.5, clew: 0.45 }, { at: 0.55, h: 24, clew: 0.42 }, { at: 0.78, h: 30, clew: 0.4 }, { at: 0.97, h: 35, clew: 0.38 }],
    staysails: [{ from: 1, to: 0, h: 21, foot: 3 }, { from: 2, to: 1, h: 17, foot: 3 }],
    spanker: { mast: 2, boomH: 3.5, gaffH: 13, gaffLen: 10, gaffAng: 22, boomLen: 14, flag: 'red' },
    houses: [{ t0: 0.58, t1: 0.68, h: 2.2, w: 4.6 }, { t0: 0.36, t1: 0.44, h: 2.1, w: 4.2 }],
    blocks: [{ t0: 0.0, t1: 0.11, h: 1.2, anchor: null }],
    boats: [{ t: 0.4, len: 6, y: 2.4, z: 2.6 }, { t: 0.4, len: 6, y: 2.4, z: -2.6 }],
    wheel: { t: 0.04, lift: 1.2 },
    flags: [{ mast: 1, kind: 'pennantR', w: 4, h: 0.6 }],
    rudder: { chord: 2.4, top: 2.2 },
    interior: { decks: [-1.0], floor: -4.9, cargo: [{ kind: 'tea', t0: 0.1, t1: 0.9, y0: -4.9, y1: -1.2, fill: 0.85 }, { kind: 'tea', t0: 0.5, t1: 0.86, y0: -1.0, y1: 1.3, fill: 0.5 }, { kind: 'cask', t0: 0.14, t1: 0.22, y0: -1.0, y1: 0.2, aisle: 1.1 }], stove: { t: 0.78, y: -1.0 }, cabin: { t0: 0.02, t1: 0.12, y: -1.0 }, crew: 3 },
    details: { wales: [], anchor: 2.4, capstan: 0.86, hatches: [0.47, 0.55, 0.7], figure: 'white', crew: 9, lanterns: 0 },
  },
  hindostan: {
    hull: {
      L: 50, B: 13.4, F: 6.4, draft: 6.2, sheerB: 1.6, sheerS: 2.2, tm: 0.56, pa: 2.7, pf: 2.3, trS: 0.58, paLow: 1.6, pfLow: 1.7, k: 3.0, tumble: 0.12, stemStart: 0.87, sternTex: 'indiaman', bulwark: 1.3,
      color: (t, y, rel) => y < 0.4 ? '#b4693e' : (rel > 2.45 && rel < 3.75) ? '#c9a14a' : (rel > 0.85 && rel < 1.25) ? '#c9a14a' : WAL(rel, 1.6, 0.3) ? '#0d0d0d' : '#1a1a1a',
    },
    mastColor: 0xa47a49, mainIndex: 1, quarterGallery: true,
    masts: [
      { t: 0.79, rake: 1, r: 0.55, segs: [21, 14, 9], topR: 2.6, yards: [{ h: 18, w: 23, foot: 5.5 }, { h: 27, w: 17.5 }, { h: 34.5, w: 11 }] },
      { t: 0.535, rake: 2, r: 0.6, segs: [23, 15.5, 10], topR: 2.8, yards: [{ h: 20, w: 26, foot: 6 }, { h: 29.5, w: 19.5 }, { h: 37.5, w: 12.5 }] },
      { t: 0.25, rake: 3, r: 0.45, segs: [18, 12, 8], topR: 2.1, yards: [{ h: 15.5, w: 18, sail: false }, { h: 22.5, w: 13.5 }, { h: 28.5, w: 8.5 }] },
    ],
    bowsprit: { angle: 27, len: 24, r: 0.55, inboard: 4, drop: 0.8, sprit: { at: 0.55, w: 14, h: 5.5 } },
    jibs: [{ at: 0.55, h: 19, clew: 0.5 }, { at: 0.9, h: 28, clew: 0.42 }],
    staysails: [{ from: 1, to: 0, h: 26, foot: 5 }],
    spanker: { mast: 2, boomH: 4.5, gaffH: 13.5, gaffLen: 9, gaffAng: 30, boomLen: 13 },
    blocks: [{ t0: 0.0, t1: 0.3, h: 1.3 }, { t0: 0.84, t1: 1.0, h: 1.0 }],
    boats: [{ t: 0.66, len: 7, y: 1.8 }, { t: 0.43, len: 6, y: 1.8 }],
    wheel: { t: 0.22, lift: 1.3 },
    gunports: [{ t0: 0.18, t1: 0.82, dt: 0.06, rel: 3.1, size: 0.85, guns: true, lids: true, inner: 2.4 }, { t0: 0.07, t1: 0.27, dt: 0.065, rel: 1.05, size: 0.55 }],
    flags: [{ kind: 'eic', y: 6, w: 6, h: 3.6 }, { mast: 1, kind: 'pennantR', w: 6, h: 0.6 }],
    rudder: { chord: 2.6, top: 3.5 },
    interior: { decks: [2.4, -0.8], floor: -4.7, cargo: [{ kind: 'tea', t0: 0.32, t1: 0.88, y0: -4.7, y1: -1.05, fill: 0.85 }, { kind: 'crate', t0: 0.12, t1: 0.3, y0: -4.7, y1: -1.05, fill: 0.8 }, { kind: 'cask', t0: 0.1, t1: 0.3, y0: -0.8, y1: 2.0, aisle: 1.2 }], hammocks: { t0: 0.48, t1: 0.8, y: 4.65 }, stove: { t: 0.84, y: 2.4 }, cabin: { t0: 0.02, t1: 0.15, y: 2.4 }, crew: 6 },
    details: { wales: [2.35, 3.85, 5.1], anchor: 3.2, capstan: 0.6, hatches: [0.43, 0.7], figure: 'gold', crew: 14, lanterns: 3, lanternY: 1.6, deckGuns: [{ t: 0.12, lift: 1.3 }, { t: 0.2, lift: 1.3 }] },
  },
  madre: {
    hull: {
      L: 50, B: 14.5, F: 4.6, draft: 8.0, sheerB: 2.8, sheerS: 3.4, tm: 0.5, pa: 2.2, pf: 1.9, trS: 0.5, paLow: 1.5, pfLow: 1.5, k: 2.2, tumble: 0.24, stemStart: 0.84, sternTex: 'carrack', bulwark: 1.1,
      color: (t, y, rel) => y < 0.2 ? '#3a2f24' : WAL(rel, 1.7, 0.32) ? '#2a1d12' : '#6c4826',
    },
    mastColor: 0x8b6136, mainIndex: 1, roundTops: true, sailKind: 'old',
    masts: [
      { t: 0.8, rake: -2, r: 0.55, segs: [19, 11], topR: 2.0, shrouds: 4, yards: [{ h: 16, w: 19, foot: 3.5, cross: true }, { h: 24.5, w: 10.5, cross: false }] },
      { t: 0.52, rake: 1, r: 0.75, segs: [26, 13, 7], topR: 2.6, yards: [{ h: 22, w: 28, foot: 4, footW: 1.05, cross: true }, { h: 32.5, w: 15, cross: true }, { h: 39, w: 7 }] },
      { t: 0.27, rake: 2, r: 0.45, segs: [17, 6], topR: 1.6, shrouds: 4 },
      { t: 0.1, rake: 3, r: 0.38, segs: [13], topR: 1.2, shrouds: 3 },
    ],
    lateens: [{ mast: 2, h: 9, rise: 11, fwd: 6, aft: 9, clewY: 3.5 }, { mast: 3, h: 7, rise: 8, fwd: 4, aft: 6.5, clewY: 6 }],
    bowsprit: { angle: 32, len: 19, r: 0.55, inboard: 3, drop: 0.5, sprit: { at: 0.72, w: 12, h: 5 } },
    blocks: [
      { t0: 0.0, t1: 0.34, h: 2.5, anchor: 'castel', cabin: true },
      { t0: 0.0, t1: 0.23, h: 2.3, lift: 2.5, cabin: true },
      { t0: 0.0, t1: 0.12, h: 2.1, lift: 4.8 },
      { t0: 0.79, t1: 1.0, h: 2.8, over: 4.5, inset: 1.0 },
      { t0: 0.84, t1: 1.0, h: 1.9, over: 2.5, lift: 2.8, inset: 0.9 },
    ],
    gunports: [{ t0: 0.2, t1: 0.75, dt: 0.07, rel: 3.3, size: 0.6, guns: true, lids: true, inner: 0.9 }, { t0: 0.3, t1: 0.68, dt: 0.08, rel: 0.62, size: 0.45, guns: true }],
    flags: [{ mast: 1, kind: 'christ', w: 3.4, h: 2.2 }, { mast: 0, kind: 'christ', w: 2.6, h: 1.7 }, { mast: 2, kind: 'pennantR', w: 5, h: 0.5 }],
    rudder: { chord: 2.8, top: 3 },
    interior: { decks: [0.9, -2.2], floor: -6.5, cargo: [{ kind: 'sack', t0: 0.32, t1: 0.86, y0: -6.5, y1: -2.45, fill: 0.8 }, { kind: 'crate', t0: 0.14, t1: 0.3, y0: -6.5, y1: -2.45, fill: 0.7 }, { kind: 'cask', t0: 0.55, t1: 0.8, y0: -2.2, y1: 0.4, aisle: 1.2 }], hammocks: { t0: 0.5, t1: 0.78, y: 3.05 }, stove: { t: 0.8, y: 0.9 }, cabin: { t0: 0.02, t1: 0.17, y: 0.9 }, crew: 6 },
    details: { wales: [1.6, 3.1, 4.6, 6.2], anchor: 3.4, capstan: 0.44, hatches: [0.62], crew: 14, lanterns: 1, lanternY: 7.2, lanternT: 0.02 },
  },
  keying: {
    hull: {
      L: 48.8, B: 10.2, F: 3.0, draft: 3.8, sheerB: 2.6, sheerS: 6.5, tm: 0.45, pa: 1.3, pf: 2.4, trS: 0.72, trB: 0.5, paLow: 1.2, pfLow: 1.5, k: 2.6, tumble: 0.0, stemStart: 0.82, stemTop: 0.1, stemPow: 1.6, sternTex: 'junk', bulwark: 1.1,
      color: (t, y, rel) => y < 0.15 ? '#dcd4bf' : y < 0.7 ? '#141414' : (rel > 0.9 && rel < 1.9) ? '#8e1f1a' : (rel > 0.55 && rel < 0.75) ? '#efe7d2' : (rel > 2.1 && rel < 2.3) ? '#2f6b45' : '#1c1a17',
    },
    mastColor: 0x9a7448, mainIndex: 1, sailKind: 'junk',
    masts: [
      { t: 0.86, rake: -9, r: 0.45, segs: [21], shrouds: 0 },
      { t: 0.55, rake: 0, r: 0.65, segs: [30], shrouds: 0 },
      { t: 0.18, rake: 2, r: 0.35, segs: [16], shrouds: 0 },
    ],
    junkSails: [
      { mast: 0, bottom: 4, top: 18, fwd: 2.0, wTop: 7, wBot: 8.5, peak: 2.5, battens: 9 },
      { mast: 1, bottom: 4.5, top: 26, fwd: 3.2, wTop: 11, wBot: 13.5, peak: 4, battens: 12 },
      { mast: 2, bottom: 3, top: 13.5, fwd: 1.4, wTop: 5.5, wBot: 6.5, peak: 2, battens: 7 },
    ],
    blocks: [
      { t0: 0.0, t1: 0.24, h: 2.4, mat: M.red, cabin: true, anchor: 'castel' },
      { t0: 0.0, t1: 0.12, h: 1.8, lift: 2.4, mat: M.red },
      { t0: 0.36, t1: 0.46, h: 1.6, mat: M.wood },
    ],
    oculus: { t: 0.955, rel: 1.6 },
    flags: [{ mast: 1, kind: 'junk', w: 5, h: 1.2 }, { mast: 0, kind: 'junk', w: 3.6, h: 0.9 }, { mast: 2, kind: 'junk', w: 2.6, h: 0.7 }],
    rudder: { chord: 4.5, top: 6, deep: 1.5 },
    interior: { decks: [], floor: -2.9, cargo: [{ kind: 'crate', t0: 0.27, t1: 0.54, y0: -2.9, y1: 1.6, fill: 0.7 }, { kind: 'sack', t0: 0.57, t1: 0.83, y0: -2.9, y1: 1.6, fill: 0.6 }], bulkheads: [0.16, 0.26, 0.36, 0.46, 0.56, 0.66, 0.76, 0.86], crew: 3 },
    details: { wales: [0.85, 1.95], anchor: 3.0, woodAnchor: true, capstan: 0.9, hatches: [0.66], crew: 11, hat: 'cone', lanterns: 2, lanternY: 4.6 },
  },
};

// ---------------------------------------------------------------- scena: apă, cer, lumini
function makeWater() {
  const geo = new THREE.PlaneGeometry(3000, 3000, 220, 220); geo.rotateX(-PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.96 }, uSun: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() }, uFogColor: { value: new THREE.Color(0xc9dcea) } },
    vertexShader: `
      uniform float uTime; varying vec3 vW; varying vec3 vN;
      float h(vec2 p){ return 0.28*sin(p.x*0.11+uTime*0.9)+0.22*sin(p.y*0.13+uTime*1.1)+0.12*sin((p.x+p.y)*0.27+uTime*1.7)+0.06*sin((p.x-p.y)*0.6+uTime*2.3); }
      void main(){ vec3 p = position; float d = length(p.xz); float k = smoothstep(900.0, 300.0, d); p.y += h(p.xz)*k;
        float e=0.5; float hx=(h(p.xz+vec2(e,0.))-h(p.xz-vec2(e,0.)))/(2.*e)*k; float hz=(h(p.xz+vec2(0.,e))-h(p.xz-vec2(0.,e)))/(2.*e)*k;
        vN = normalize(vec3(-hx,1.0,-hz)); vec4 w = modelMatrix*vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform vec3 uSun; uniform float uOpacity; uniform vec3 uFogColor; varying vec3 vW; varying vec3 vN;
      void main(){ vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN);
        float fres = pow(1.0 - max(dot(N,V),0.0), 3.0);
        vec3 deep = vec3(0.03,0.16,0.27); vec3 sky = vec3(0.62,0.76,0.86);
        vec3 col = mix(deep, sky, 0.15 + 0.75*fres);
        vec3 R = reflect(-uSun, N); float spec = pow(max(dot(R,V),0.0), 120.0);
        col += vec3(1.0,0.95,0.8)*spec*0.9;
        float dist = length(vW - cameraPosition); float f = smoothstep(250.0, 1300.0, dist);
        col = mix(col, uFogColor, f);
        gl_FragColor = vec4(col, uOpacity); }`,
  });
  const w = new THREE.Mesh(geo, m); w.renderOrder = 1;
  return w;
}
function makeSky() {
  const g = new THREE.SphereGeometry(2400, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){ float h = vP.y; vec3 top = vec3(0.24,0.5,0.82); vec3 hor = vec3(0.79,0.86,0.92); vec3 bot = vec3(0.1,0.25,0.37);
      vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, bot, pow(-h, 0.4));
      // nori ușori
      float cl = smoothstep(0.55, 1.0, sin(vP.x*9.0+sin(vP.z*7.0)*1.5)*0.5+0.5) * smoothstep(0.02, 0.25, h) * smoothstep(0.6, 0.2, h);
      c = mix(c, vec3(1.0), cl*0.45);
      gl_FragColor = vec4(c,1.0); }`,
  });
  return new THREE.Mesh(g, m);
}
function makeBus() { // autobuz londonez cu etaj (11 m) – pentru comparație
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(11, 4.1, 2.5), red); body.position.y = 2.35; g.add(body);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2a35, roughness: 0.2 });
  for (const y of [1.9, 3.5]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.8, 0.05), glass); w.position.set(0.3, y, s * 1.27); g.add(w); }
  for (const x of [-3.5, 3.5]) for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16), M.black()); wh.rotation.x = PI / 2; wh.position.set(x, 0.5, s * 1.15); g.add(wh); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makePerson() { // Eva, 1,30 m
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8), new THREE.MeshStandardMaterial({ color: 0x7c3aed })); body.position.y = 0.72; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf1c7a5 })); head.position.y = 1.17; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.16), new THREE.MeshStandardMaterial({ color: 0x1e3a8a })); legs.position.y = 0.23; g.add(legs);
  return g;
}

// ---------------------------------------------------------------- vizualizatorul
export class ShipViewer {
  constructor(el, opts = {}) {
    this.el = el; this.opts = opts;
    const W = el.clientWidth || 800, Hh = el.clientHeight || 480;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.thumbs });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(W, Hh);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    el.appendChild(this.renderer.domElement);
    this.cut = 0; this.insideMode = false; this.under = false; this.anim = null;
    this.labelR = new CSS2DRenderer(); this.labelR.setSize(W, Hh);
    Object.assign(this.labelR.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none' });
    el.appendChild(this.labelR.domElement);

    this.scene = new THREE.Scene();
    this.scene.add(makeSky());
    this.water = makeWater(); this.scene.add(this.water);
    const hemi = new THREE.HemisphereLight(0xdfeefc, 0x30455a, 1.1); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.2); sun.position.set(80, 120, 60);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -60; sc.far = 400;
    this.scene.add(sun); this.sun = sun;
    this.camera = new THREE.PerspectiveCamera(38, W / Hh, 0.5, 6000);
    this.camera.position.set(70, 30, 85);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 14, 0); this.controls.enableDamping = true;
    this.controls.minDistance = 25; this.controls.maxDistance = 420;
    this.controls.maxPolarAngle = PI * 0.62;
    this.controls.autoRotateSpeed = 0.6;
    this.ships = {}; this.current = null; this.labels = []; this.showLabels = false; this.sailsUp = true;
    this.clock = new THREE.Clock(); this.running = false;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.onPart = opts.onPart || (() => {});
    // butonul de ecran complet + caseta cu explicația piesei (vizibilă și pe ecran complet)
    const fs = document.createElement('button'); fs.className = 'vfs'; fs.type = 'button'; fs.title = 'Ecran complet'; fs.textContent = '⛶ Ecran complet';
    fs.addEventListener('click', () => this.toggleFull());
    el.appendChild(fs); this.fsBtn = fs;
    const info = document.createElement('div'); info.className = 'vinfo hidden';
    info.innerHTML = '<button type="button" class="x" title="închide">✕</button><div class="t"></div>';
    info.querySelector('.x').addEventListener('click', () => info.classList.add('hidden'));
    el.appendChild(info); this.infoBox = info;
    const onFs = () => { const on = (document.fullscreenElement || document.webkitFullscreenElement) === el; fs.textContent = on ? '✕ Ieși din ecran complet' : '⛶ Ecran complet'; el.classList.toggle('isfull', on); setTimeout(() => this.resize(), 60); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    if (!opts.thumbs) this.makeInteriorUI();
  }
  // ---------------- vizita în interior
  makeInteriorUI() {
    const box = document.createElement('div'); box.className = 'vin';
    box.innerHTML = `<div class="vin-h">🔍 Interiorul corăbiei</div>
      <label class="vin-cut">✂ Taie corabia <input type="range" min="0" max="100" value="0"></label>
      <div class="vin-go">
        <button type="button" data-in="keel">⬆ Intră prin chilă</button>
        <button type="button" data-in="cala">📦 Cala</button>
        <button type="button" data-in="puntea">🪵 Puntea de jos</button>
        <button type="button" data-in="cabina">🧭 Cabina căpitanului</button>
        <button type="button" data-in="out" class="out">↩ Ieși afară</button>
      </div>
      <div class="vin-pad hidden"><span>Mergi:</span>
        <button type="button" data-mv="f" title="înainte (W / ↑)">⬆</button><button type="button" data-mv="b" title="înapoi (S / ↓)">⬇</button>
        <button type="button" data-mv="l" title="stânga (A / ←)">⬅</button><button type="button" data-mv="r" title="dreapta (D / →)">➡</button>
        <button type="button" data-mv="u" title="urcă (E)">⤒</button><button type="button" data-mv="d" title="coboară (Q)">⤓</button></div>
      <button type="button" class="vin-toggle" title="arată / ascunde">▾</button>`;
    this.el.appendChild(box); this.inUI = box;
    const cut = box.querySelector('.vin-cut input');
    cut.addEventListener('input', () => this.setCut(+cut.value / 100));
    this.cutInput = cut;
    box.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => b.dataset.in === 'out' ? this.exitInside() : this.goInside(b.dataset.in)));
    box.querySelectorAll('[data-mv]').forEach(b => {
      let iv = null; const go = () => this.moveCam(b.dataset.mv);
      b.addEventListener('pointerdown', e => { e.preventDefault(); go(); iv = setInterval(go, 90); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => clearInterval(iv)));
    });
    box.querySelector('.vin-toggle').addEventListener('click', () => box.classList.toggle('min'));
    window.addEventListener('keydown', e => {
      if (!this.insideMode || !this.running || !this.el.offsetParent) return;
      const k = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', e: 'u', q: 'd' }[e.key.toLowerCase()];
      if (k) { e.preventDefault(); this.moveCam(k); }
    });
  }
  refreshInteriorUI() {
    if (!this.inUI) return;
    const P = this.current && this.current.userData.inside;
    this.inUI.classList.toggle('hidden', !P || this.compare);
    if (!P) return;
    this.inUI.querySelectorAll('[data-in]').forEach(b => { const k = b.dataset.in; b.classList.toggle('hidden', k === 'out' ? !this.insideMode : !P[k]); });
    this.inUI.querySelector('.vin-pad').classList.toggle('hidden', !this.insideMode);
    this.inUI.querySelector('.vin-cut').classList.toggle('hidden', this.insideMode);
  }
  setCut(v) { this.cut = v; if (this.cutInput) this.cutInput.value = Math.round(v * 100); this.updateWater(); this.updateLabelVis(); }
  updateWater() {
    const see = this.under || this.cut > 0.01 || this.insideMode || !!this.anim;
    this.water.material.uniforms.uOpacity.value = see ? 0.45 : 0.96; this.water.material.depthWrite = !see;
    this.water.visible = !(this.insideMode && !this.anim); // înăuntru nu vedem marea (corpul e închis)
  }
  goInside(spot) {
    const P = this.current && this.current.userData.inside; if (!P || !P[spot]) return;
    const S = P[spot];
    this.setCut(0); this.controls.autoRotate = false;
    this.controls.minDistance = 0.05; this.controls.maxDistance = 8; this.controls.maxPolarAngle = PI;
    this.camera.near = 0.05; this.camera.updateProjectionMatrix();
    const dir = S.look.clone().sub(S.pos).normalize();
    const endCam = S.pos.clone(), endTgt = S.pos.clone().addScaledVector(dir, 0.7);
    if (S.from) { // de sub corabie, urcăm prin chilă în cală
      this.anim = { t: 0, dur: 3.2, c0: S.from.clone(), c1: endCam, g0: V3(S.from.x + 0.5, S.from.y + 6, 0), g1: endTgt };
    } else { this.anim = { t: 0, dur: 1.4, c0: this.camera.position.clone(), c1: endCam, g0: this.controls.target.clone(), g1: endTgt }; }
    this.insideMode = true; this.updateWater(); this.updateLabelVis(); this.refreshInteriorUI();
  }
  exitInside() {
    this.insideMode = false; this.anim = null;
    this.controls.maxPolarAngle = PI * 0.62; this.camera.near = 0.5; this.camera.updateProjectionMatrix();
    this.setShip(this.current.name); this.updateWater();
  }
  moveCam(k) {
    const c = this.camera.position, t = this.controls.target;
    const f = t.clone().sub(c); f.y = 0; if (f.lengthSq() < 1e-6) f.set(1, 0, 0); f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x), d = new THREE.Vector3(), st = 0.45;
    if (k === 'f') d.copy(f).multiplyScalar(st); if (k === 'b') d.copy(f).multiplyScalar(-st);
    if (k === 'r') d.copy(r).multiplyScalar(st); if (k === 'l') d.copy(r).multiplyScalar(-st);
    if (k === 'u') d.set(0, st, 0); if (k === 'd') d.set(0, -st, 0);
    c.add(d); t.add(d);
  }
  updateLabelVis() {
    const showIn = this.cut > 0.15 || this.insideMode;
    this.labels.forEach(l => {
      const key = l.userData.key; if (!key) return;
      const isIn = INTERIOR_KEYS.has(key);
      const on = this.showLabels && (isIn ? showIn : !this.insideMode);
      l.visible = on; l.element.style.display = on ? '' : 'none';
    });
  }
  applyClip() {
    if (this.cut <= 0.001 || this.compare || !this.current) { CLIP_PLANE.constant = 1e4; return; }
    const d = this.camera.position.clone().sub(this.controls.target); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
    const B = this.current.userData.hull.B;
    CLIP_PLANE.normal.set(-d.x, 0, -d.z);
    CLIP_PLANE.constant = lerp(B / 2 + 1.5, -0.4, this.cut);
  }
  toggleFull() {
    const el = this.el, cur = document.fullscreenElement || document.webkitFullscreenElement;
    if (cur === el) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => this.fakeFull());
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else this.fakeFull();
  }
  fakeFull() { // pentru iPhone, unde nu există ecran complet: mărim caseta peste toată pagina
    const on = !this.el.classList.contains('pseudofull');
    this.el.classList.toggle('pseudofull', on); this.el.classList.toggle('isfull', on);
    this.fsBtn.textContent = on ? '✕ Ieși din ecran complet' : '⛶ Ecran complet';
    setTimeout(() => this.resize(), 60);
  }
  showInfo(html) { this.infoBox.querySelector('.t').innerHTML = html; this.infoBox.classList.remove('hidden'); }
  resize() {
    const W = this.el.clientWidth, Hh = this.el.clientHeight; if (!W || !Hh) return;
    this.renderer.setSize(W, Hh); this.labelR.setSize(W, Hh);
    this.camera.aspect = W / Hh; this.camera.updateProjectionMatrix();
  }
  getShip(id) { return this.ships[id] || (this.ships[id] = buildShip(id)); }
  clearScene() {
    for (const id in this.ships) this.scene.remove(this.ships[id]);
    if (this.extra) { this.extra.forEach(o => this.scene.remove(o)); this.extra = null; }
    this.labels.forEach(l => l.parent && l.parent.remove(l)); this.labels = [];
  }
  setShip(id, keepView) {
    this.clearScene(); this.compare = false;
    const s = this.getShip(id); s.position.set(0, 0, 0); this.scene.add(s); this.current = s;
    const L = s.userData.length;
    this.controls.target.set(0, s.userData.height * 0.38, 0);
    if (!keepView) { this.camera.position.set(L * 0.72, s.userData.height * 0.45, L * 0.95); }
    this.controls.minDistance = 20; this.controls.maxDistance = 320;
    this.sun.shadow.camera.left = -L; this.sun.shadow.camera.right = L; this.sun.shadow.camera.updateProjectionMatrix();
    for (const k in this.ships) (this.ships[k].userData.lights || []).forEach(l => l.visible = this.ships[k] === s);
    if (this.insideMode) { this.insideMode = false; this.anim = null; this.controls.maxPolarAngle = PI * 0.62; this.camera.near = 0.5; this.camera.updateProjectionMatrix(); }
    this.setCut(0);
    this.applySails(); this.makeLabels(); this.updateLabelVis(); this.refreshInteriorUI();
  }
  setCompare() {
    this.clearScene(); this.compare = true; this.current = null;
    const order = ['madre', 'hindostan', 'cutty', 'keying'];
    let x = 0; const gap = 18; const extra = [];
    order.forEach(id => {
      const s = this.getShip(id); const L = s.userData.length;
      s.position.set(x + L / 2, 0, 0); x += L + gap; this.scene.add(s);
      const div = document.createElement('div'); div.className = 'lbl3d name'; div.textContent = SHIP_INFO[id].name + ' · ' + SHIP_INFO[id].year;
      const o = new CSS2DObject(div); o.position.set(0, s.userData.height + 4, 0); s.add(o); this.labels.push(o);
    });
    const total = x - gap; const offs = -total / 2;
    order.forEach(id => { this.ships[id].position.x += offs; });
    const quay = new THREE.Mesh(new THREE.BoxGeometry(total + 60, 3, 16), new THREE.MeshStandardMaterial({ color: 0x8d8579, roughness: 0.95 }));
    quay.position.set(0, 1.2, 21); quay.receiveShadow = true; extra.push(quay);
    const bus = makeBus(); bus.position.set(-20, 2.7, 22); extra.push(bus);
    const eva = makePerson(); eva.position.set(-29, 2.7, 25); eva.scale.setScalar(1); extra.push(eva);
    const bl = document.createElement('div'); bl.className = 'lbl3d small'; bl.textContent = 'autobuz londonez (11 m) și Eva (1,30 m)';
    const bo = new CSS2DObject(bl); bo.position.set(0, 7, 0); bus.add(bo); this.labels.push(bo);
    extra.forEach(o => this.scene.add(o)); this.extra = extra;
    this.controls.target.set(0, 14, 0); this.camera.position.set(0, 26, total * 0.95);
    this.controls.minDistance = 30; this.controls.maxDistance = 700;
    this.sun.shadow.camera.left = -total / 2 - 20; this.sun.shadow.camera.right = total / 2 + 20; this.sun.shadow.camera.updateProjectionMatrix();
    for (const k in this.ships) (this.ships[k].userData.lights || []).forEach(l => l.visible = false);
    this.insideMode = false; this.anim = null; this.controls.maxPolarAngle = PI * 0.62; this.camera.near = 0.5; this.camera.updateProjectionMatrix(); this.setCut(0);
    this.applySails(); this.refreshInteriorUI();
  }
  makeLabels() {
    if (!this.current) return;
    const a = this.current.userData.anchors;
    for (const key in a) {
      if (!PARTS[key] || !a[key]) continue;
      const div = document.createElement('button'); div.className = 'lbl3d part'; div.textContent = PARTS[key].ro.replace(/ \(.*/, '');
      div.addEventListener('click', e => { e.stopPropagation(); this.onPart(key); if (this.el.classList.contains('isfull')) this.showInfo(`<b>${PARTS[key].ro}</b><br>${PARTS[key].d}`); });
      const o = new CSS2DObject(div); o.userData.key = key; o.position.copy(a[key]); o.visible = this.showLabels; this.current.add(o); this.labels.push(o);
    }
  }
  setLabels(on) { this.showLabels = on; if (!this.compare) this.updateLabelVis(); }
  setSails(up) { this.sailsUp = up; this.applySails(); }
  applySails() {
    for (const id in this.ships) { const u = this.ships[id].userData; u.sails.forEach(s => s.visible = this.sailsUp); u.furled.forEach(f => f.visible = !this.sailsUp); }
  }
  setUnderwater(on) { this.under = on; this.updateWater(); }
  setAuto(on) { this.controls.autoRotate = on; }
  view(name) {
    if (!this.current) return;
    const L = this.current.userData.length, H = this.current.userData.height;
    const p = { side: [0, H * 0.4, L * 1.5], bow: [L * 1.4, H * 0.35, L * 0.2], stern: [-L * 1.3, H * 0.4, L * 0.35], top: [0.1, L * 1.8, 0.1], deck: [-L * 0.55, 13, L * 0.12] }[name];
    this.camera.position.set(...p);
    if (name === 'deck') this.controls.target.set(L * 0.15, 5, 0); else this.controls.target.set(0, H * 0.38, 0);
  }
  start() {
    if (this.running) return; this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const t = this.clock.getElapsedTime();
      this.water.material.uniforms.uTime.value = t;
      for (const id in this.ships) {
        const s = this.ships[id]; if (!s.parent) continue;
        const calm = this.insideMode ? 0.25 : 1; // înăuntru legănăm mai puțin, să nu amețim
        s.rotation.z = Math.sin(t * 0.6 + s.position.x) * 0.006 * calm; s.rotation.x = Math.sin(t * 0.8 + s.position.x) * 0.012 * calm; s.position.y = Math.sin(t * 0.9) * 0.12 * calm;
        for (const f of s.userData.flags) {
          const p = f.geometry.attributes.position, b = f.userData.base;
          for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 1.3 - t * 6) * 0.25 * (-x / f.userData.w)); }
          p.needsUpdate = true;
        }
      }
      if (this.anim) {
        const a = this.anim; const nowT = performance.now() / 1000; if (a.last == null) a.last = nowT; a.t += Math.min(0.1, nowT - a.last); a.last = nowT; const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
        this.camera.position.lerpVectors(a.c0, a.c1, e); this.controls.target.lerpVectors(a.g0, a.g1, e);
        if (k >= 1) { this.anim = null; this.updateWater(); }
      }
      this.controls.update();
      this.applyClip();
      this.renderer.render(this.scene, this.camera);
      this.labelR.render(this.scene, this.camera);
    };
    loop();
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  snapshot(id, w = 360, h = 220) { // imagine fixă a unei corăbii (pentru cronologie și alegerea corăbiei)
    const keep = { sz: this.renderer.getSize(new THREE.Vector2()), cam: this.camera.position.clone(), tgt: this.controls.target.clone(), cur: this.current ? this.current.name : null, cmp: this.compare };
    this.setShip(id);
    const s = this.current, L = s.userData.length, H = s.userData.height;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.camera.position.set(L * 0.85, H * 0.35, L * 1.05); this.controls.target.set(0, H * 0.4, 0); this.controls.update();
    this.labels.forEach(l => l.visible = false);
    CLIP_PLANE.constant = 1e4;
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/jpeg', 0.85);
    this.renderer.setSize(keep.sz.x, keep.sz.y); this.resize();
    if (keep.cmp) this.setCompare(); else if (keep.cur) this.setShip(keep.cur, true);
    this.camera.position.copy(keep.cam); this.controls.target.copy(keep.tgt);
    this.setLabels(this.showLabels);
    return url;
  }
}
