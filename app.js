/* =========================================================================
   A.R.M — SITE PUBLIC
   Tout texte venant de Firestore passe par esc() (voir utils.js) avant
   d'être affiché : c'est ce qui protège le site et le tableau de bord
   contre l'injection de code via le chat ou les formulaires publics.
   ========================================================================= */

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const inc = (n) => firebase.firestore.FieldValue.increment(n);

document.getElementById('anneeFooter').textContent = new Date().getFullYear();
document.querySelectorAll('.arm-logo').forEach(img => { img.src = LOGO_DATA_URI; });

/* ===================== THÈME CLAIR / SOMBRE ===================== */
const themeBtn = document.getElementById('themeBtn');
function appliquerTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeBtn.textContent = t === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('arm-theme', t); } catch (e) {}
}
appliquerTheme(document.documentElement.getAttribute('data-theme') || 'light');
themeBtn.onclick = () => appliquerTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

/* ===================== MENU MOBILE ===================== */
document.getElementById('menuBtn').onclick = () => document.getElementById('mobileMenu').classList.toggle('hidden');
document.querySelectorAll('#mobileMenu a').forEach(a => a.onclick = () => document.getElementById('mobileMenu').classList.add('hidden'));

/* ===================== ANIMATIONS D'APPARITION ===================== */
const obs = new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('show'); obs.unobserve(en.target); } });
}, { threshold: .1 });
// Appelée après chaque rendu : sans cela, le contenu chargé plus tard
// (bureau modifié par l'admin, actualités) restait invisible.
function observerFadeIn(racine = document) {
  racine.querySelectorAll('.fade-in:not(.show)').forEach(el => obs.observe(el));
}

/* ===================== PROGRAMME ===================== */
function renderProgramme(liste) {
  const grid = document.getElementById('programmeGrid');
  grid.innerHTML = (liste || PROGRAMME).map(p => `
    <div class="card p-6 fade-in">
      <div class="text-4xl mb-4">${esc(p.icone)}</div>
      <h3 class="serif font-bold text-xl mb-2">${esc(p.titre)}</h3>
      <p class="text-sm muted leading-relaxed">${esc(p.texte)}</p>
    </div>`).join('');
  observerFadeIn(grid);
}

/* ===================== BUREAU EXÉCUTIF (+ recherche) ===================== */
let bureauAffiche = BUREAU.slice();

function renderBureau(liste) {
  if (liste) bureauAffiche = liste;
  const q = (document.getElementById('rechercheBureau').value || '').trim().toLowerCase();
  const membres = q
    ? bureauAffiche.filter(m => [m.role, m.nom, m.profession, m.lieu].join(' ').toLowerCase().includes(q))
    : bureauAffiche;

  const grid = document.getElementById('bureauGrid');
  grid.innerHTML = membres.map(m => {
    const initiales = esc(String(m.nom || '').split(' ').map(x => x[0] || '').join('').slice(0, 2).toUpperCase());
    return `
    <div class="card p-5 fade-in flex gap-4">
      <div class="w-14 h-14 shrink-0 rounded-full flex items-center justify-center font-bold text-white serif text-lg" style="background:linear-gradient(135deg,var(--vert),#0d3a22)">${initiales}</div>
      <div class="min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-wider" style="color:var(--or)">${esc(m.role)}</p>
        <p class="font-bold text-lg leading-tight">${esc(m.nom)}</p>
        ${m.profession ? `<p class="text-sm muted">${esc(m.profession)}</p>` : ''}
        ${m.lieu ? `<p class="text-sm muted">📍 ${esc(m.lieu)}</p>` : ''}
        ${m.tel ? `<a href="tel:${esc(telLien(m.tel))}" class="text-sm font-semibold" style="color:var(--vert)">☎ ${esc(m.tel)}</a>` : ''}
      </div>
    </div>`;
  }).join('') || '<p class="muted text-sm">Aucun membre ne correspond à la recherche.</p>';
  observerFadeIn(grid);

  document.getElementById('contactDirigeants').innerHTML = bureauAffiche.filter(m => m.tel).map(m => `
    <p><b>${esc(m.role)} — ${esc(m.nom)} :</b> <a href="tel:${esc(telLien(m.tel))}" style="color:var(--vert)">${esc(m.tel)}</a></p>`).join('');
  document.getElementById('statPubBureau').textContent = bureauAffiche.length;
}
document.getElementById('rechercheBureau').addEventListener('input', () => renderBureau());

/* ===================== CONTENU PILOTÉ PAR L'ADMIN ===================== */
function chargerContenuDynamique() {
  db.collection('contenu').doc('bureau').onSnapshot(doc => {
    const d = doc.data();
    if (d && Array.isArray(d.membres) && d.membres.length) renderBureau(d.membres);
  }, err => console.warn('bureau :', err.message));

  db.collection('contenu').doc('programme').onSnapshot(doc => {
    const d = doc.data();
    if (d && Array.isArray(d.items) && d.items.length) renderProgramme(d.items);
  }, err => console.warn('programme :', err.message));

  db.collection('contenu').doc('info').onSnapshot(doc => {
    const d = doc.data() || {};
    if (d.devise) {
      document.getElementById('deviseNav').textContent = d.devise;
      document.getElementById('deviseHero').textContent = d.devise.toUpperCase();
      document.getElementById('deviseFooter').textContent = d.devise;
    }
    if (d.siege) {
      document.getElementById('siegeContact').textContent = d.siege;
      document.getElementById('siegeFooter').textContent = d.siege;
    }
    if (d.iban) document.getElementById('ibanVirement').textContent = d.iban;
    if (d.orangeMoney) document.getElementById('numOrange').textContent = d.orangeMoney;
    if (d.moovMoney) document.getElementById('numMoov').textContent = d.moovMoney;
    if (d.wave) document.getElementById('numWave').textContent = d.wave;

    const lien = safeUrl(d.lienPaiementCarte);
    document.getElementById('carteActive').classList.toggle('hidden', !lien);
    document.getElementById('carteInactive').classList.toggle('hidden', !!lien);
    if (lien) document.getElementById('lienPaiementCarte').setAttribute('href', d.lienPaiementCarte.trim());
  }, err => console.warn('info :', err.message));

  // Statistiques publiques en temps réel
  db.collection('compteurs').doc('global').onSnapshot(doc => {
    const c = doc.data() || {};
    document.getElementById('statPubAdh').textContent = (c.adhesions || 0).toLocaleString('fr-FR');
  }, () => { document.getElementById('statPubAdh').textContent = '—'; });
}

/* ===================== DONS ===================== */
let montantChoisi = 10;
let moyenDon = 'carte';
let refDon = genererReference();

function genererReference() {
  return 'DON-ARM-' + Date.now().toString(36).toUpperCase().slice(-6);
}
function majAffichageDon() {
  document.querySelectorAll('.montantAffiche').forEach(el => el.textContent = montantChoisi + ' €');
  document.querySelectorAll('.refDon').forEach(el => el.textContent = refDon);
}

document.querySelectorAll('.montant-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.montant-btn').forEach(b => b.classList.remove('actif'));
    btn.classList.add('actif');
    montantChoisi = parseInt(btn.dataset.m, 10);
    document.getElementById('montantLibre').value = '';
    majAffichageDon();
  };
});
document.getElementById('montantLibre').addEventListener('input', (e) => {
  const v = Math.round(parseFloat(e.target.value));
  if (v > 0 && v <= 100000) {
    montantChoisi = v;
    document.querySelectorAll('.montant-btn').forEach(b => b.classList.remove('actif'));
    majAffichageDon();
  }
});

document.querySelectorAll('.tab-don').forEach(t => {
  t.onclick = () => {
    moyenDon = t.dataset.tab;
    document.querySelectorAll('.tab-don').forEach(x => x.classList.toggle('actif', x === t));
    document.getElementById('panneauCarte').classList.toggle('hidden', moyenDon !== 'carte');
    document.getElementById('panneauMobile').classList.toggle('hidden', moyenDon !== 'mobile');
    document.getElementById('panneauVirement').classList.toggle('hidden', moyenDon !== 'virement');
    document.getElementById('formDeclarationDon').classList.toggle('hidden', moyenDon === 'carte');
    document.getElementById('donConfirm').classList.add('hidden');
  };
});

document.getElementById('formDeclarationDon').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bouton = e.target.querySelector('button');
  bouton.disabled = true;
  const don = {
    montant: montantChoisi,
    methode: moyenDon === 'mobile' ? 'mobile_money' : 'virement_bms',
    nom: document.getElementById('donNom').value.trim(),
    contact: document.getElementById('donContact').value.trim(),
    reference: refDon,
    statut: 'en attente',      // l'admin confirme à réception des fonds
    createdAt: Date.now()
  };
  try {
    await db.collection('dons').add(don);
    const box = document.getElementById('donConfirm');
    box.classList.remove('hidden');
    box.innerHTML = `✅ Merci <b>${esc(don.nom)}</b> ! Votre don de <b>${don.montant} €</b> est enregistré sous la référence <b>${esc(don.reference)}</b>. Il sera confirmé par la trésorerie dès réception des fonds.`;
    e.target.reset();
    refDon = genererReference();
    majAffichageDon();
  } catch (err) {
    console.error(err);
    toast("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.", 'erreur');
  }
  bouton.disabled = false;
});

/* ===================== ADHÉSION EN 3 ÉTAPES ===================== */
let etapeAdhesion = 1;

function renderRegions() {
  const rSel = document.getElementById('aRegion');
  Object.keys(REGIONS_MALI).forEach(r => rSel.insertAdjacentHTML('beforeend', `<option value="${esc(r)}">${esc(r)}</option>`));
  rSel.onchange = () => {
    const cSel = document.getElementById('aCercle');
    cSel.innerHTML = '<option value="">Cercle / Commune</option>';
    (REGIONS_MALI[rSel.value] || []).forEach(c => cSel.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`));
  };
  document.getElementById('statPubRegions').textContent = Object.keys(REGIONS_MALI).length;
}

function afficherEtape(n) {
  etapeAdhesion = n;
  document.querySelectorAll('#formAdhesion .etape').forEach(el => el.classList.toggle('hidden', +el.dataset.etape !== n));
  document.querySelectorAll('.etape-dot').forEach(d => {
    const i = +d.dataset.dot;
    d.classList.toggle('actif', i === n);
    d.classList.toggle('fait', i < n);
  });
  document.getElementById('btnPrecedent').classList.toggle('invisible', n === 1);
  document.getElementById('btnSuivant').classList.toggle('hidden', n === 3);
  document.getElementById('btnEnvoyerAdhesion').classList.toggle('hidden', n !== 3);
  document.getElementById('adhesionErreur').classList.add('hidden');
  if (n === 3) {
    const v = id => document.getElementById(id).value.trim();
    document.getElementById('recapAdhesion').innerHTML = `
      <p class="font-semibold mb-1">Récapitulatif</p>
      <p>${esc(v('aPrenom'))} ${esc(v('aNom'))} · ${esc(v('aTel'))}${v('aEmail') ? ' · ' + esc(v('aEmail')) : ''}</p>
      <p>${esc(v('aRegion'))}${v('aCercle') ? ' — ' + esc(v('aCercle')) : ''}${v('aQuartier') ? ' — ' + esc(v('aQuartier')) : ''}</p>`;
  }
}

function erreurAdhesion(msg) {
  const el = document.getElementById('adhesionErreur');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function etapeValide(n) {
  const v = id => document.getElementById(id).value.trim();
  if (n === 1) {
    if (!v('aNom') || !v('aPrenom') || !v('aTel')) { erreurAdhesion('Merci de renseigner votre nom, prénom et téléphone.'); return false; }
    if (v('aEmail') && !/^\S+@\S+\.\S+$/.test(v('aEmail'))) { erreurAdhesion("L'adresse email n'est pas valide."); return false; }
  }
  if (n === 2 && !v('aRegion')) { erreurAdhesion('Merci de choisir votre région.'); return false; }
  return true;
}

document.getElementById('btnSuivant').onclick = () => { if (etapeValide(etapeAdhesion)) afficherEtape(etapeAdhesion + 1); };
document.getElementById('btnPrecedent').onclick = () => afficherEtape(Math.max(1, etapeAdhesion - 1));

document.getElementById('formAdhesion').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!document.getElementById('aConsent').checked) { erreurAdhesion('Merci de cocher la case de consentement.'); return; }
  const v = id => document.getElementById(id).value.trim();
  const data = {
    nom: v('aNom'), prenom: v('aPrenom'), tel: v('aTel'), email: v('aEmail'),
    profession: v('aProfession'), pays: v('aPays'), region: v('aRegion'),
    cercle: v('aCercle'), quartier: v('aQuartier'), message: v('aMessage'),
    statut: 'en attente', createdAt: Date.now()
  };
  const bouton = document.getElementById('btnEnvoyerAdhesion');
  bouton.disabled = true;
  try {
    await db.collection('adhesions').add(data);
    db.collection('compteurs').doc('global').set({ adhesions: inc(1) }, { merge: true }).catch(() => {});
    const box = document.getElementById('adhesionConfirm');
    box.classList.remove('hidden');
    box.innerHTML = `✅ Merci <b>${esc(data.prenom)}</b> ! Votre demande d'adhésion a bien été reçue. Elle sera validée par l'administration du parti.`;
    e.target.reset();
    document.getElementById('aCercle').innerHTML = '<option value="">Cercle / Commune</option>';
    afficherEtape(1);
  } catch (err) {
    console.error(err);
    erreurAdhesion("L'envoi a échoué. Vérifiez votre connexion et réessayez.");
  }
  bouton.disabled = false;
});

/* ===================== ACTUALITÉS (défilement infini + recherche + partage) ===================== */
let actusChargees = [];

function carteActu(id, a) {
  const contenu = String(a.contenu || '');
  const visio = safeUrl(a.lienVisio);
  const image = safeUrl(a.image);
  return `
    <article class="card overflow-hidden fade-in flex flex-col" id="actu-${esc(id)}">
      ${image ? `<img src="${image}" alt="" loading="lazy" class="w-full h-44 object-cover">` : ''}
      <div class="p-5 flex-1 flex flex-col">
        <p class="text-xs muted mb-1">${esc(a.date || '')}${a.lieu ? ' · 📍 ' + esc(a.lieu) : ''}</p>
        <h3 class="serif font-bold text-lg mb-2 leading-snug">${esc(a.titre || '')}</h3>
        <p class="text-sm muted line-clamp-3 mb-4">${esc(contenu)}</p>
        <div class="mt-auto flex flex-wrap items-center gap-3">
          ${visio ? `<a href="${visio}" target="_blank" rel="noopener" class="text-sm font-bold" style="color:var(--vert)">🎥 Rejoindre la visio</a>` : ''}
          <button type="button" class="text-sm font-semibold muted ml-auto" data-partage="${esc(id)}">↗ Partager</button>
        </div>
      </div>
    </article>`;
}

function renderActus() {
  const q = (document.getElementById('rechercheActu').value || '').trim().toLowerCase();
  const liste = q
    ? actusChargees.filter(({ a }) => [a.titre, a.contenu, a.lieu].join(' ').toLowerCase().includes(q))
    : actusChargees;
  const grid = document.getElementById('actualitesGrid');
  grid.innerHTML = liste.map(({ id, a }) => carteActu(id, a)).join('')
    || `<p class="muted text-sm">${q ? 'Aucune actualité ne correspond à la recherche.' : ''}</p>`;
  observerFadeIn(grid);
}

document.getElementById('rechercheActu').addEventListener('input', renderActus);

document.getElementById('actualitesGrid').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-partage]');
  if (!btn) return;
  const item = actusChargees.find(x => x.id === btn.dataset.partage);
  if (!item) return;
  const url = location.origin + location.pathname + '#actu-' + item.id;
  const texte = (item.a.titre || 'Actualité A.R.M') + ' — A.R.M';
  if (navigator.share) {
    try { await navigator.share({ title: texte, url }); } catch (err) {}
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(texte + ' ' + url), '_blank', 'noopener');
  }
});

function chargerActualites() {
  const liste = creerDefilementInfini({
    collection: db.collection('actualites'),
    orderBy: ['createdAt', 'desc'],
    pageSize: 9,
    sentinel: document.getElementById('sentinelActu'),
    texteVide: 'Aucune actualité pour le moment.',
    onPage: (docs, premiere) => {
      if (premiere) actusChargees = [];
      docs.forEach(d => actusChargees.push({ id: d.id, a: d.data() }));
      renderActus();
    }
  });
  liste.demarrer();
}

/* ===================== CHAT PUBLIC ===================== */
function initChat() {
  const box = document.getElementById('chatBox');
  try {
    const nomMemo = localStorage.getItem('arm-chat-nom');
    if (nomMemo) document.getElementById('chatNom').value = nomMemo;
  } catch (e) {}

  db.collection('chat').orderBy('createdAt', 'asc').limitToLast(50).onSnapshot(snap => {
    box.innerHTML = snap.docs.map(doc => {
      const m = doc.data();
      return `<div class="bulle"><span class="font-bold" style="color:var(--vert)">${esc(m.nom)}</span>
        <span class="text-[11px] muted ml-1">${esc(formatDate(m.createdAt))}</span><br>${esc(m.message)}</div>`;
    }).join('') || '<p class="text-sm muted text-center mt-8">Soyez le premier à écrire un message.</p>';
    box.scrollTop = box.scrollHeight;
  }, err => {
    console.warn('chat :', err.message);
    box.innerHTML = '<p class="text-sm muted text-center mt-8">Le chat est momentanément indisponible.</p>';
  });
}

document.getElementById('chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nom = document.getElementById('chatNom').value.trim().slice(0, 40);
  const message = document.getElementById('chatMsg').value.trim().slice(0, 500);
  if (!nom || !message) return;
  try { localStorage.setItem('arm-chat-nom', nom); } catch (err) {}
  try {
    await db.collection('chat').add({ nom, message, createdAt: Date.now() });
    document.getElementById('chatMsg').value = '';
  } catch (err) {
    console.error(err);
    toast("Message non envoyé. Réessayez.", 'erreur');
  }
});

/* ===================== CONTACT ===================== */
document.getElementById('formContact').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = id => document.getElementById(id).value.trim();
  const data = { nom: v('cNom'), email: v('cEmail'), sujet: v('cSujet'), message: v('cMessage'), lu: false, createdAt: Date.now() };
  const bouton = e.target.querySelector('button');
  bouton.disabled = true;
  try {
    await db.collection('messages').add(data);
    db.collection('compteurs').doc('global').set({ messages: inc(1) }, { merge: true }).catch(() => {});
    toast('✅ Message envoyé. Nous vous répondrons rapidement.');
    e.target.reset();
  } catch (err) {
    console.error(err);
    toast("L'envoi a échoué. Réessayez.", 'erreur');
  }
  bouton.disabled = false;
});

/* ===================== INSTALLATION (PWA) ===================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').classList.remove('hidden');
});
document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').classList.add('hidden');
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ===================== DÉMARRAGE ===================== */
renderProgramme();
renderBureau();
renderRegions();
majAffichageDon();
chargerContenuDynamique();
chargerActualites();
initChat();
observerFadeIn();
