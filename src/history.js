// Secțiunea 4: scurtă istorie a drumului pe mare spre China.
export const EVENTS = [
  { y: '1405–1433', t: 'Flota de comori a lui Zheng He', ship: null, img: 'junk', d: 'Amiralul chinez Zheng He a condus 7 expediții uriașe, cu zeci de corăbii mari și zeci de mii de oameni, până în India, Arabia și Africa. Chinezii știau să navigheze departe cu mult înaintea europenilor.' },
  { y: '1488', t: 'Bartolomeu Dias ocolește Africa', d: 'Portughezul Bartolomeu Dias trece pe lângă vârful de sud al Africii. Regele îl numește „Capul Bunei Speranțe”, pentru că deschidea drumul spre Asia.' },
  { y: '1498', t: 'Vasco da Gama ajunge în India', d: 'Prima călătorie pe mare din Europa până în India. Portughezii învață să folosească vânturile: fac un ocol mare prin Atlanticul de vest.' },
  { y: '1513', t: 'Primii europeni ajung pe mare în China', d: 'Portughezul Jorge Álvares ajunge cu o corabie la gura Râului Perlelor, lângă Canton. Din 1557, portughezii se stabilesc la Macao.' },
  { y: '1592', t: 'Capturarea carracei „Madre de Deus”', ship: 'madre', d: 'Corăbii englezești capturează uriașa carracă portugheză care venea din Asia cu mătase, porțelan chinezesc și mirodenii. Englezii văd cât de bogat e comerțul cu Asia.' },
  { y: '1600', t: 'Se înființează Compania Indiilor de Est', d: 'Pe 31 decembrie 1600, regina Elisabeta I dă voie unor negustori din Londra să facă singuri comerț cu Asia. Compania va construi corăbii mari, numite „East Indiamen”.' },
  { y: '1637', t: 'Primele corăbii englezești în China', d: 'O mică flotă condusă de căpitanul John Weddell ajunge la Canton. Întâlnirea nu merge bine: se trag chiar și focuri de tun. Comerțul adevărat va începe mai târziu.' },
  { y: '1757–1842', t: 'Sistemul de la Canton', d: 'Străinii au voie să facă negoț doar în portul Canton, numai cu negustori chinezi aprobați („Hong”). Corăbiile ancorează la Whampoa. Ceaiul devine băutura preferată a englezilor.' },
  { y: '1792–1794', t: 'Ambasada lordului Macartney', ship: 'hindostan', d: 'Corăbiile HMS Lion și Hindostan duc prima ambasadă britanică la împăratul Qianlong, cu cadouri minunate. Împăratul răspunde politicos că China are deja tot ce îi trebuie.' },
  { y: '1839–1842', t: 'Războiul Opiului', d: 'Negustorii britanici vindeau în China opiu, un drog care îi îmbolnăvea pe oameni. China a încercat să-l oprească, iar Britania a pornit un război. A fost un capitol nedrept al istoriei. După el, Hong Kong a devenit britanic și s-au deschis alte porturi, ca Shanghai și Fuzhou.' },
  { y: '1846–1848', t: 'Jonca „Keying” vine la Londra', ship: 'keying', d: 'O joncă chinezească face drumul invers: din Hong Kong, pe lângă Africa, până la New York și apoi la Londra. Mii de londonezi, chiar și Regina Victoria, o vizitează pe Tamisa.' },
  { y: '1866', t: 'Marea cursă a ceaiului', d: 'Cliperele Ariel și Taeping pleacă din Fuzhou aproape în același timp și ajung la Londra după 99 de zile, la doar câteva minute unul de altul! Ceaiul primei corăbii sosite era cel mai scump.' },
  { y: '1869', t: 'Se lansează Cutty Sark · se deschide Canalul Suez', ship: 'cutty', d: 'În același an apare unul dintre cele mai rapide clipere și se deschide Canalul Suez, care scurtează mult drumul. Dar prin canal pot trece doar vapoarele cu aburi, nu și velierele: vremea cliperelor de ceai se apropie de sfârșit.' },
  { y: '1872', t: 'Cutty Sark contra Thermopylae', d: 'Cele două clipere pleacă din Shanghai. Cutty Sark e în frunte, dar în Oceanul Indian o furtună îi rupe cârma. Echipajul construiește o cârmă nouă chiar pe mare și ajunge totuși la Londra, cam la o săptămână după rival.' },
  { y: 'Azi', t: 'Cutty Sark la Greenwich', d: 'Cutty Sark este singurul cliper de ceai păstrat până azi. E muzeu la Greenwich, în Londra: poți merge pe punte și chiar pe sub corabie, ridicată deasupra solului!' },
];

export const QUIZ = [
  { q: 'De ce corăbiile spre China făceau un ocol mare prin vestul Atlanticului, aproape de Brazilia?', o: ['Ca să cumpere cafea', 'Din cauza vânturilor și a curenților: alizeele de sud-est le împingeau spre vest', 'Pentru că era mai cald'], a: 1, e: 'Alizeele de sud-est și curenții le împingeau spre vest, iar mai la sud prindeau vânturile de vest care le duceau spre Africa de Sud.' },
  { q: 'Ce aduceau corăbiile engleze din China?', o: ['Ceai, porțelan și mătase', 'Cartofi și porumb', 'Cărbune'], a: 0, e: 'Ceaiul era marfa cea mai importantă: englezii au devenit un popor de băutori de ceai.' },
  { q: 'Ce înseamnă „Patruzecile urlătoare”?', o: ['40 de marinari care cântau', 'Vânturi puternice de vest între 40° și 50° latitudine sudică', 'O furtună care ține 40 de zile'], a: 1, e: 'Vânturile bat tare din vest, fără uscat care să le oprească: drumul cel mai rapid spre est.' },
  { q: 'Când era bine să ajungi în Marea Chinei de Sud?', o: ['Iarna, cu musonul de nord-est', 'Vara, cu musonul de sud-vest', 'Oricând, e la fel'], a: 1, e: 'Vara musonul bate dinspre sud-vest și împinge corăbiile spre China. Iarna bate din față.' },
  { q: 'Unde poți vizita azi corabia Cutty Sark?', o: ['În Shanghai', 'La Greenwich, în Londra', 'În Lisabona'], a: 1, e: 'Este muzeu la Greenwich, lângă Tamisa.' },
];

export function initHistory(root, getThumb) {
  const tl = root.querySelector('#timeline');
  tl.innerHTML = EVENTS.map((e, i) => `<article class="ev">
      <div class="yr">${e.y}</div>
      ${e.ship ? `<img class="evimg" data-id="${e.ship}" alt="${e.t}">` : ''}
      <h3>${e.t}</h3><p>${e.d}</p></article>`).join('');
  if (getThumb) tl.querySelectorAll('img[data-id]').forEach(img => getThumb(img.dataset.id).then(u => { if (u) img.src = u; else img.remove(); }));
  // quiz
  const qz = root.querySelector('#histQuiz');
  let score = 0, answered = 0;
  qz.innerHTML = QUIZ.map((q, i) => `<div class="q" data-q="${i}"><p class="qt">${i + 1}. ${q.q}</p><div class="opts">${q.o.map((o, j) => `<button data-j="${j}">${o}</button>`).join('')}</div><div class="fb"></div></div>`).join('') + '<p class="score" id="histScore"></p>';
  qz.querySelectorAll('.q').forEach(div => {
    const q = QUIZ[+div.dataset.q];
    div.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (div.dataset.done) return; div.dataset.done = 1; answered++;
      const ok = +b.dataset.j === q.a; if (ok) score++;
      b.classList.add(ok ? 'ok' : 'no'); div.querySelectorAll('button')[q.a].classList.add('ok');
      div.querySelector('.fb').textContent = (ok ? '✅ ' : '💡 ') + q.e;
      if (answered === QUIZ.length) root.querySelector('#histScore').textContent = `Scor: ${score} din ${QUIZ.length} ${score === QUIZ.length ? '🏆' : ''}`;
    }));
  });
}
