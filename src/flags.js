// Steagurile Codului internațional de semnale (cele folosite în joc), desenate în SVG.
const R = '#c8102e', Bl = '#0b3d91', Y = '#f6c90e', W = '#ffffff', K = '#111111';

const DEF = {
  A: `<path d="M0 0H30V40H0Z" fill="${W}"/><path d="M30 0H60L45 20L60 40H30Z" fill="${Bl}"/>`,
  B: `<path d="M0 0H60L45 20L60 40H0Z" fill="${R}"/>`,
  C: `<rect width="60" height="8" fill="${Bl}"/><rect y="8" width="60" height="8" fill="${W}"/><rect y="16" width="60" height="8" fill="${R}"/><rect y="24" width="60" height="8" fill="${W}"/><rect y="32" width="60" height="8" fill="${Bl}"/>`,
  D: `<rect width="60" height="40" fill="${Y}"/><rect y="10" width="60" height="20" fill="${Bl}"/>`,
  E: `<rect width="60" height="20" fill="${Bl}"/><rect y="20" width="60" height="20" fill="${R}"/>`,
  F: `<rect width="60" height="40" fill="${W}"/><path d="M30 2L57 20L30 38L3 20Z" fill="${R}"/>`,
  G: [0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 10}" width="10" height="40" fill="${i % 2 ? Bl : Y}"/>`).join(''),
  H: `<rect width="30" height="40" fill="${W}"/><rect x="30" width="30" height="40" fill="${R}"/>`,
  I: `<rect width="60" height="40" fill="${Y}"/><circle cx="30" cy="20" r="11" fill="${K}"/>`,
  J: `<rect width="60" height="40" fill="${Bl}"/><rect y="13" width="60" height="14" fill="${W}"/>`,
  K: `<rect width="30" height="40" fill="${Y}"/><rect x="30" width="30" height="40" fill="${Bl}"/>`,
  L: `<rect width="30" height="20" fill="${Y}"/><rect x="30" width="30" height="20" fill="${K}"/><rect y="20" width="30" height="20" fill="${K}"/><rect x="30" y="20" width="30" height="20" fill="${Y}"/>`,
  M: `<rect width="60" height="40" fill="${Bl}"/><path d="M0 0L60 40M60 0L0 40" stroke="${W}" stroke-width="9"/>`,
  N: [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => `<rect x="${c * 15}" y="${r * 10}" width="15" height="10" fill="${(r + c) % 2 ? W : Bl}"/>`).join('')).join(''),
  P: `<rect width="60" height="40" fill="${Bl}"/><rect x="18" y="12" width="24" height="16" fill="${W}"/>`,
  Q: `<rect width="60" height="40" fill="${Y}"/>`,
  R: `<rect width="60" height="40" fill="${R}"/><rect x="25" width="10" height="40" fill="${Y}"/><rect y="15" width="60" height="10" fill="${Y}"/>`,
  S: `<rect width="60" height="40" fill="${W}"/><rect x="18" y="12" width="24" height="16" fill="${Bl}"/>`,
  T: `<rect width="20" height="40" fill="${R}"/><rect x="20" width="20" height="40" fill="${W}"/><rect x="40" width="20" height="40" fill="${Bl}"/>`,
  U: `<rect width="30" height="20" fill="${R}"/><rect x="30" width="30" height="20" fill="${W}"/><rect y="20" width="30" height="20" fill="${W}"/><rect x="30" y="20" width="30" height="20" fill="${R}"/>`,
  V: `<rect width="60" height="40" fill="${W}"/><path d="M0 0L60 40M60 0L0 40" stroke="${R}" stroke-width="9"/>`,
  W: `<rect width="60" height="40" fill="${Bl}"/><rect x="8" y="6" width="44" height="28" fill="${W}"/><rect x="18" y="13" width="24" height="14" fill="${R}"/>`,
  X: `<rect width="60" height="40" fill="${W}"/><rect x="25" width="10" height="40" fill="${Bl}"/><rect y="15" width="60" height="10" fill="${Bl}"/>`,
  Y: `<rect width="60" height="40" fill="${Y}"/>` + [-40, -24, -8, 8, 24, 40, 56].map(x => `<path d="M${x} 40L${x + 40} 0L${x + 48} 0L${x + 8} 40Z" fill="${R}"/>`).join(''),
};
export const FLAG_LETTERS = Object.keys(DEF);
export const MEANINGS = {
  P: '„Blue Peter”: toți marinarii la bord, corabia pleacă în curând.',
  A: 'Am un scafandru în apă: treceți încet!',
  V: 'Am nevoie de ajutor.',
  W: 'Am nevoie de un doctor.',
  N: 'Nu (No).',
  C: 'Da (Yes).',
};
export function flagSVG(letter, w = 60) {
  return `<svg class="flag" viewBox="0 0 60 40" width="${w}" height="${w * 2 / 3}" aria-label="steagul ${letter}"><g>${DEF[letter]}</g><rect width="60" height="40" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}
