# ⛵ Corăbii spre China

Aplicație interactivă pentru Eva (8 ani, sistemul britanic, Year 4): **marele drum al corăbiilor cu pânze din Anglia până în China**. Merge pe calculator, tabletă și telefon. Nu are nevoie de internet: dublu-click pe `index.html`.

🌐 **Română / English**: butoanele **RO | EN** din antet schimbă limba întregii aplicații (texte, hărți, desene, jocuri, quiz-uri, denumirile din 3D); alegerea se ține minte. Link direct în engleză: `?lang=en` (ex. https://beldugan.github.io/corabii-spre-china/?lang=en). Comenzile marinărești rămân bilingve în ambele limbi.

Pagina live: https://beldugan.github.io/corabii-spre-china/

## Cele opt secțiuni

| Secțiunea | Ce face copilul | Ce învață |
|---|---|---|
| ⚓ **1. Cum se conduce** | Corabie 3D cu etichete pe care se apasă (catarg, vergă, cârmă, wanturi, ancoră, cabestan…) · rotește corabia față de vânt și reglează vergile · animația virării prin vânt și prin pupa, cu comenzile reale RO/EN · lochul cu noduri: numără nodurile cât curge clepsidra | cursurile față de vânt, zona „în vânt”, brațarea vergilor, zig-zagul, de unde vine „nodul” |
| 🚢 **2. Corăbiile 3D** | 4 corăbii reale, modelate în 3D, rotite din toate unghiurile: **Madre de Deus** (carracă, 1589), **Hindostan** (East Indiaman, 1789), **Cutty Sark** (cliper, 1869), **Keying** (joncă, 1846) · pânze sus/strânse, denumiri, sub apă, vedere de pe punte, ecran complet · **interiorul**: tăiere în secțiune, intrare prin chilă, cala cu lăzi de ceai / porțelan / mirodenii, puntea tunurilor cu hamace, cabina căpitanului, pompe, coaste, balast, pereții etanși ai joncii, deplasare cu W A S D · comparația mărimilor cu un autobuz londonez și cu Eva | tipurile de corăbii, cum au evoluat, date reale |
| 🔧 **3. Forțele pe corabie** | Secțiune transversală animată (Hindostan, 1.200 t): vântul pe scara Beaufort, pânze strânse sau nu, balast, valuri · se văd greutatea (G), împingerea apei (B), brațul de redresare, presiunea apei pe corp, wanturile întinse/slăbite, compresiunea catargului până în chilă, răsturnarea · corabia pe val (cocoașă / șa) · construcția catargului în 9 pași (cep în lăcaș, parteneri și pene, catarg din bucăți cu cercuri de fier, cuiul gabierului, ochii de lemn, lanțuri, straiuri) · de ce triunghiuri · experimente acasă + quiz | întindere, compresiune, încovoiere, presiunea apei, stabilitate, pârghie, scripete, structuri triunghiulare |
| 🌬️ **4. Vânturi și curenți** | Hartă Mercator animată: vânturile (alizee, calmele ecuatoriale, Patruzecile urlătoare, musonul vara/iarna) și 13 curenți oceanici, calzi și reci · se apasă pe hartă pentru explicații | circulația atmosferică și oceanică, de ce drumul face ocolul prin vest |
| 📜 **4. Istoria** | Cronologie 1405–azi (Zheng He, Vasco da Gama, Compania Indiilor de Est, Macartney, cursa ceaiului din 1866, Cutty Sark) + quiz | istoria comerțului pe mare cu China |
| 🧭 **5. Călătoria** | Simularea zi cu zi pe harta reală: Cutty Sark (Londra → Shanghai, 1870) sau Hindostan (Portsmouth → Canton, 1792, cu opririle reale) · luna plecării schimbă musonul · 3 decizii ale căpitanului · jurnal de bord | distanțe, timp, calendar, mile marine/km, consecințele deciziilor |
| 🎮 **6. Academia navigatorilor** | 5 misiuni (~20 min): butoaiele (reglarea pânzelor), geamandurile din ceață (doar busola), intrarea în port (zig-zag printre stânci), semnalele cu steaguri (memorie + cod), marea cursă a ceaiului contra cliperului Taeping | motricitate fină (roata cârmei trasă în cerc, glisorul, drag & drop), orientare, planificare, memorie de lucru |
| 🧩 **7. Problema zilei** | Problemă în stilul Cangurului (catargele din port) + problemă de rezervă mai grea (canalul îngust), cu ajutoare progresive, laborator interactiv și soluții | raționament, „presupunem că toate sunt la fel”, raționament despre limite |

## Structura

```
index.html
assets/css/style.css     – stilul comun al seriei
assets/css/corabii.css   – stilul aplicației
assets/js/app.js         – tot codul, într-un singur fișier (generat din src/)
src/                     – sursele (Three.js, d3-geo, topojson)
  ships3d.js  shipdata.js   – corăbiile 3D și datele lor
  maneuver.js sailing.js topship.js – manevrele și fizica velierului
  map.js geo.js voyage.js   – harta, vânturile, curenții, simularea
  history.js game.js flags.js problem.js progress.js main.js
  forces.js                 – forțele pe corabie
  i18n.js                   – comutatorul RO | EN și traducerea textului fix din index.html
  lang/en.json              – traducerile textelor din cod (cheia = textul românesc exact)
  lang/en-html.json         – traducerile textului fix din pagină
tools/build.mjs          – build-ul (esbuild + înlocuirea textelor RO/EN)
build.sh                 – reface assets/js/app.js
```

Pentru a reface fișierul `app.js` după o modificare în `src/`: `npm i three@0.160.0 d3-geo@3.1.0 topojson-client@3.1.0 esbuild@0.20.2 acorn@8.11.3 acorn-walk@8.3.2`, apoi `sh build.sh`.

**Despre traduceri.** La build, fiecare text românesc din cod care apare în `src/lang/en.json` primește varianta engleză. Dacă modifici un text în română, actualizează și cheia lui din `en.json` (altfel, în modul EN apare textul românesc). Build-ul afișează câte texte a tradus.

**Tachelajul 3D (parâmele).** Numărul wanturilor e cel istoric aproximativ (Hindostan 9/9/6 pe fiecare parte, Cutty Sark 5/5/4, Madre de Deus 6/9/4/3), cu treptele (ratlines) la cca 38 cm, wanturi de gabier cu trepte și wanturi de sub gabie (futtock), wanturi de zburător, pataraine, sub-bompres, mantile până la capul catargului, brațe conduse ca în realitate, scote și mure la pânzele mari. Manevrele fixe sunt gudronate (închise la culoare), cele curente din cânepă deschisă.

Datele uscatului: Natural Earth / world-atlas (domeniu public). Modelele 3D sunt reconstituiri după desene și descrieri istorice; cifrele sunt aproximative.
