// Date geografice: vânturi, curenți, trasee (longitudine, latitudine).

export const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

// zonele de vânt, cu explicații pentru Eva
export const WIND_ZONES = {
  westN: { name: 'Vânturile de vest (Westerlies)', col: '#93c5fd', d: 'Bat dinspre vest spre est, peste Anglia și Atlantic. Aduc ploile Angliei! La plecare, corăbiile le aveau din față și se luptau zile întregi ca să iasă din Canalul Mânecii.' },
  horseN: { name: 'Latitudinile cailor (Horse latitudes)', col: '#fde68a', d: 'Zone cu vânt slab și schimbător. Se spune că pe vremuri, când corăbiile stăteau pe loc și rămâneau fără apă, marinarii aruncau caii peste bord. De aici numele ciudat.' },
  tradeNE: { name: 'Alizeele de nord-est (NE trade winds)', col: '#86efac', d: 'Vânturi constante care bat tot anul dinspre nord-est. Corăbiile le prindeau lângă Insulele Canare și alunecau ușor spre sud. „Trade winds” înseamnă „vânturile comerțului”.' },
  doldrums: { name: 'Calmele ecuatoriale (Doldrums)', col: '#fca5a5', d: 'La Ecuator aerul fierbinte urcă în sus, așa că aproape nu bate vântul. Corăbiile puteau sta pe loc săptămâni întregi, sub soare și ploi cu tunete. Marinarii le urau!' },
  tradeSE: { name: 'Alizeele de sud-est (SE trade winds)', col: '#86efac', d: 'Ca alizeele de nord-est, dar în emisfera sudică: bat dinspre sud-est. Împing corăbiile spre Brazilia, așa că drumul spre Africa de Sud face un ocol mare prin vest.' },
  horseS: { name: 'Latitudinile cailor de sud', col: '#fde68a', d: 'Încă o zonă cu vânt slab, între alizee și vânturile de vest din sud.' },
  forties: { name: '„Patruzecile urlătoare” (Roaring Forties)', col: '#c4b5fd', d: 'Între paralelele de 40° și 50° sud, vântul bate foarte tare dinspre vest, fără uscat care să-l oprească, în jurul întregului Pământ. Valuri uriașe, frig și aisberguri, dar cea mai rapidă cale spre est! Clipere ca Cutty Sark mergeau aici peste 300 de mile pe zi.' },
  polar: { name: 'Vânturile polare', col: '#e2e8f0', d: 'Lângă Antarctica: vânturi reci dinspre est. Corăbiile nu mergeau atât de la sud.' },
  monsoonSW: { name: 'Musonul de sud-vest (vara)', col: '#fdba74', d: 'Din mai până în septembrie, uscatul Asiei se încălzește tare și „trage” aerul de pe ocean: vântul bate dinspre sud-vest. Era vântul bun pentru a ajunge în China! Corăbiile își potriveau plecarea din Anglia ca să ajungă aici vara.' },
  monsoonNE: { name: 'Musonul de nord-est (iarna)', col: '#fdba74', d: 'Din noiembrie până în martie, Asia se răcește și vântul se întoarce: bate dinspre nord-est. Bun pentru drumul înapoi din China spre Anglia, dar foarte greu pentru cine vrea să ajungă în China.' },
};

// tabel pe latitudine: [lat, u (spre est), v (spre nord), zona]
const T = [[-75, -0.4, 0.1, 'polar'], [-62, 0.8, 0, 'forties'], [-52, 1.5, -0.1, 'forties'], [-40, 1.3, 0.05, 'forties'], [-34, 0.45, 0.1, 'horseS'], [-28, -0.3, 0.3, 'horseS'], [-20, -0.85, 0.5, 'tradeSE'], [-8, -0.8, 0.45, 'tradeSE'], [0, -0.3, 0.2, 'doldrums'], [4, -0.05, 0, 'doldrums'], [8, -0.6, -0.35, 'tradeNE'], [18, -0.9, -0.45, 'tradeNE'], [27, -0.45, -0.25, 'horseN'], [33, 0.3, 0.05, 'horseN'], [42, 1.0, 0.25, 'westN'], [55, 1.05, 0.3, 'westN'], [70, 0.3, 0, 'westN']];

export function isMonsoon(lon, lat) {
  return (lat > -3 && lat < 28 && lon > 45 && lon < 100) || (lat > -4 && lat < 32 && lon >= 100 && lon < 128);
}
export function windAt(lon, lat, season = 'summer') {
  if (isMonsoon(lon, lat)) {
    const s = season === 'summer' ? 1 : -1;
    return { u: 0.8 * s, v: 0.6 * s, zone: season === 'summer' ? 'monsoonSW' : 'monsoonNE' };
  }
  let i = 0; while (i < T.length - 2 && T[i + 1][0] < lat) i++;
  const a = T[i], b = T[i + 1], k = Math.max(0, Math.min(1, (lat - a[0]) / (b[0] - a[0])));
  return { u: a[1] + (b[1] - a[1]) * k, v: a[2] + (b[2] - a[2]) * k, zone: k < 0.5 ? a[3] : b[3] };
}

// curenții oceanici (cald = true / rece = false)
export const CURRENTS = [
  { name: 'Curentul Golfului (Gulf Stream)', warm: true, d: 'Un „râu” de apă caldă care pleacă din Golful Mexic și traversează Atlanticul până la Anglia. Din cauza lui, iernile din Anglia sunt mai blânde decât în alte locuri la fel de nordice.', pts: [[-80, 25], [-79.5, 30], [-75, 35], [-65, 39], [-50, 42], [-35, 47], [-20, 51], [-11, 55], [-3, 60]] },
  { name: 'Curentul Canarelor', warm: false, d: 'Apă rece care curge spre sud, pe lângă Africa. Corăbiile care plecau din Anglia erau ajutate de el să coboare spre sud.', pts: [[-12, 42], [-14, 35], [-17, 28], [-19, 21], [-21, 14]] },
  { name: 'Curentul Ecuatorial de Nord', warm: true, d: 'Curge spre vest, împins de alizee, de la Africa spre America.', pts: [[-22, 13], [-35, 14], [-50, 15], [-62, 16], [-75, 18]] },
  { name: 'Curentul Guineei', warm: true, d: 'Curge spre est, în Golful Guineei. Corăbiile care mergeau prea aproape de Africa erau duse în golf și rămâneau prinse în calm.', pts: [[-17, 6], [-8, 4.5], [2, 4], [8, 3.5]] },
  { name: 'Curentul Ecuatorial de Sud', warm: true, d: 'Curge spre vest, spre Brazilia. Una dintre explicațiile marelui ocol pe care îl făceau corăbiile prin vestul Atlanticului.', pts: [[8, -2], [-8, -3], [-22, -4], [-34, -6]] },
  { name: 'Curentul Braziliei', warm: true, d: 'Apă caldă care coboară pe lângă Brazilia. Corăbiile îl foloseau ca să coboare spre sud.', pts: [[-34, -8], [-37, -15], [-40, -22], [-45, -29], [-51, -37]] },
  { name: 'Curentul Benguela', warm: false, d: 'Apă rece care urcă pe lângă Africa de Sud-Vest. Mergea împotriva corăbiilor care ar fi vrut să coboare pe lângă Africa.', pts: [[17, -34], [14, -28], [12, -21], [10, -13]] },
  { name: 'Curentul Agulhas', warm: true, d: 'Un curent foarte puternic care coboară pe lângă Africa de Sud-Est. Când vântul de vest bate împotriva lui, se formează valuri uriașe care au scufundat multe corăbii. Căpitanii îl ocoleau pe la sud.', pts: [[40, -20], [35, -27], [30, -32], [25, -35.5], [20, -37.5]] },
  { name: 'Curentul Circumpolar Antarctic', warm: false, d: 'Cel mai mare curent din lume: curge spre est, în jurul Antarcticii, împins de „Patruzecile urlătoare”. Ajuta corăbiile să meargă spre Australia și Indonezia.', pts: [[-60, -52], [-30, -47], [0, -45], [30, -44], [60, -45], [90, -45], [120, -47], [148, -49]] },
  { name: 'Curentul Australiei de Vest', warm: false, d: 'Urcă spre nord pe lângă Australia, ca și corăbiile care mergeau spre strâmtoarea Sunda.', pts: [[114, -34], [111, -28], [108, -21], [106, -15]] },
  { name: 'Curentul Ecuatorial de Sud (Oceanul Indian)', warm: true, d: 'Curge spre vest, prin mijlocul Oceanului Indian.', pts: [[112, -12], [95, -12], [80, -12], [65, -13], [50, -14]] },
  { name: 'Kuroshio', warm: true, d: 'Curent cald care urcă pe lângă Taiwan spre Japonia, ca un „Gulf Stream” al Asiei.', pts: [[121.5, 21], [123, 26], [127.5, 30], [134, 33], [141, 35.5], [150, 37]] },
  { name: 'Curentul musonului (Marea Chinei de Sud)', warm: true, monsoon: true, d: 'Își schimbă direcția odată cu musonul: vara curge spre nord-est, iarna spre sud-vest.', pts: [[105.5, 7], [109.5, 11.5], [111.5, 16], [115.5, 20.5]] },
];

// locurile marcate pe hartă
export const PLACES = [
  { n: 'Londra', p: [-0.1, 51.5], a: 'r' }, { n: 'Lisabona', p: [-9.1, 38.7], a: 'r' }, { n: 'Madeira', p: [-16.9, 32.7], a: 'l' },
  { n: 'Insulele Canare', p: [-15.5, 28.1], a: 'l' }, { n: 'Capul Verde', p: [-23.5, 15], a: 'l' }, { n: 'Rio de Janeiro', p: [-43.2, -22.9], a: 'l' },
  { n: 'Sf. Elena', p: [-5.7, -15.9], a: 'r' }, { n: 'Capul Bunei Speranțe', p: [18.5, -34.4], a: 'b' }, { n: 'Tristan da Cunha', p: [-12.3, -37.1], a: 'l' },
  { n: 'Goa', p: [73.8, 15.5], a: 'l' }, { n: 'Calcutta', p: [88.4, 22.6], a: 'r' }, { n: 'Str. Sunda', p: [105.8, -6.0], a: 'l' },
  { n: 'Batavia', p: [106.8, -6.1], a: 'r' }, { n: 'Macao', p: [113.55, 22.2], a: 'b' }, { n: 'Canton', p: [113.3, 23.1], a: 'l' },
  { n: 'Fuzhou', p: [119.3, 26.1], a: 'r' }, { n: 'Shanghai', p: [121.5, 31.2], a: 'r' }, { n: 'Hong Kong', p: [114.2, 22.3], a: 'r' },
];

// traseele corăbiilor (stop = zile de oprire în port, ev = text pentru jurnal)
export const ROUTES = {
  cutty: {
    label: 'Cutty Sark · Londra → Shanghai (1870)',
    start: new Date(1870, 1, 16),
    base: 6.3, // noduri, viteza de bază pe vânt bun
    pts: [
      { p: [0.6, 51.45], n: 'Londra (Tamisa)', ev: 'Plecăm din docurile Londrei, trași de un remorcher cu aburi pe Tamisa. Cala e goală: aducem ceaiul la întoarcere.' },
      { p: [1.5, 51.0] }, { p: [-2.5, 50.1] },
      { p: [-5.3, 49.8], n: 'Capul Lizard', ev: 'Ultimul colț al Angliei. Vântul de vest bate din față: facem zig-zag (virăm des) prin Canalul Mânecii.' },
      { p: [-10, 45.5] }, { p: [-15.5, 37] },
      { p: [-18.3, 30.5], n: 'Lângă Madeira', ev: 'Am prins alizeele de nord-est! Vânt constant din spate-lateral, toate pânzele sus.' },
      { p: [-21.5, 22.5] },
      { p: [-25.5, 14.5], n: 'Lângă Capul Verde', ev: 'Apa e caldă, peștii zburători sar pe punte. Urmează calmele ecuatoriale.', decision: 'dold' },
      { p: [-27, 6.5] },
      { p: [-28.5, 0], n: 'Ecuatorul', ev: 'Am trecut Ecuatorul! Marinarii care îl trec prima dată sunt „botezați” de Neptun: stropiți cu apă și bărbieriți în glumă.' },
      { p: [-31, -10] }, { p: [-31, -20], n: 'Lângă insula Trindade', ev: 'Alizeele de sud-est ne împing spre Brazilia: de aceea drumul face un ocol mare prin vest.' },
      { p: [-26, -30] }, { p: [-13, -37.5] },
      { p: [5, -40.5], n: 'Patruzecile urlătoare', ev: 'Vânt puternic din vest, valuri cât casa. Albatroșii ne urmăresc. Mergem cu peste 300 de mile pe zi!', decision: 'cape' },
      { p: [20, -41], n: 'La sud de Capul Bunei Speranțe', ev: 'Am trecut de Africa pe la sud, departe de curentul Agulhas și de valurile lui uriașe.' },
      { p: [45, -41] }, { p: [70, -40.5] }, { p: [90, -38] },
      { p: [101, -28], n: 'Ne întoarcem spre nord', ev: 'Lăsăm vânturile de vest și urcăm spre Indonezia cu alizeele de sud-est din lateral.' },
      { p: [104.5, -14] },
      { p: [105.8, -6.0], n: 'Strâmtoarea Sunda', ev: 'Intrăm printre insulele Java și Sumatra. Apă mică, insule, curenți: un ofițer stă tot timpul la sonda de adâncime.' },
      { p: [107, -3], decision: 'monsoon' }, { p: [108.6, 1.5] }, { p: [110, 6.5] }, { p: [112, 12] },
      { p: [114.5, 18] }, { p: [117.5, 21] }, { p: [119.8, 24.3] }, { p: [121.8, 28.2] },
      { p: [121.6, 31.2], n: 'Shanghai', ev: 'Am ajuns! Ancorăm la Shanghai și așteptăm ceaiul din noua recoltă. Cine ajunge primul acasă cu ceaiul proaspăt îl vinde cel mai scump.' },
    ],
  },
  hindostan: {
    label: 'Hindostan · Portsmouth → Canton (1792)',
    start: new Date(1792, 8, 26),
    base: 4.0,
    pts: [
      { p: [-1.1, 50.75], n: 'Portsmouth', ev: 'Plecăm împreună cu HMS Lion, cu ambasada lordului Macartney la împăratul Chinei. La bord: cadourile pentru împărat, cu grijă împachetate.' },
      { p: [-3, 50.0] }, { p: [-5.5, 49.6] }, { p: [-10, 45] }, { p: [-15.5, 36] },
      { p: [-16.9, 32.6], n: 'Madeira (Funchal)', stop: 5, ev: 'Oprire la Madeira: apă proaspătă, fructe și vinul faimos al insulei.' },
      { p: [-16.25, 28.4], n: 'Tenerife', stop: 3, ev: 'Oprire scurtă la Tenerife. Vedem vulcanul Teide de pe mare.' },
      { p: [-21, 20] },
      { p: [-23.5, 14.9], n: 'Capul Verde (Praia)', stop: 3, ev: 'Ultima oprire în nord. Urmează calmele ecuatoriale.', decision: 'dold' },
      { p: [-26, 6] }, { p: [-28, 0], n: 'Ecuatorul', ev: 'Botezul Ecuatorului cu Neptun! Toți cei care trec prima dată sunt stropiți cu apă de mare.' },
      { p: [-33, -10] },
      { p: [-43.1, -22.95], n: 'Rio de Janeiro', stop: 14, ev: 'Două săptămâni la Rio de Janeiro: reparăm pânzele, luăm apă, carne și portocale (împotriva scorbutului).' },
      { p: [-30, -32] },
      { p: [-12.3, -37.2], n: 'Tristan da Cunha', ev: 'Trecem pe lângă insula vulcanică Tristan da Cunha, în mijlocul oceanului.' },
      { p: [5, -39.5], decision: 'cape' },
      { p: [20, -40], n: 'La sud de Capul Bunei Speranțe' },
      { p: [50, -40] },
      { p: [77.5, -38.7], n: 'Insulele St. Paul și Amsterdam', ev: 'Două insule mici, singure în Oceanul Indian. Marinarii au văzut aici foci și pinguini.' },
      { p: [97, -27] }, { p: [104, -13] },
      { p: [105.8, -6.0], n: 'Strâmtoarea Sunda' },
      { p: [106.8, -6.05], n: 'Batavia (Jakarta)', stop: 14, ev: 'Oprire la Batavia, portul olandez de pe insula Java. E foarte cald și mulți marinari se îmbolnăvesc de febră.' },
      { p: [107.5, -3], decision: 'monsoon' }, { p: [108.6, 1.5] }, { p: [109.5, 8] }, { p: [110.5, 14] }, { p: [112.5, 19] },
      { p: [113.55, 22.1], n: 'Macao', stop: 3, ev: 'Macao, orașul portughezilor de lângă China. De aici ia un pilot chinez care ne duce pe râul Perlelor.' },
      { p: [113.43, 23.08], n: 'Whampoa · Canton', ev: 'Ancorăm la Whampoa, lângă Canton. Străinii au voie să facă negoț doar aici, prin negustorii chinezi „Hong”. Încărcăm ceai, porțelan și mătase.' },
    ],
  },
};

export function haversineNm(a, b) {
  const R = 3440.065, d2r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * d2r, dLon = (b[0] - a[0]) * d2r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * d2r) * Math.cos(b[1] * d2r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
