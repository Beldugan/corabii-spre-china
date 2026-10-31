// Reface assets/js/app.js din src/, cu modulul de limbă RO / EN.
// Fiecare text românesc din cod care are traducere în src/lang/en.json devine
// (__EN ? "english" : "română"); șabloanele `...${x}...` devin __F(model, [x]).
// Rulare: node tools/build.mjs   (necesită: npm i three@0.160.0 d3-geo@3.1.0 topojson-client@3.1.0 esbuild@0.20.2 acorn@8.11.3 acorn-walk@8.3.2)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DICT = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lang/en.json'), 'utf8'));
const used = new Set();

function collect(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  const items = [];
  walk.fullAncestor(ast, (n, _st, anc) => {
    const p = anc[anc.length - 2];
    if (n.type === 'Literal' && typeof n.value === 'string') {
      if (p && ((p.type === 'Property' && p.key === n && !p.computed) || p.type === 'ImportDeclaration' ||
        p.type === 'ExportNamedDeclaration' || p.type === 'ExportAllDeclaration' ||
        (p.type === 'MemberExpression' && p.property === n) || p.type === 'ExpressionStatement')) return;
      items.push({ node: n, key: n.value, kind: 'lit' });
    } else if (n.type === 'TemplateLiteral') {
      if (p && p.type === 'TaggedTemplateExpression') return;
      const key = n.quasis.map((q, i) => q.value.cooked + (i < n.expressions.length ? '${' + i + '}' : '')).join('');
      items.push({ node: n, key, kind: 'tpl' });
    }
  });
  return items;
}

function transform(code) {
  // zecimale: virgulă în română, punct în engleză
  code = code.replace(/\.replace\('\.', ','\)/g, ".replace('.', __EN ? '.' : ',')")
    .replace(/toLocaleString\('ro-RO'\)/g, "toLocaleString(__EN ? 'en-GB' : 'ro-RO')");
  const reps = collect(code).filter(it => DICT[it.key] !== undefined && DICT[it.key] !== it.key);
  reps.sort((a, b) => a.node.start - b.node.start);
  // textul unei porțiuni [s,e) cu înlocuirile din interior aplicate
  function render(s, e, list) {
    let out = '', pos = s;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.node.start < pos || r.node.end > e) continue;
      // înlocuirile cuprinse în r
      const inner = list.filter(x => x !== r && x.node.start >= r.node.start && x.node.end <= r.node.end);
      out += code.slice(pos, r.node.start) + repl(r, inner);
      pos = r.node.end;
    }
    return out + code.slice(pos, e);
  }
  function repl(r, inner) {
    used.add(r.key);
    const en = DICT[r.key];
    if (r.kind === 'lit') return `(__EN?${JSON.stringify(en)}:${JSON.stringify(r.key)})`;
    const ex = r.node.expressions.map(x => render(x.start, x.end, inner));
    return `__F(__EN?${JSON.stringify(en)}:${JSON.stringify(r.key)},[${ex.join(',')}])`;
  }
  return render(0, code.length, reps);
}

const BANNER = `var __LANG=(function(){try{var q=new URLSearchParams(location.search).get('lang');if(q==='en'||q==='ro'){localStorage.setItem('corabii-lang',q);return q;}var s=localStorage.getItem('corabii-lang');if(s==='en'||s==='ro')return s;}catch(e){}return 'ro';})();var __EN=__LANG==='en';function __F(p,a){return p.replace(/\\$\\{(\\d+)\\}/g,function(_,i){return String(a[+i]);});}`;

const NM = process.env.NM || path.join(ROOT, 'node_modules');
await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2019',
  loader: { '.json': 'json' },
  outfile: path.join(ROOT, 'assets/js/app.js'),
  alias: { three: path.join(NM, 'three') },
  nodePaths: [NM],
  banner: { js: BANNER },
  logLevel: 'warning',
  plugins: [{
    name: 'i18n',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/][^\\/]+\.js$/ }, async a => ({ contents: transform(await fs.promises.readFile(a.path, 'utf8')), loader: 'js' }));
    },
  }],
});
const html = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lang/en-html.json'), 'utf8'));
const unused = Object.keys(DICT).filter(k => !used.has(k) && !(k in html));
console.log(`app.js gata · ${used.size} texte traduse în cod` + (unused.length ? ` · ${unused.length} intrări nefolosite` : ''));
if (process.env.SHOW_UNUSED) unused.forEach(u => console.log('  nefolosit:', u.slice(0, 90)));
