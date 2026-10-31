// Modulul de limbă RO / EN.
// Textele din cod sunt traduse la build (tools/build.mjs, src/lang/en.json).
// Aici: traducerea textului fix din index.html (src/lang/en-html.json) și comutatorul RO | EN.
// Limba se alege cu butoanele din antet sau cu ?lang=en / ?lang=ro în adresă; se ține minte în browser.
import HTML_EN from './lang/en-html.json';

/* global __LANG */
export const LANG = __LANG;

const INLINE = new Set(['B', 'I', 'EM', 'STRONG', 'SMALL', 'SPAN', 'A', 'BR', 'SUP', 'SUB', 'CODE', 'KBD', 'U', 'S', 'MARK', 'IMG', 'INPUT', 'ABBR', 'WBR']);
const ATTRS = ['title', 'alt', 'placeholder', 'aria-label'];
const norm = s => s.replace(/\s+/g, ' ').trim();
const allInline = el => [...el.children].every(c => INLINE.has(c.tagName) && allInline(c));

function translateAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute && el.getAttribute(a);
    if (v && HTML_EN[norm(v)] !== undefined) el.setAttribute(a, HTML_EN[norm(v)]);
  }
}

function translateTree(root) {
  root.querySelectorAll('*').forEach(translateAttrs);
  const walkEl = el => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    if (!INLINE.has(el.tagName) && el.children.length && allInline(el) || (!el.children.length && el.childNodes.length)) {
      const k = norm(el.textContent);
      if (k && HTML_EN[k] !== undefined) { el.innerHTML = HTML_EN[k]; return; }
    }
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 3) {
        const k = norm(c.nodeValue);
        if (k && HTML_EN[k] !== undefined) {
          const lead = c.nodeValue.match(/^\s*/)[0], tail = c.nodeValue.match(/\s*$/)[0];
          c.nodeValue = lead + HTML_EN[k] + tail;
        }
      } else if (c.nodeType === 1) walkEl(c);
    }
  };
  walkEl(root);
}

function addSwitch() {
  const badges = document.querySelector('header.top .badges');
  if (!badges || document.getElementById('langRo')) return;
  const mk = (id, l) => {
    const b = document.createElement('button');
    b.className = 'pill'; b.id = id; b.textContent = l.toUpperCase();
    b.setAttribute('aria-pressed', String(LANG === l));
    b.title = l === 'ro' ? 'Română' : 'English';
    b.addEventListener('click', () => {
      if (LANG === l) return;
      try { localStorage.setItem('corabii-lang', l); } catch (e) { /* */ }
      const u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.href); } else location.reload();
    });
    return b;
  };
  badges.insertBefore(mk('langEn', 'en'), badges.firstChild);
  badges.insertBefore(mk('langRo', 'ro'), badges.firstChild);
}

document.documentElement.lang = LANG;
if (LANG === 'en') {
  const t = HTML_EN[norm(document.title)]; if (t) document.title = t;
  const d = document.querySelector('meta[name="description"]');
  if (d && HTML_EN[norm(d.content)]) d.content = HTML_EN[norm(d.content)];
  translateTree(document.body);
}
addSwitch();
