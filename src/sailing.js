// Fizica simplificată a unei corăbii cu pânze pătrate (vedere de sus).
// Convenții: unghiurile sunt în grade „de busolă”: 0 = Nord (sus), 90 = Est (dreapta).
// windFrom = direcția DIN care bate vântul (ca la meteo).

export const D2R = Math.PI / 180;

export function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
export function angDiff(a, b) { // diferența semnată b - a, în [-180, 180]
  let d = norm360(b - a);
  return d > 180 ? d - 360 : d;
}
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

// unghiul dintre direcția corăbiei și direcția din care vine vântul: 0 = drept în vânt, 180 = vânt din pupa
export function offWind(heading, windFrom) { return Math.abs(angDiff(heading, windFrom)); }

// cât de repede poate merge corabia la un anumit unghi față de vânt (0..1)
export function polar(a, noGo = 60) {
  if (a < noGo) return 0;
  if (a < noGo + 15) return lerp(0.35, 0.6, (a - noGo) / 15);
  if (a < 100) return lerp(0.6, 0.9, (a - noGo - 15) / (100 - noGo - 15));
  if (a < 150) return lerp(0.9, 1.0, (a - 100) / 50);
  return lerp(1.0, 0.85, (a - 150) / 30);
}

// cât de mult trebuie rotite (brațate) vergile pentru unghiul dat
export function optimalBrace(a) { return clamp((180 - a) * 0.55, 0, 65); }

// cât de bine sunt reglate pânzele (0..1)
export function trimEff(a, brace) {
  const err = Math.abs(brace - optimalBrace(a));
  return Math.cos(clamp(err * 2, 0, 90) * D2R);
}

export function pointOfSail(a, noGo = 60) {
  if (a < noGo) return { ro: 'În vânt — pânzele fâlfâie, corabia se oprește', en: 'In irons', key: 'irons', col: '#dc2626' };
  if (a < noGo + 22) return { ro: 'La vânt strâns', en: 'Close-hauled', key: 'close', col: '#f97316' };
  if (a < 112) return { ro: 'Vânt de travers (din lateral)', en: 'Beam reach', key: 'beam', col: '#eab308' };
  if (a < 158) return { ro: 'Vânt larg (din spate-lateral)', en: 'Broad reach', key: 'broad', col: '#16a34a' };
  return { ro: 'Vânt de pupa (din spate)', en: 'Running', key: 'run', col: '#0ea5e9' };
}

// Un „motor” de corabie folosit în jocuri.
export class Boat {
  constructor(o = {}) {
    this.x = o.x || 0; this.y = o.y || 0;
    this.heading = o.heading ?? 45;
    this.speed = 0;              // px/s
    this.maxSpeed = o.maxSpeed || 120;
    this.noGo = o.noGo || 58;
    this.brace = o.brace ?? 30;  // 0..65
    this.rudder = 0;             // -1..1
    this.eff = 0; this.pol = 0;
    this.vx = 0; this.vy = 0;
  }
  update(dt, windFrom, windStrength = 1) {
    const a = offWind(this.heading, windFrom);
    this.pol = polar(a, this.noGo);
    this.eff = this.pol > 0 ? Math.max(0, trimEff(a, this.brace)) : 0;
    const target = this.maxSpeed * windStrength * this.pol * (0.15 + 0.85 * this.eff);
    const k = target > this.speed ? 0.55 : 0.8; // accelerează încet, frânează mai repede
    this.speed += (target - this.speed) * Math.min(1, k * dt);
    // cârma: corabia se întoarce mai bine când are viteză
    const turnRate = 9 + 30 * clamp(this.speed / this.maxSpeed, 0, 1);
    this.heading = norm360(this.heading + this.rudder * turnRate * dt);
    const hx = Math.sin(this.heading * D2R), hy = -Math.cos(this.heading * D2R);
    // vântul împinge puțin corabia în lateral (deriva)
    const wTo = (windFrom + 180) * D2R;
    const drift = 7 * windStrength;
    this.vx = hx * this.speed + Math.sin(wTo) * drift;
    this.vy = hy * this.speed - Math.cos(wTo) * drift;
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
  knots() { return this.speed / 10; }
}
